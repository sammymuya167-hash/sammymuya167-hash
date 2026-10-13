package app.shadownet.routeforge.driver;
import android.content.Context;
import android.location.Location;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

/** Separate from timed-offer polling and the durable completion queue. */
final class RoadApi {
 private static final AtomicBoolean loading=new AtomicBoolean();
 private static String lastKey="";private static long lastAttempt=0;
 static void pause(Context c){OfflineRoads.cancel();JSONObject a=DriverApi.cached(c).optJSONObject("assignment"),s=a==null?null:DriverApi.nextStop(c,a);if(s!=null)Session.prefs(c).edit().putString("roads_paused_key",a.optString("id")+":"+s.optString("id")).apply();}
 static boolean loading(){return loading.get();}
 static JSONArray cached(Context c){try{String value=Session.prefs(c).getString("rider_roads_encrypted",null);return value==null?new JSONArray():Session.unseal(value,"rider-roads:"+Session.queueOwner(c)).getJSONArray("routes");}catch(Exception ignored){return new JSONArray();}}
 static JSONObject issue(Context c){try{JSONObject value=new JSONObject(Session.prefs(c).getString("road_issue","{}")),a=DriverApi.cached(c).optJSONObject("assignment");return a!=null&&a.optString("id").equals(value.optString("dispatchId"))?value:new JSONObject();}catch(Exception ignored){return new JSONObject();}}
 static synchronized void clear(Context c){Session.prefs(c).edit().remove("rider_roads_encrypted").remove("road_issue").commit();lastKey="";lastAttempt=0;}
 static boolean fetch(Context c,String dispatchId,String stopId,boolean force){
  if(!Session.loggedIn(c)||!TrackingService.running||!DriverApi.gpsEnabled(c)||!loading.compareAndSet(false,true))return false;
  boolean attempted=false;
  try{
   JSONObject session=Session.get(c),a=DriverApi.cached(c).optJSONObject("assignment");if(a==null||!dispatchId.equals(a.optString("id"))||DriverApi.completedLocally(c,a))return false;
   JSONObject stop=DriverApi.nextStop(c,a);if(stop==null||!stopId.equals(stop.optString("id")))return false;
   JSONObject point=new JSONObject(Session.prefs(c).getString("last_point","{}"));long now=System.currentTimeMillis();
   if(Math.abs(now-point.optLong("recordedAt",0))>120000||point.optDouble("accuracy",999)>100)return false;
   String key=dispatchId+":"+stopId;if(!force&&key.equals(Session.prefs(c).getString("roads_paused_key","")))return false;if(force)Session.prefs(c).edit().remove("roads_paused_key").apply();
   synchronized(RoadApi.class){if(key.equals(lastKey)&&now-lastAttempt<(force?5000:20000))return false;}
   JSONArray existing=cached(c);
   for(int i=0;i<existing.length();i++){JSONObject r=existing.getJSONObject(i),from=r.getJSONObject("from");if(!force&&dispatchId.equals(r.optString("dispatchId"))&&stopId.equals(r.optString("stopId"))){float[] distance=new float[1];Location.distanceBetween(from.getDouble("lat"),from.getDouble("lng"),point.getDouble("lat"),point.getDouble("lng"),distance);if(now-r.optLong("calculatedAt",0)<120000&&distance[0]<60)return false;}}
   synchronized(RoadApi.class){lastKey=key;lastAttempt=now;attempted=true;}
   JSONObject origin=new JSONObject().put("lat",point.getDouble("lat")).put("lng",point.getDouble("lng")).put("accuracy",point.getDouble("accuracy")).put("recordedAt",point.getLong("recordedAt"));
   JSONObject route=OfflineRoads.route(c,origin,stop,DriverApi.cached(c).optString("routingProfile","driving")).put("dispatchId",dispatchId).put("stopId",stopId);
   synchronized(Session.class){JSONObject current=Session.get(c),assignment=DriverApi.cached(c).optJSONObject("assignment");if(!Session.loggedIn(c)||!TrackingService.running||key.equals(Session.prefs(c).getString("roads_paused_key",""))||current==null||!current.optString("token").equals(session.optString("token"))||assignment==null||!dispatchId.equals(assignment.optString("id")))return false;
    JSONObject target=DriverApi.nextStop(c,assignment);if(target==null||!stopId.equals(target.optString("id")))return false;
    JSONArray routes=new JSONArray();for(int i=0;i<existing.length();i++){JSONObject r=existing.getJSONObject(i);if(dispatchId.equals(r.optString("dispatchId"))&&!stopId.equals(r.optString("stopId")))routes.put(r);}routes.put(route);
    Session.prefs(c).edit().putString("rider_roads_encrypted",Session.seal(new JSONObject().put("routes",routes),"rider-roads:"+Session.queueOwner(c))).remove("road_issue").commit();
   }
   return true;
  }catch(Exception e){try{Session.prefs(c).edit().putString("road_issue",new JSONObject().put("dispatchId",dispatchId).put("stopId",stopId).put("error",e instanceof IllegalStateException?e.getMessage():"Road route could not refresh. A saved route is retained; reconnect or open road navigation.").toString()).apply();}catch(Exception ignored){}return attempted;}
  finally{OfflineRoads.progress="";loading.set(false);}
 }
}
