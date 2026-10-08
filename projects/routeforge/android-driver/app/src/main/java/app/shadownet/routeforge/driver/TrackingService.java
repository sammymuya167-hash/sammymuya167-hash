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
 private ScheduledExecutorService sync;
 private final ConnectivityManager.NetworkCallback networkCallback=new ConnectivityManager.NetworkCallback(){@Override public void onAvailable(Network network){if(sync!=null&&!sync.isShutdown())sync.execute(()->Api.sync(getApplicationContext()));}};
 public IBinder onBind(Intent intent){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId) {
  if(intent!=null&&"STOP".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
  if(started)return START_NOT_STICKY;
  if(Session.get(this)==null||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)!=PackageManager.PERMISSION_GRANTED|| (Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)){stopSelf();return START_NOT_STICKY;}
  try{
   NotificationChannel channel=new NotificationChannel("trip-recording","Trip recording",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);channel.enableVibration(false);channel.setShowBadge(false);getSystemService(NotificationManager.class).createNotificationChannel(channel);
   PendingIntent open=PendingIntent.getActivity(this,1,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   PendingIntent stop=PendingIntent.getService(this,2,new Intent(this,TrackingService.class).setAction("STOP"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   Notification notification=new Notification.Builder(this,"trip-recording").setSmallIcon(R.drawable.ic_route).setContentTitle("RouteForge · Trip recording").setContentText("GPS is shared with your dispatcher. Tap Stop to end.").setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).addAction(new Notification.Action.Builder(null,"Stop trip",stop).build()).build();
   if(Build.VERSION.SDK_INT>=29)startForeground(11,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(11,notification);
   locations=getSystemService(LocationManager.class);
   if(Build.VERSION.SDK_INT>=28 ? !locations.isLocationEnabled() : !locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){Session.error(this,"Enable phone location before starting a trip.");stopSelf();return START_NOT_STICKY;}
   trip=UUID.randomUUID().toString();record("start");started=true;running=true;Session.prefs(this).edit().putString("trip",trip).putLong("last_fix",0).apply();
   boolean provider=false;
   if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,15000,5,this);provider=true;}
   if(locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)){locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,15000,5,this);provider=true;}
   if(!provider){Session.error(this,"No usable location provider. Allow precise location and enable GPS.");stopSelf();return START_NOT_STICKY;}
   sync=Executors.newSingleThreadScheduledExecutor();sync.scheduleWithFixedDelay(()->Api.sync(getApplicationContext()),0,10,TimeUnit.SECONDS);
   connectivity=getSystemService(ConnectivityManager.class);connectivity.registerDefaultNetworkCallback(networkCallback);SyncJob.schedule(this);Session.error(this,"");
  }catch(Exception e){Session.error(this,"Could not start recording. Check location and notification permissions, then try again.");stopSelf();}
  return START_NOT_STICKY; // Never secretly restart location capture after reboot or an OS stop.
 }
 private void record(String kind)throws Exception {EventQueue.get(this).add(new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind",kind).put("recordedAt",System.currentTimeMillis()));}
 @Override public void onLocationChanged(Location location){
  if(!started||!running)return;
  try{
   long now=System.currentTimeMillis();
   if(now-Session.prefs(this).getLong("last_fix",0)<10000)return;
   // Ignore cached fixes: preserve capture time instead of relabelling an old location as live.
   if(Math.abs(now-location.getTime())>120000)return;
   JSONObject event=new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind","point").put("recordedAt",location.getTime()).put("lat",location.getLatitude()).put("lng",location.getLongitude()).put("accuracy",Math.max(0,location.getAccuracy()));
   if(location.hasSpeed()&&location.getSpeed()>=0&&location.getSpeed()<=200)event.put("speed",location.getSpeed());
   if(location.hasBearing())event.put("heading",location.getBearing());
   int battery=getSystemService(BatteryManager.class).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);if(battery>=0&&battery<=100)event.put("battery",battery);
   EventQueue.get(this).add(event);Session.prefs(this).edit().putLong("last_fix",now).apply();
  }catch(Exception e){Session.error(this,"Could not save this GPS fix. Stop recording and check phone storage.");stopSelf();}
 }
 @Override public void onDestroy(){
  running=false;if(locations!=null)locations.removeUpdates(this);
  if(connectivity!=null)try{connectivity.unregisterNetworkCallback(networkCallback);}catch(Exception ignored){}
  if(sync!=null)sync.shutdownNow();
  if(started)try{record("stop");}catch(Exception e){Session.error(this,"Could not save the trip end.");}
  Session.prefs(this).edit().remove("trip").apply();if(Session.get(this)!=null){SyncJob.retry(this);new Thread(()->Api.sync(getApplicationContext()),"routeforge-final-sync").start();}
  stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();
 }
 @Override public void onProviderDisabled(String provider){Session.error(this,"Location provider disabled. Recording may have a gap.");}
}
