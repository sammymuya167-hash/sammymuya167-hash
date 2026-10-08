package app.shadownet.routeforge.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.location.LocationManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/** Rider tokens stay native. Commands have durable IDs and are never acknowledged locally. */
final class DriverApi {
 private static final AtomicBoolean polling=new AtomicBoolean();
 static boolean gpsEnabled(Context c){try{LocationManager m=c.getSystemService(LocationManager.class);return android.os.Build.VERSION.SDK_INT>=28?m.isLocationEnabled():m.isProviderEnabled(LocationManager.GPS_PROVIDER);}catch(Exception ignored){return false;}}
 static JSONObject cached(Context c){try{return new JSONObject(Session.prefs(c).getString("rider_state","{}"));}catch(Exception ignored){return new JSONObject();}}
 static boolean hasActive(Context c){JSONObject a=cached(c).optJSONObject("assignment");if(a==null)return false;JSONArray stops=a.optJSONArray("stops");if(stops!=null)for(int i=0;i<stops.length();i++)if(stops.optJSONObject(i).isNull("deliveredAt"))return true;return false;}
 static boolean canStop(Context c){JSONObject a=cached(c).optJSONObject("assignment");return !hasActive(c)||(a!=null&&EventQueue.get(c).completedLocally(a.optString("id")));}
 static JSONObject enqueue(Context c,JSONObject command)throws Exception{
  JSONObject session=Session.get(c);if(session==null)throw new IllegalStateException("Pair the rider phone first.");
  command.put("operationId",UUID.randomUUID().toString());EventQueue.get(c).addCommand(session.getString("deviceId"),command);SyncJob.retry(c);return command;
 }
 static synchronized boolean flush(Context c){
  try{
   JSONObject unlink=Session.pendingUnlink(c);
   if(unlink!=null){
    try{Api.post("/api/driver/actions",new JSONObject().put("action","unlink").put("operationId",unlink.getString("operationId")),unlink.getString("token"),4000);}
    catch(Api.Rejected e){if(e.status!=401)throw e;}
    Session.prefs(c).edit().remove("pending_unlink").putString("error","").commit();
   }
   JSONObject session=Session.get(c);if(session==null)return EventQueue.get(c).commandCount()==0;
   for(int i=0;i<12;i++){
    JSONObject row=EventQueue.get(c).command();if(row==null)return true;
    if(!row.getString("deviceId").equals(session.getString("deviceId"))){Session.error(c,"A saved action belongs to an earlier link. Review it before pairing another driver.");return false;}
    // A rejected financial/completion report stays visible until explicitly discarded.
    if(!row.optString("error").isEmpty()){Session.error(c,row.optString("error"));return false;}
    try{Api.post("/api/driver/actions",row.getJSONObject("payload"),session.getString("token"),4000);EventQueue.get(c).commandDone(row.getString("id"));}
    catch(Api.Rejected e){
     if(e.status==401){Session.clear(c);c.stopService(new Intent(c,TrackingService.class));Session.error(c,"This phone was unlinked by the office. Saved reports remain here for review.");}
     else if(e.status==409||e.status==404||e.status==422)EventQueue.get(c).commandError(row.getString("id"),e.getMessage());
     Session.error(c,e.getMessage());return false;
    }
   }
   return EventQueue.get(c).commandCount()==0;
  }catch(Exception ignored){Session.error(c,"Offline: saved journey and delivery reports will retry when connected.");return false;}
 }
 static void poll(Context c){
  if(!polling.compareAndSet(false,true))return;
  try{
   if(Session.pendingUnlink(c)!=null){flush(c);return;}
   JSONObject session=Session.get(c);if(session==null)return;
   JSONObject response=Api.post("/api/driver/state",new JSONObject().put("appVersion",2).put("onDuty",TrackingService.running&&Session.prefs(c).getBoolean("duty",false)).put("gpsEnabled",gpsEnabled(c)),session.getString("token"),3000);
   response.put("receivedAt",System.currentTimeMillis());Session.prefs(c).edit().putString("rider_state",response.toString()).apply();notifyOffers(c,response);
  }catch(Api.Rejected e){if(e.status==401){Session.clear(c);c.stopService(new Intent(c,TrackingService.class));}Session.error(c,e.getMessage());}
  catch(Exception ignored){/* Retain the last snapshot; UI shows its age, never pretend it is live. */}
  finally{polling.set(false);}
 }
 static void clearLink(Context c)throws Exception{
  JSONObject session=Session.get(c);if(session==null){if(Session.pendingUnlink(c)==null){EventQueue.get(c).clear();EventQueue.get(c).clearCommands();Session.clear(c);}return;}
  session.put("operationId",UUID.randomUUID().toString());Session.saveUnlink(c,session);
  EventQueue.get(c).clear();EventQueue.get(c).clearCommands();Session.clear(c);SyncJob.schedule(c);flush(c);
 }
 private static void notifyOffers(Context c,JSONObject data)throws Exception{
  JSONArray offers=data.optJSONArray("offers");if(offers==null)return;
  NotificationManager manager=c.getSystemService(NotificationManager.class);
  NotificationChannel channel=new NotificationChannel("delivery-offers","Delivery offers",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("New company deliveries. Android notification settings control sound and visibility.");manager.createNotificationChannel(channel);
  String seen=Session.prefs(c).getString("notified","");
  for(int i=0;i<offers.length();i++){
   JSONObject o=offers.getJSONObject(i);String id=o.getString("id");if(seen.contains(id))continue;
   long remaining=o.optLong("offerDeadline")-data.optLong("serverTime");if(remaining<=0)continue;
   PendingIntent open=PendingIntent.getActivity(c,id.hashCode(),new Intent(c,MainActivity.class).putExtra("tab","offers"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
   try{manager.notify(id.hashCode(),new Notification.Builder(c,"delivery-offers").setSmallIcon(R.drawable.ic_route).setContentTitle("New delivery · "+o.optString("title")).setContentText("Open RouteForge to accept. First acceptance wins.").setContentIntent(open).setTimeoutAfter(remaining).setAutoCancel(true).build());}catch(SecurityException ignored){}
   seen=(seen+","+id);if(seen.length()>4000)seen=seen.substring(seen.length()-3000);Session.prefs(c).edit().putString("notified",seen).apply();
  }
 }
}
