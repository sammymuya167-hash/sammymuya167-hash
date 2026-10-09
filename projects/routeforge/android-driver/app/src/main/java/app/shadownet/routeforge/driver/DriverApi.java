package app.shadownet.routeforge.driver;

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
 static JSONObject cached(Context c){try{return Session.cachedState(c);}catch(Exception ignored){return new JSONObject();}}
 static boolean hasActive(Context c){JSONObject a=cached(c).optJSONObject("assignment");if(a==null)return false;JSONArray stops=a.optJSONArray("stops");if(stops!=null)for(int i=0;i<stops.length();i++)if(stops.optJSONObject(i).isNull("deliveredAt"))return true;return false;}
 static boolean completedLocally(Context c,JSONObject a){if(a==null)return false;if(!a.optString("orderId").isEmpty())return EventQueue.get(c).completedLocally(a.optString("id"));JSONArray stops=a.optJSONArray("stops");if(stops==null||stops.length()==0)return false;for(int i=0;i<stops.length();i++){JSONObject s=stops.optJSONObject(i);if(s.isNull("deliveredAt")&&!EventQueue.get(c).completedStopLocally(a.optString("id"),s.optString("id")))return false;}return true;}
 static boolean canStop(Context c){JSONObject a=cached(c).optJSONObject("assignment");return !hasActive(c)||completedLocally(c,a);}
 static JSONObject nextStop(Context c,JSONObject a){JSONArray stops=a.optJSONArray("stops");if(stops==null)return null;boolean collected=!a.optString("orderId").isEmpty()&&EventQueue.get(c).pending("collected",a.optString("id"));for(int i=0;i<stops.length();i++){JSONObject s=stops.optJSONObject(i);if(s!=null&&s.isNull("deliveredAt")&&!(i==0&&collected)&&!EventQueue.get(c).completedStopLocally(a.optString("id"),s.optString("id")))return s;}return null;}
 static boolean liveOffer(Context c,String orderId){JSONObject data=cached(c);long now=System.currentTimeMillis(),received=data.optLong("receivedAt",0);if(received==0||now-received>15000||hasActive(c)||!TrackingService.running||!gpsEnabled(c))return false;JSONArray offers=data.optJSONArray("offers");long serverNow=data.optLong("serverTime",now)+Math.max(0,now-received);if(offers!=null)for(int i=0;i<offers.length();i++){JSONObject o=offers.optJSONObject(i);if(o!=null&&o.optString("id").equals(orderId)&&o.optLong("offerDeadline",0)>serverNow)return true;}return false;}
 static JSONObject enqueue(Context c,JSONObject command)throws Exception{
  JSONObject session=Session.get(c);if(!Session.loggedIn(c))throw new IllegalStateException("Sign in with your rider account first.");
  command.put("operationId",UUID.randomUUID().toString());EventQueue.get(c).addCommand(session.getString("deviceId"),command);SyncJob.retry(c);return command;
 }
 static synchronized boolean flush(Context c){
  try{
   JSONObject unlink=Session.pendingUnlink(c);
   if(unlink!=null){
    try{Api.post("/api/driver/actions",new JSONObject().put("action","unlink").put("operationId",unlink.getString("operationId")),unlink.getString("token"),12000);}
    catch(Api.Rejected e){if(e.status!=401)throw e;}
    Session.prefs(c).edit().remove("pending_unlink").putString("error","").commit();
   }
   JSONObject session=Session.get(c);if(!Session.loggedIn(c))return EventQueue.get(c).commandCount()==0;
   for(int i=0;i<12;i++){
    JSONObject row=EventQueue.get(c).command();if(row==null){Session.error(c,"");return true;}
    if(!row.getString("deviceId").equals(session.getString("deviceId"))){Session.error(c,"A saved action belongs to an earlier link. Review it before pairing another driver.");return false;}
    // A rejected financial/completion report stays visible until explicitly discarded.
    if(!row.optString("error").isEmpty()){Session.error(c,row.optString("error"));return false;}
    try{Api.post("/api/driver/actions",row.getJSONObject("payload"),session.getString("token"),12000);EventQueue.get(c).commandDone(row.getString("id"));JSONObject completed=row.getJSONObject("payload");if("delivered".equals(completed.optString("action"))&&completed.optString("orderId").matches("[a-fA-F0-9-]{36}"))try{JourneyApi.requestBackup(c,"order",completed.getString("orderId"));}catch(Exception ignored){}}
    catch(Api.Rejected e){
     if(e.status==401){Session.clear(c);c.stopService(new Intent(c,TrackingService.class));Session.error(c,"Your session ended. Sign in to the same rider account to sync saved reports.");}
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
   JSONObject session=Session.get(c);if(!Session.loggedIn(c))return;
   JSONObject response=Api.post("/api/driver/state",new JSONObject().put("appVersion",8).put("onDuty",TrackingService.running&&Session.prefs(c).getBoolean("duty",false)).put("gpsEnabled",gpsEnabled(c)),session.getString("token"),12000);
   JSONObject current=Session.get(c);if(current==null||!current.optString("token").equals(session.optString("token")))return;
   response.put("receivedAt",System.currentTimeMillis());Session.cacheState(c,response);Session.prefs(c).edit().putString("state_error","").apply();DriverAlerts.sync(c,response);
  }catch(Api.Rejected e){if(e.status==401){Session.clear(c);c.stopService(new Intent(c,TrackingService.class));}Session.prefs(c).edit().putString("state_error",e.getMessage()).apply();}
  catch(Exception ignored){Session.prefs(c).edit().putString("state_error","Delivery connection interrupted. Your last assignment is retained. Reconnect or tap Refresh deliveries; offers need a live connection.").apply();}
  finally{polling.set(false);}
 }
 static void clearLink(Context c)throws Exception{
  JSONObject session=Session.get(c);if(session==null){if(Session.pendingUnlink(c)==null){EventQueue.get(c).clear();EventQueue.get(c).clearCommands();Session.clear(c);}return;}
  session.put("operationId",UUID.randomUUID().toString());Session.saveUnlink(c,session);
  EventQueue.get(c).clear();EventQueue.get(c).clearCommands();Session.clear(c);SyncJob.schedule(c);flush(c);
 }
}
