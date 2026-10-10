package app.shadownet.routeforge.driver;
import android.content.Context;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;

/** Public release metadata only. No rider token leaves the native API. */
final class UpdateApi {
 private static final String CERT="e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c";
 static long installedVersion(Context c){try{android.content.pm.PackageInfo info=c.getPackageManager().getPackageInfo(c.getPackageName(),0);return android.os.Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;}catch(android.content.pm.PackageManager.NameNotFoundException e){throw new IllegalStateException("Installed rider version is unavailable.",e);}}
 static String installedName(Context c){try{return c.getPackageManager().getPackageInfo(c.getPackageName(),0).versionName.replace("-rider","");}catch(android.content.pm.PackageManager.NameNotFoundException e){throw new IllegalStateException("Installed rider version is unavailable.",e);}}
 static JSONObject cached(Context c){try{JSONObject r=new JSONObject(Session.prefs(c).getString("rider_update","{}"));if(r.has("versionCode")){validate(r);boolean newer=r.optInt("versionCode")>installedVersion(c);r.put("available",newer);if(!newer)r.put("message","Your rider app is up to date");}return r;}catch(Exception ignored){return new JSONObject();}}
 static JSONObject validate(JSONObject r){if(!"app.shadownet.routeforge.rider".equals(r.optString("applicationId"))||!CERT.equals(r.optString("certificateSha256"))||!r.optString("apkSha256").matches("[a-f0-9]{64}")||!r.optString("versionedApkPath").matches("/downloads/routeforge-rider-[0-9]+\\.[0-9]+\\.apk")||r.optInt("versionCode")<1)throw new IllegalStateException("Release identity could not be verified.");return r;}
 static synchronized void check(Context c,boolean force){long now=System.currentTimeMillis();if(!force&&now-Session.prefs(c).getLong("update_checked_at",0)<3600000)return;
  HttpURLConnection connection=null;try{connection=(HttpURLConnection)new URL(Session.API+"/downloads/routeforge-rider-release.json?check="+now).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(7000);connection.setReadTimeout(7000);if(connection.getResponseCode()!=200)throw new java.io.IOException("Release not available");java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();try(java.io.InputStream in=connection.getInputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(out.size()+n>32768)throw new java.io.IOException("Invalid release size");out.write(b,0,n);}}JSONObject r=validate(new JSONObject(out.toString("UTF-8")));boolean newer=r.getInt("versionCode")>installedVersion(c);r.put("available",newer).put("checkedAt",now).put("message",newer?"Rider "+r.optString("versionName")+" is available":"Your rider app is up to date");Session.prefs(c).edit().putString("rider_update",r.toString()).putLong("update_checked_at",now).apply();
   if(newer&&Session.prefs(c).getInt("update_notified_version",0)!=r.getInt("versionCode")){NotificationManager manager=c.getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("rider_updates","Rider app updates",NotificationManager.IMPORTANCE_DEFAULT));PendingIntent intent=PendingIntent.getActivity(c,803,new Intent(c,MainActivity.class).putExtra("tab","account").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);if(manager.areNotificationsEnabled()){manager.notify(803,new Notification.Builder(c,"rider_updates").setSmallIcon(R.drawable.ic_route).setContentTitle("RouteForge Rider update available").setContentText("Tap to install "+r.optString("versionName")+" over your existing app. Saved work stays on this phone.").setContentIntent(intent).setAutoCancel(true).build());Session.prefs(c).edit().putInt("update_notified_version",r.getInt("versionCode")).apply();}}
  }catch(Exception e){try{JSONObject r=cached(c);r.put("message","Could not check updates. Reconnect and try again.");Session.prefs(c).edit().putString("rider_update",r.toString()).apply();}catch(Exception ignored){}}finally{if(connection!=null)connection.disconnect();}
 }
 static String downloadUrl(Context c){try{JSONObject r=validate(cached(c));if(r.optBoolean("available"))return Session.API+r.getString("versionedApkPath");}catch(Exception ignored){}return Session.API+"/login";}
}
