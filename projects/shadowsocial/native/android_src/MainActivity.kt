package ke.co.shadownet.shadowsocial

import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection
import java.util.zip.ZipFile

class MainActivity : FlutterActivity() {
    private val worker = Executors.newSingleThreadExecutor()
    private var prepared: File? = null
    private var downloading = false
    private val releaseOrigin = "https://shadowsocial-shadownet.sammymuya167.chatgpt.site"
    private val ownerCertificate = "3d48406874958d7cf34d08373101fbb346cc52fda05008a1cb0231c0db3d0a71"
    @Suppress("DEPRECATION")
    private fun info(path: String? = null): PackageInfo? {
        val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        return if (path == null) packageManager.getPackageInfo(packageName, flags) else packageManager.getPackageArchiveInfo(path, flags)
    }
    @Suppress("DEPRECATION")
    private fun code(p: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) p.longVersionCode else p.versionCode.toLong()
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    @Suppress("DEPRECATION")
    private fun certificates(p: PackageInfo): Set<String> {
        val signs = if (Build.VERSION.SDK_INT >= 28) p.signingInfo?.apkContentsSigners else p.signatures
        return signs?.map { hex(MessageDigest.getInstance("SHA-256").digest(it.toByteArray())) }?.toSet() ?: emptySet()
    }
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "shadowsocial/updates")
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "info" -> {
                    val current = info()!!
                    result.success(mapOf("version" to current.versionName, "versionCode" to code(current),
                        "sdk" to Build.VERSION.SDK_INT, "abis" to Build.SUPPORTED_ABIS.toList()))
                }
                "download" -> {
                    if (downloading) { result.error("busy", "An update is already downloading.", null); return@setMethodCallHandler }
                    val address = call.argument<String>("url") ?: ""
                    val digest = call.argument<String>("sha256") ?: ""
                    val expectedBytes = call.argument<Number>("bytes")?.toLong() ?: 0
                    val expectedCode = call.argument<Number>("versionCode")?.toLong() ?: 0
                    if (!address.matches(Regex(Regex.escape(releaseOrigin) + "/api/android/v[0-9]{1,4}\\.[0-9]{1,4}\\.[0-9]{1,4}")) ||
                        !digest.matches(Regex("[a-f0-9]{64}")) || expectedBytes !in 1000000L..104857600L ||
                        expectedCode <= code(info()!!)) {
                        result.error("invalid", "This update could not be verified.", null); return@setMethodCallHandler
                    }
                    downloading = true
                    prepared = null
                    worker.execute {
                        val dir = File(cacheDir, "updates").apply { mkdirs() }
                        dir.listFiles()?.forEach { it.delete() }
                        val part = File(dir, "download.part")
                        val target = File(dir, "shadowsocial-" + expectedCode + ".apk")
                        var connection: HttpsURLConnection? = null
                        try {
                            connection = URL(address).openConnection() as HttpsURLConnection
                            connection.instanceFollowRedirects = false
                            connection.connectTimeout = 15000
                            connection.readTimeout = 30000
                            connection.setRequestProperty("User-Agent", "ShadowSocial/" + info()!!.versionName + " (Android updater)")
                            check(connection.responseCode == 200) { "The update could not be downloaded. Try again." }
                            check(connection.contentLengthLong < 0 || connection.contentLengthLong == expectedBytes) { "The update size did not match." }
                            val hash = MessageDigest.getInstance("SHA-256")
                            var received = 0L
                            var last = 0L
                            val started = System.currentTimeMillis()
                            connection.inputStream.use { input ->
                                part.outputStream().use { output ->
                                    val buffer = ByteArray(65536)
                                    while (true) {
                                        check(!Thread.currentThread().isInterrupted && System.currentTimeMillis() - started < 900000) { "Download timed out. Try again." }
                                        val count = input.read(buffer)
                                        if (count < 0) break
                                        received += count
                                        check(received <= expectedBytes) { "The update is larger than expected." }
                                        hash.update(buffer, 0, count)
                                        output.write(buffer, 0, count)
                                        if (System.currentTimeMillis() - last > 200) {
                                            last = System.currentTimeMillis()
                                            val progress = received.toDouble() / expectedBytes
                                            runOnUiThread { channel.invokeMethod("progress", progress) }
                                        }
                                    }
                                }
                            }
                            check(received == expectedBytes && hex(hash.digest()) == digest) { "The update checksum did not match. Please try again." }
                            check(part.renameTo(target)) { "Could not save the update. Check free space." }
                            val apk = info(target.absolutePath) ?: error("The Android package is invalid.")
                            check(apk.packageName == packageName && code(apk) == expectedCode && code(apk) > code(info()!!)) { "This update belongs to a different app or version." }
                            val signedBy = certificates(apk)
                            check(signedBy == certificates(info()!!) && signedBy == setOf(ownerCertificate)) { "The Android signing key did not match your installed app." }
                            ZipFile(target).use { zip ->
                                check(Build.SUPPORTED_ABIS.any { zip.getEntry("lib/" + it + "/libapp.so") != null }) { "This update does not support your phone's processor." }
                            }
                            prepared = target
                            runOnUiThread { downloading = false; result.success(true) }
                        } catch (e: Exception) {
                            part.delete(); target.delete(); prepared = null
                            runOnUiThread { downloading = false; result.error("download", e.message ?: "Update download failed.", null) }
                        } finally { connection?.disconnect() }
                    }
                }
                "install" -> {
                    val file = prepared
                    if (file == null || !file.isFile) { result.error("missing", "Download the update again.", null); return@setMethodCallHandler }
                    try {
                        if (!packageManager.canRequestPackageInstalls()) {
                            startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + packageName)))
                            result.success("permission")
                        } else {
                            val uri = FileProvider.getUriForFile(this, packageName + ".updates", file)
                            startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
                            result.success("installer")
                        }
                    } catch (_: Exception) { result.error("installer", "Android could not open the installer. Try again.", null) }
                }
                else -> result.notImplemented()
            }
        }
    }
    override fun onDestroy() { worker.shutdownNow(); super.onDestroy() }
}
