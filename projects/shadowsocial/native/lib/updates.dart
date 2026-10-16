import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'api.dart';

const updateChannel = MethodChannel('shadowsocial/updates');

class AppRelease {
  final String version, path, sha256;
  final int versionCode, bytes, minSdk;
  final List<String> abis;
  AppRelease(
    this.version,
    this.path,
    this.sha256,
    this.versionCode,
    this.bytes,
    this.minSdk,
    this.abis,
  );
  static AppRelease? parse(Json value) {
    final path = value['downloadPath'], sha = value['sha256'];
    if (path is! String ||
        !RegExp(r'^/api/android/v\d{1,4}\.\d{1,4}\.\d{1,4}$').hasMatch(path) ||
        sha is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sha))
      return null;
    final code = value['versionCode'],
        size = value['bytes'],
        sdk = value['minSdk'];
    if (code is! int ||
        code < 1 ||
        size is! int ||
        size < 1000000 ||
        size > 104857600 ||
        sdk is! int ||
        sdk < 26 ||
        value['supportedAbis'] is! List)
      return null;
    final abis = (value['supportedAbis'] as List).whereType<String>().toList();
    if (abis.isEmpty ||
        value['version'] is! String ||
        path != '/api/android/${value['version']}')
      return null;
    return AppRelease(value['version'], path, sha, code, size, sdk, abis);
  }
}

class UpdateController extends ChangeNotifier {
  final Api api;
  Json? installed;
  AppRelease? release;
  bool checking = false,
      downloading = false,
      ready = false,
      critical = false,
      supported = true;
  String notes = '', error = '', message = '';
  double progress = 0;
  int? dismissedCode;
  DateTime? lastCheck;
  bool closed = false;
  UpdateController(this.api);
  bool get showNotice =>
      release != null &&
      supported &&
      (critical || dismissedCode != release!.versionCode);
  void changed() {
    if (!closed) notifyListeners();
  }

  Future<void> check({bool manual = false}) async {
    if (checking ||
        downloading ||
        (!manual &&
            lastCheck != null &&
            DateTime.now().difference(lastCheck!) < Duration(minutes: 1)))
      return;
    checking = true;
    error = '';
    changed();
    try {
      installed ??= await updateChannel.invokeMapMethod<String, dynamic>(
        'info',
      );
      if (installed == null) return;
      final data = await api.call('app-updates');
      final candidate =
          data['enabled'] == true && data['release'] is Map
              ? AppRelease.parse(Map<String, dynamic>.from(data['release']))
              : null;
      final next =
          candidate != null &&
                  candidate.versionCode >
                      (installed!['versionCode'] as num).toInt()
              ? candidate
              : null;
      if (next?.versionCode != release?.versionCode) {
        ready = false;
        progress = 0;
        message = '';
      }
      release = next;
      critical = data['critical'] == true;
      notes = (data['notes'] as String?) ?? '';
      supported =
          next == null ||
          ((installed!['sdk'] as num) >= next.minSdk &&
              (installed!['abis'] as List).any(
                (abi) => next.abis.contains(abi),
              ));
      lastCheck = DateTime.now();
    } on MissingPluginException {
      // Android provides the platform updater. Other targets retain normal app access.
    } catch (_) {
      if (manual)
        error =
            'Could not check for updates. Check your connection and try again.';
    } finally {
      checking = false;
      changed();
    }
  }

  void dismiss() {
    dismissedCode = release?.versionCode;
    changed();
  }

  Future<void> download() async {
    final r = release;
    if (r == null || downloading || !supported) return;
    downloading = true;
    ready = false;
    progress = 0;
    error = '';
    message = '';
    changed();
    try {
      await updateChannel.invokeMethod('download', {
        'url': '${api.origin}${r.path}',
        'sha256': r.sha256,
        'bytes': r.bytes,
        'versionCode': r.versionCode,
      });
      ready = true;
      progress = 1;
      message = 'Verified. Tap Install update to continue with Android.';
    } on PlatformException catch (e) {
      error = e.message ?? 'Download failed. Try again.';
    } catch (_) {
      error = 'Download failed. Check your connection and try again.';
    } finally {
      downloading = false;
      changed();
    }
  }

  Future<void> install() async {
    try {
      final result = await updateChannel.invokeMethod<String>('install');
      message =
          result == 'permission'
              ? 'Allow updates from ShadowSocial in Android settings, return here, then tap Install update again.'
              : 'Confirm the update in the Android installer. Your account and data stay on this phone.';
      error = '';
    } on PlatformException catch (e) {
      if (e.code == 'missing') ready = false;
      error = e.message ?? 'Could not open the Android installer.';
    } catch (_) {
      error = 'Could not open the Android installer.';
    }
    changed();
  }

  @override
  void dispose() {
    closed = true;
    super.dispose();
  }
}

class UpdateScope extends InheritedNotifier<UpdateController> {
  const UpdateScope({
    super.key,
    required UpdateController controller,
    required super.child,
  }) : super(notifier: controller);
  static UpdateController of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<UpdateScope>()!.notifier!;
}

