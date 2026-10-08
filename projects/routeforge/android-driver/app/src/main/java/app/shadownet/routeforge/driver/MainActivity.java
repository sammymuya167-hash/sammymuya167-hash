package app.shadownet.routeforge.driver;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Only the packaged, offline UI is bridged. No credentials are exposed to JavaScript. */
public final class MainActivity extends Activity {
 private WebView web;private boolean busy=false,ready=false;private final Handler handler=new Handler(Looper.getMainLooper());
 private final ExecutorService work=Executors.newSingleThreadExecutor(),poll=Executors.newSingleThreadExecutor();
 private final Runnable update=new Runnable(){public void run(){publish();if(Session.get(MainActivity.this)!=null&&!TrackingService.running)poll.execute(()->DriverApi.poll(getApplicationContext()));handler.postDelayed(this,1000);}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);getWindow().setStatusBarColor(Color.rgb(8,16,32));getWindow().setNavigationBarColor(Color.rgb(8,16,32));web=new WebView(this);web.setBackgroundColor(Color.rgb(8,16,32));web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.getSettings().setDomStorageEnabled(false);web.getSettings().setUserAgentString(web.getSettings().getUserAgentString()+" RouteForgeRider/1.0 (+"+Session.API+")");web.addJavascriptInterface(new Bridge(),"Rider");web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}@Override public void onPageFinished(WebView view,String url){ready=true;publish();String tab=getIntent().getStringExtra("tab");if("offers".equals(tab))web.evaluateJavascript("go('offers')",null);}});setContentView(web);try(java.io.InputStream input=getAssets().open("rider.html")){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] chunk=new byte[4096];int n;while((n=input.read(chunk))!=-1)out.write(chunk,0,n);web.loadDataWithBaseURL(Session.API+"/rider-native/",out.toString("UTF-8"),"text/html","UTF-8",null);}catch(Exception ignored){Session.error(this,"Could not load the packaged rider interface.");}}
 private void publish(){if(!ready)return;try{JSONObject session=Session.get(this);JSONObject state=new JSONObject().put("paired",session!=null).put("unlinkPending",Session.pendingUnlink(this)!=null).put("driver",Session.prefs(this).getString("driver","")).put("recording",TrackingService.running).put("gpsEnabled",DriverApi.gpsEnabled(this)).put("lastFix",Session.prefs(this).getLong("last_fix",0)).put("lastSync",Session.prefs(this).getLong("last_sync",0)).put("events",EventQueue.get(this).count()).put("commands",EventQueue.get(this).commands()).put("canStop",DriverApi.canStop(this)).put("error",Session.prefs(this).getString("error","")).put("busy",busy).put("data",DriverApi.cached(this));String point=Session.prefs(this).getString("last_point",null);if(point!=null)state.put("point",new JSONObject(point));web.evaluateJavascript("applyState("+state.toString().replace("\u2028","\\u2028").replace("\u2029","\\u2029")+")",null);}catch(Exception ignored){}}
 private void background(Runnable task){if(busy)return;busy=true;publish();work.execute(()->{try{task.run();}finally{runOnUiThread(()->{busy=false;publish();});}});}
 private void startDuty(){if(Session.get(this)==null){Session.error(this,"Pair this phone first.");publish();return;}
  ArrayList<String> permissions=new ArrayList<>();if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)permissions.add(Manifest.permission.POST_NOTIFICATIONS);
  if(!permissions.isEmpty()){requestPermissions(permissions.toArray(new String[0]),9);return;}try{Session.error(this,"");startForegroundService(new Intent(this,TrackingService.class));}catch(Exception ignored){Session.error(this,"Could not start duty. Open Android permission settings and retry.");}publish();
 }
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==9){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&(Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED))startDuty();else Session.error(this,"Allow precise location and notifications in Android settings to start duty.");publish();}}
 private void stopDuty(boolean privacy){
  if(privacy){try{DriverApi.enqueue(this,new JSONObject().put("action","pause"));}catch(Exception ignored){}Session.prefs(this).edit().putBoolean("duty",false).apply();stopService(new Intent(this,TrackingService.class));SyncJob.retry(this);publish();return;}
  if(!DriverApi.canStop(this)){Session.error(this,"Finish the current delivery before ending duty. Privacy pause is always available.");publish();return;}
  background(()->{try{JSONObject session=Session.get(this);if(session==null)return;JSONObject command=new JSONObject().put("action","stop_duty").put("operationId",UUID.randomUUID().toString());JSONObject assignment=DriverApi.cached(this).optJSONObject("assignment");boolean localDone=assignment!=null&&EventQueue.get(this).completedLocally(assignment.optString("id"));
   if(localDone||EventQueue.get(this).commandCount()>0)EventQueue.get(this).addCommand(session.getString("deviceId"),command);else Api.post("/api/driver/actions",command,session.getString("token"),4000);
   Session.prefs(this).edit().putBoolean("duty",false).apply();runOnUiThread(()->stopService(new Intent(this,TrackingService.class)));SyncJob.retry(this);DriverApi.flush(this);DriverApi.poll(this);
  }catch(Exception e){Session.error(this,e instanceof Api.Rejected?e.getMessage():"Connect to confirm duty has ended, or use Privacy pause now.");}});
 }
 public final class Bridge {
  @JavascriptInterface public void pair(String code,boolean agreed){runOnUiThread(()->{if(!agreed){Session.error(MainActivity.this,"Agree to location sharing before pairing.");publish();return;}if(Session.get(MainActivity.this)!=null||Session.pendingUnlink(MainActivity.this)!=null)return;background(()->{try{if(EventQueue.get(MainActivity.this).count()>0||EventQueue.get(MainActivity.this).commandCount()>0)throw new IllegalStateException("Review the saved queue before pairing another phone link.");JSONObject response=Api.post("/api/tracking/pair",new JSONObject().put("code",code.trim()).put("deviceName",Build.MANUFACTURER+" "+Build.MODEL).put("appVersion",2),null);Session.save(MainActivity.this,response);SyncJob.schedule(MainActivity.this);runOnUiThread(MainActivity.this::startDuty);}catch(Exception e){Session.error(MainActivity.this,e instanceof Api.Rejected||e instanceof IllegalStateException?e.getMessage():"Could not pair. Check your internet and pairing code.");}});});}
  @JavascriptInterface public void start(){runOnUiThread(MainActivity.this::startDuty);}
  @JavascriptInterface public void stop(){runOnUiThread(()->stopDuty(false));}
  @JavascriptInterface public void privacy(){runOnUiThread(()->new AlertDialog.Builder(MainActivity.this).setTitle("Pause location sharing?").setMessage("GPS stops immediately. Any unfinished delivery stays open for office follow-up; it is not marked delivered or paid.").setNegativeButton("Keep sharing",null).setPositiveButton("Pause GPS",(d,w)->stopDuty(true)).show());}
  @JavascriptInterface public void sync(){runOnUiThread(()->background(()->{DriverApi.flush(MainActivity.this);Api.sync(MainActivity.this);DriverApi.poll(MainActivity.this);}));}
  @JavascriptInterface public void settings(){runOnUiThread(()->startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));}
  @JavascriptInterface public void permissions(){runOnUiThread(()->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()))));}
  @JavascriptInterface public void action(String raw){runOnUiThread(()->background(()->{try{JSONObject input=new JSONObject(raw);String action=input.optString("action");if(!action.equals("accept")&&!action.equals("collected")&&!action.equals("delivered")&&!action.equals("payment"))throw new IllegalArgumentException("Unknown rider action.");if(action.equals("accept")){JSONObject session=Session.get(MainActivity.this);if(session==null)return;input.put("operationId",UUID.randomUUID().toString());Api.post("/api/driver/actions",input,session.getString("token"),3000);}else{DriverApi.enqueue(MainActivity.this,input);DriverApi.flush(MainActivity.this);}DriverApi.poll(MainActivity.this);}catch(Exception e){Session.error(MainActivity.this,e instanceof Api.Rejected?e.getMessage():"Saved reports are safe. Connect and retry; do not submit a second payment.");}}));}
  @JavascriptInterface public void discard(String id){runOnUiThread(()->new AlertDialog.Builder(MainActivity.this).setTitle("Discard rejected report?").setMessage("This removes a rejected local action, not a completed server record. Check with the office before deleting a payment report.").setNegativeButton("Keep",null).setPositiveButton("Discard",(d,w)->{EventQueue.get(MainActivity.this).commandDone(id);publish();SyncJob.retry(MainActivity.this);}).show());}
  @JavascriptInterface public void unlink(){runOnUiThread(()->new AlertDialog.Builder(MainActivity.this).setTitle("Unlink rider phone and clear queue?").setMessage("This ends duty and deletes "+EventQueue.get(MainActivity.this).count()+" unsent GPS events and "+EventQueue.get(MainActivity.this).commandCount()+" local delivery reports. Uploaded history stays in the office. Any unfinished assignment is cancelled for office follow-up. If offline, the unlink request retries securely when connected.").setNegativeButton("Keep link",null).setPositiveButton("Unlink",(d,w)->{Session.prefs(MainActivity.this).edit().putBoolean("duty",false).apply();stopService(new Intent(MainActivity.this,TrackingService.class));background(()->{try{DriverApi.clearLink(MainActivity.this);}catch(Exception ignored){Session.error(MainActivity.this,"Could not save the unlink request. The phone link has been retained.");}});}).show());}
  @JavascriptInterface public void navigate(){runOnUiThread(()->{try{JSONObject a=DriverApi.cached(MainActivity.this).optJSONObject("assignment");if(a==null)return;JSONArray stops=a.getJSONArray("stops");for(int i=0;i<stops.length();i++){JSONObject stop=stops.getJSONObject(i);if(!stop.isNull("deliveredAt"))continue;double lat=stop.getDouble("lat"),lng=stop.getDouble("lng");if(!Double.isFinite(lat)||!Double.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)return;startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.google.com/maps/dir/?api=1&destination="+lat+","+lng+"&travelmode=driving")));break;}}catch(Exception ignored){Session.error(MainActivity.this,"A navigation app could not be opened.");publish();}});}
 }
 @Override protected void onResume(){super.onResume();handler.post(update);}
 @Override protected void onPause(){handler.removeCallbacks(update);super.onPause();}
 @Override protected void onDestroy(){handler.removeCallbacks(update);work.shutdown();poll.shutdown();web.removeJavascriptInterface("Rider");web.destroy();super.onDestroy();}
}
