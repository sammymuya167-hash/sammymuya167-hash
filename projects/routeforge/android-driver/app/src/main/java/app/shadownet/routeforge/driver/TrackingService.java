package app.shadownet.routeforge.driver;
import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class TrackingService extends Service implements LocationListener {
 static volatile boolean running=false;
 private LocationManager locations;private ConnectivityManager connectivity;private String trip;private boolean started=false;
 private ScheduledExecutorService sync,offers,commands;
 private final ConnectivityManager.NetworkCallback networkCallback=new ConnectivityManager.NetworkCallback(){@Override public void onAvailable(Network network){if(sync!=null&&!sync.isShutdown())sync.execute(()->Api.sync(getApplicationContext()));if(commands!=null&&!commands.isShutdown())commands.execute(()->DriverApi.flush(getApplicationContext()));}};
 public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId) {
  if(intent!=null&&"PAUSE".equals(intent.getAction())){Session.prefs(this).edit().putBoolean("duty",false).apply();try{DriverApi.enqueue(this,new JSONObject().put("action","pause"));}catch(Exception ignored){}stopSelf();return START_NOT_STICKY;}
  if(started)return START_NOT_STICKY;
  if(Session.get(this)==null||checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED||(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)){stopSelf();return START_NOT_STICKY;}
  try{
   NotificationChannel channel=new NotificationChannel("trip-recording","Trip recording",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);channel.enableVibration(false);channel.setShowBadge(false);getSystemService(NotificationManager.class).createNotificationChannel(channel);
   PendingIntent open=PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   PendingIntent pause=PendingIntent.getService(this,2,new Intent(this,TrackingService.class).setAction("PAUSE"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   Notification notification=new Notification.Builder(this,"trip-recording").setSmallIcon(R.drawable.ic_route).setContentTitle("RouteForge · On duty").setContentText("GPS shared with your office. Open to manage delivery.").setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).addAction(new Notification.Action.Builder(null,"Privacy pause",pause).build()).build();
   if(Build.VERSION.SDK_INT>=29)startForeground(11,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(11,notification);
   locations=getSystemService(LocationManager.class);trip=UUID.randomUUID().toString();record("start");started=true;running=true;Session.prefs(this).edit().putString("trip",trip).putLong("last_fix",0).putBoolean("duty",true).apply();
   DriverApi.enqueue(this,new JSONObject().put("action","start_duty"));
   // Zero displacement also refreshes a stationary rider. Provider callbacks recover after GPS is enabled.
   for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER})if(locations.getAllProviders().contains(provider))locations.requestLocationUpdates(provider,10000,0,this);
   currentFix();sync=Executors.newSingleThreadScheduledExecutor();sync.scheduleWithFixedDelay(()->Api.sync(getApplicationContext()),0,10,TimeUnit.SECONDS);
   offers=Executors.newSingleThreadScheduledExecutor();offers.scheduleWithFixedDelay(()->DriverApi.poll(getApplicationContext()),0,1,TimeUnit.SECONDS);
   commands=Executors.newSingleThreadScheduledExecutor();commands.scheduleWithFixedDelay(()->DriverApi.flush(getApplicationContext()),0,2,TimeUnit.SECONDS);
   connectivity=getSystemService(ConnectivityManager.class);connectivity.registerDefaultNetworkCallback(networkCallback);SyncJob.schedule(this);
   if(!DriverApi.gpsEnabled(this))Session.error(this,"Phone location is off. Enable it; this rider session will recover automatically.");
  }catch(Exception e){Session.error(this,"Could not start duty. Check precise location and notification permissions, then retry.");stopSelf();}
  return START_NOT_STICKY;
 }
 @SuppressWarnings("MissingPermission") private void currentFix(){
  if(locations==null||checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)return;
  for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){
   try{if(!locations.isProviderEnabled(provider))continue;
    if(Build.VERSION.SDK_INT>=30)locations.getCurrentLocation(provider,null,getMainExecutor(),location->{if(location!=null)onLocationChanged(location);});
    else{Location cached=locations.getLastKnownLocation(provider);if(cached!=null&&System.currentTimeMillis()-cached.getTime()<30000)onLocationChanged(cached);}
   }catch(Exception ignored){}
  }
 }
 private void record(String kind)throws Exception {EventQueue.get(this).add(new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind",kind).put("recordedAt",System.currentTimeMillis()));}
 @Override public void onLocationChanged(Location location){
  if(!started||!running)return;
  try{
   long now=System.currentTimeMillis();
   if(now-Session.prefs(this).getLong("last_fix",0)<8000||Math.abs(now-location.getTime())>120000)return;
   JSONObject event=new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind","point").put("recordedAt",location.getTime()).put("lat",location.getLatitude()).put("lng",location.getLongitude()).put("accuracy",Math.max(0,location.getAccuracy()));
   if(location.hasSpeed()&&location.getSpeed()>=0&&location.getSpeed()<=200)event.put("speed",location.getSpeed());if(location.hasBearing())event.put("heading",location.getBearing());
   int battery=getSystemService(BatteryManager.class).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);if(battery>=0&&battery<=100)event.put("battery",battery);
   EventQueue.get(this).add(event);Session.prefs(this).edit().putLong("last_fix",location.getTime()).putString("last_point",event.toString()).apply();
  }catch(Exception e){Session.error(this,"Phone storage could not save this GPS fix. Recording has stopped.");stopSelf();}
 }
 @Override public void onDestroy(){
  running=false;if(locations!=null)locations.removeUpdates(this);if(connectivity!=null)try{connectivity.unregisterNetworkCallback(networkCallback);}catch(Exception ignored){}
  for(ScheduledExecutorService executor:new ScheduledExecutorService[]{sync,offers,commands})if(executor!=null)executor.shutdownNow();
  if(started)try{record("stop");if(Session.prefs(this).getBoolean("duty",false)&&Session.get(this)!=null)DriverApi.enqueue(this,new JSONObject().put("action","pause"));}catch(Exception ignored){}
  Session.prefs(this).edit().remove("trip").putBoolean("duty",false).apply();
  if(Session.get(this)!=null||Session.pendingUnlink(this)!=null){SyncJob.retry(this);new Thread(()->{DriverApi.flush(getApplicationContext());Api.sync(getApplicationContext());},"routeforge-final-sync").start();}
  stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
 }
 @Override public void onProviderDisabled(String provider){Session.error(this,"Phone location is disabled. Enable GPS to resume fixes.");}
 @Override public void onProviderEnabled(String provider){Session.error(this,"");currentFix();}
}