class UpdateHost extends StatefulWidget {
  final Api api;
  final Widget child;
  final GlobalKey<NavigatorState> navigatorKey;
  const UpdateHost({
    super.key,
    required this.api,
    required this.navigatorKey,
    required this.child,
  });
  @override
  State<UpdateHost> createState() => _UpdateHostState();
}

class _UpdateHostState extends State<UpdateHost> with WidgetsBindingObserver {
  late final UpdateController controller;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    controller = UpdateController(widget.api);
    WidgetsBinding.instance.addObserver(this);
    updateChannel.setMethodCallHandler((call) async {
      if (call.method == 'progress' && call.arguments is num) {
        controller.progress = (call.arguments as num).toDouble().clamp(0, 1);
        controller.changed();
      }
    });
    unawaited(controller.check());
    timer = Timer.periodic(
      Duration(minutes: 15),
      (_) => unawaited(controller.check()),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(controller.check());
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    updateChannel.setMethodCallHandler(null);
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => UpdateScope(
    controller: controller,
    child: AnimatedBuilder(
      animation: controller,
      builder:
          (context, _) => Column(
            children: [
              if (controller.showNotice)
                Material(
                  color: Color(0xffd6f47c),
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 6,
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.system_update_rounded,
                            color: Color(0xff153d35),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              '${controller.critical ? 'Important update' : 'Update available'} · ${controller.release!.version}',
                              style: TextStyle(
                                color: Color(0xff153d35),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed:
                                () => widget.navigatorKey.currentState?.push(
                                  MaterialPageRoute<void>(
                                    builder:
                                        (_) => UpdatesScreen(
                                          controller: controller,
                                        ),
                                  ),
                                ),
                            child: Text('View'),
                          ),
                          if (!controller.critical)
                            IconButton(
                              onPressed: controller.dismiss,
                              icon: Icon(
                                Icons.close,
                                size: 18,
                                semanticLabel: 'Later',
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              Expanded(child: widget.child),
            ],
          ),
    ),
  );
}

class UpdatesScreen extends StatelessWidget {
  final UpdateController controller;
  const UpdatesScreen({super.key, required this.controller});
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final c = controller, r = c.release;
      return Scaffold(
        appBar: AppBar(title: Text('App updates')),
        body: ListView(
          padding: EdgeInsets.all(24),
          children: [
            Icon(
              Icons.system_update_rounded,
              size: 64,
              color: Color(0xff153d35),
            ),
            SizedBox(height: 20),
            Text(
              c.checking
                  ? 'Checking for updates'
                  : c.error.isNotEmpty && r == null
                  ? 'Check your connection'
                  : r == null
                  ? 'You are up to date'
                  : c.critical
                  ? 'An important update is ready'
                  : 'A fresh update is ready',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 25, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 10),
            Text(
              'Installed: ${c.installed?['version'] ?? '0.4.0'} · SHADOWNET',
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 24),
            if (r != null) ...[
              Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${r.version} · ${(r.bytes / 1000000).toStringAsFixed(1)} MB',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 12),
                      Text(
                        c.notes.isEmpty
                            ? 'Improvements from SHADOWNET.'
                            : c.notes,
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Android 8 or later · ${r.abis.length == 1 && r.abis.first == 'arm64-v8a' ? '64-bit phones' : 'compatible phones'}',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: 16),
              if (!c.supported)
                Text(
                  'This release does not support your Android version or processor. Your current app will keep working.',
                ),
              if (c.downloading) ...[
                LinearProgressIndicator(
                  value: c.progress > 0 ? c.progress : null,
                ),
                SizedBox(height: 12),
                Text(
                  'Downloading and verifying… ${(c.progress * 100).toInt()}%',
                ),
              ],
              if (c.supported && !c.downloading)
                FilledButton.icon(
                  onPressed: c.ready ? c.install : c.download,
                  icon: Icon(
                    c.ready ? Icons.install_mobile : Icons.download_rounded,
                  ),
                  label: Text(c.ready ? 'Install update' : 'Download update'),
                ),
              SizedBox(height: 14),
              Text(
                'Finish any call or live session before installing. Android asks you to approve installation. Your login and account data are kept.',
              ),
              SizedBox(height: 16),
              ExpansionTile(
                title: Text('Verification details'),
                children: [
                  SelectableText(
                    'SHA-256\n${r.sha256}\n\nThe download is checked for size, checksum, app identity, processor support and your existing Android signing key before installation.',
                  ),
                ],
              ),
            ],
            if (c.message.isNotEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 18),
                child: Text(c.message),
              ),
            if (c.error.isNotEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 18),
                child: Text(
                  c.error,
                  style: TextStyle(color: Colors.red.shade800),
                ),
              ),
            SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed:
                  c.checking || c.downloading
                      ? null
                      : () => c.check(manual: true),
              icon:
                  c.checking
                      ? SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                      : Icon(Icons.refresh),
              label: Text(c.checking ? 'Checking…' : 'Check for updates'),
            ),
            SizedBox(height: 24),
            Text(
              'Your community rules, account permissions and announcements update remotely from the office.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54),
            ),
          ],
        ),
      );
    },
  );
}
