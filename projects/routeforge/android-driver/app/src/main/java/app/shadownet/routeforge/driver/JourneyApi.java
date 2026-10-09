package app.shadownet.routeforge.driver;
import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private, encrypted journey archives; restore never adds GPS to the upload queue. */
final class JourneyApi {
 private static String scope(Context c){return "rider-history:"+Session.queueOwner(c);}
 static JSONObject cached(Context c){try{String raw=Session.prefs(c).getString("rider_history_encrypted",null);return raw==null?new JSONObject():Session.unseal(raw,scope(c));}catch(Exception ignored){return new JSONObject();}}
 static synchronized void save(Context c,JSONObject data)throws Exception{Session.prefs(c).edit().putString("rider_history_encrypted",Session.seal(data,scope(c))).commit();}
 static JSONObject call(Context c,JSONObject input)throws Exception{JSONObject s=Session.get(c);if(!Session.loggedIn(c)||s==null)throw new IllegalStateException("Sign in to your rider account.");String owner=s.getString("deviceId"),token=s.getString("token");JSONObject result=Api.post("/api/driver/journeys",input,token);JSONObject current=Session.get(c);if(!Session.loggedIn(c)||current==null||!owner.equals(current.optString("deviceId"))||!token.equals(current.optString("token")))throw new IllegalStateException("The rider account changed. Reopen history.");return result;}
 static void list(Context c)throws Exception{JSONObject data=call(c,new JSONObject().put("action","list")),old=cached(c);if(old.has("selected"))data.put("selected",old.get("selected"));if(old.has("tasks"))data.put("tasks",old.get("tasks"));data.put("localTrips",EventQueue.get(c).journeyList(Session.queueOwner(c))).put("message","History refreshed");save(c,data);}
 static void view(Context c,String kind,String id)throws Exception{validate(kind,id);JSONObject data=cached(c),journey=EventQueue.get(c).journeyFor(Session.queueOwner(c),kind,id,data);data.put("selected",journey).put("message","Viewing saved journey");save(c,data);}
 static void latest(Context c)throws Exception{JSONObject data=cached(c);data.remove("selected");save(c,data);}
 private static void validate(String kind,String id){if(!(kind.equals("trip")||kind.equals("order"))||!id.matches("[a-fA-F0-9-]{36}"))throw new IllegalStateException("Choose a saved trip or delivery.");}
 static synchronized void requestBackup(Context c,String kind,String id)throws Exception{
  validate(kind,id);JSONObject data=cached(c),tasks=data.optJSONArray("tasks");if(tasks==null)tasks=new JSONArray();boolean exists=false;for(int i=0;i<tasks.length();i++)if(tasks.getJSONObject(i).getString("kind").equals(kind)&&tasks.getJSONObject(i).getString("id").equals(id))exists=true;if(!exists){if(tasks.length()>=30)throw new IllegalStateException("Wait for your saved backups to finish.");tasks.put(new JSONObject().put("kind",kind).put("id",id));}data.put("tasks",tasks).put("message","Backup queued. Saved GPS syncs first; reconnect to finish.");save(c,data);SyncJob.retry(c);
 }
 static synchronized void flush(Context c){
  if(!Session.loggedIn(c)||EventQueue.get(c).count()>0)return;long began=android.os.SystemClock.elapsedRealtime();
  try{JSONObject data=cached(c);JSONArray tasks=data.optJSONArray("tasks");if(tasks==null||tasks.length()==0)return;
   JSONObject task=tasks.getJSONObject(0);for(int i=0;i<12;i++){JSONObject result=call(c,new JSONObject(task.toString()).put("action","backup"));if(result.optBoolean("complete")){JSONArray remaining=new JSONArray();for(int j=1;j<tasks.length();j++)remaining.put(tasks.get(j));data=cached(c).put("tasks",remaining).put("message","Journey backed up securely");save(c,data);return;}if(result.optBoolean("busy")||android.os.SystemClock.elapsedRealtime()-began>20000)break;}
   SyncJob.retry(c);
  }catch(Exception e){try{save(c,cached(c).put("message",e instanceof Api.Rejected?e.getMessage():"Backup remains queued; it will retry when connected."));}catch(Exception ignored){}SyncJob.retry(c);}
 }
 static void restore(Context c,String kind,String id)throws Exception{
  validate(kind,id);String cursor=null;JSONArray collected=new JSONArray();int total=0;
  // Restore one durable page at a time. A repeated restore merges by original event ID.
  for(int page=0;page<200;page++){JSONObject request=new JSONObject().put("action","restore").put("kind",kind).put("id",id);if(cursor!=null)request.put("cursor",cursor);JSONObject result=call(c,request);JSONArray events=result.getJSONArray("events");EventQueue.get(c).restoreJourney(Session.queueOwner(c),events);for(int i=0;i<events.length();i++){JSONObject event=events.getJSONObject(i);if(event.optString("kind").equals("point"))collected.put(event);}total=result.optInt("points");cursor=result.isNull("nextCursor")?null:result.optString("nextCursor",null);if(cursor==null)break;}
  if(cursor!=null)throw new IllegalStateException("This archive is very large. Its restored pages are saved; run Restore again to continue.");
  JSONObject data=cached(c);save(c,data.put("selected",new JSONObject().put("kind",kind).put("sourceId",id).put("points",collected).put("total",collected.length()).put("pending",0).put("synced",collected.length()).put("shown",collected.length()).put("restored",true)).put("message","Cloud journey restored · original timestamps retained"));
 }
}
