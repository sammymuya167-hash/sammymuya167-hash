package app.shadownet.routeforge.driver;
import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.Set;
final class EventQueue extends SQLiteOpenHelper {
 private static EventQueue instance;
 private final Context context;
 private long revision=0,cachedRevision=-1;private String cachedOwner="";private JSONObject cachedJourney;
 static synchronized EventQueue get(Context c){if(instance==null)instance=new EventQueue(c.getApplicationContext());return instance;}
 private EventQueue(Context c){super(c,"journey.sqlite",null,3);context=c;}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE events(id TEXT PRIMARY KEY, recorded_at INTEGER NOT NULL, payload TEXT NOT NULL)");db.execSQL("CREATE INDEX queue_time ON events(recorded_at,id)");commandsSchema(db);journeySchema(db);}
 private void commandsSchema(SQLiteDatabase db){db.execSQL("CREATE TABLE IF NOT EXISTS commands(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,device_id TEXT NOT NULL,payload TEXT NOT NULL,last_error TEXT NOT NULL DEFAULT '')");}
 private void journeySchema(SQLiteDatabase db){db.execSQL("CREATE TABLE IF NOT EXISTS journey_points(device_id TEXT NOT NULL,id TEXT NOT NULL,trip_id TEXT NOT NULL,recorded_at INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(device_id,id))");db.execSQL("CREATE INDEX IF NOT EXISTS journey_trip_time ON journey_points(device_id,trip_id,recorded_at,id)");db.execSQL("CREATE INDEX IF NOT EXISTS journey_owner_time ON journey_points(device_id,recorded_at,id)");}
 public void onUpgrade(SQLiteDatabase db,int old,int next){if(old<2)commandsSchema(db);if(old<3)journeySchema(db);}
 private JSONObject readEvent(String id,String raw)throws Exception{JSONObject wrapper=new JSONObject(raw);return wrapper.has("sealed")?Session.unseal(wrapper.getString("sealed"),"rider-gps:"+wrapper.getString("deviceId")+":"+id):wrapper;}
 private void retain(SQLiteDatabase db,String owner,JSONObject event)throws Exception{
  if(owner.isEmpty()||!event.optString("kind").equals("point"))return;
  ContentValues row=new ContentValues();row.put("device_id",owner);row.put("id",event.getString("eventId"));row.put("trip_id",event.getString("tripId"));row.put("recorded_at",event.getLong("recordedAt"));row.put("payload",Session.seal(event,"rider-journey:"+owner+":"+event.getString("eventId")));db.insertWithOnConflict("journey_points",null,row,SQLiteDatabase.CONFLICT_IGNORE);
 }
 synchronized void add(JSONObject event) throws Exception {
  String owner=Session.queueOwner(context),id=event.getString("eventId"),raw=event.toString();
  if(!owner.isEmpty())raw=new JSONObject().put("deviceId",owner).put("sealed",Session.seal(event,"rider-gps:"+owner+":"+id)).toString();
  ContentValues row=new ContentValues();row.put("id",id);row.put("recorded_at",event.getLong("recordedAt"));row.put("payload",raw);
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.insertOrThrow("events",null,row);retain(db,owner,event);db.setTransactionSuccessful();}finally{db.endTransaction();}
  revision++;
  if(cachedJourney!=null&&cachedOwner.equals(owner)&&event.optString("kind").equals("point")){
   String trip=event.getString("tripId");JSONArray points=cachedJourney.getJSONArray("points");
   if(!trip.equals(cachedJourney.optString("tripId"))){points=new JSONArray();cachedJourney=new JSONObject().put("tripId",trip).put("total",0).put("pending",0).put("synced",0);}
   points.put(event);if(points.length()>3000){JSONArray recent=new JSONArray();for(int i=points.length()-3000;i<points.length();i++)recent.put(points.getJSONObject(i));points=recent;}
   cachedJourney.put("points",points).put("shown",points.length()).put("total",cachedJourney.getInt("total")+1).put("pending",cachedJourney.getInt("pending")+1);cachedRevision=revision;
  }
 }
 synchronized JSONArray batch() throws Exception {JSONArray result=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT id,payload FROM events ORDER BY recorded_at,id LIMIT 50",null)){while(c.moveToNext())result.put(readEvent(c.getString(0),c.getString(1)));}return result;}
 synchronized void acknowledge(JSONArray batch,JSONArray acknowledgements) throws Exception {
  Set<String> sent=new HashSet<>();for(int i=0;i<batch.length();i++)sent.add(batch.getJSONObject(i).getString("eventId"));
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
  int acceptedPoints=0;
  try{for(int i=0;i<acknowledgements.length();i++){String id=acknowledgements.getString(i);if(!sent.contains(id))throw new IllegalArgumentException("Unexpected acknowledgement");JSONObject event=null;for(int n=0;n<batch.length();n++)if(batch.getJSONObject(n).getString("eventId").equals(id)){event=batch.getJSONObject(n);retain(db,Session.queueOwner(context),event);break;}int deleted=db.delete("events","id=?",new String[]{id});if(deleted>0&&cachedJourney!=null&&event!=null&&event.optString("kind").equals("point")&&event.optString("tripId").equals(cachedJourney.optString("tripId")))acceptedPoints++;}db.setTransactionSuccessful();}finally{db.endTransaction();}
  revision++;if(cachedJourney!=null&&cachedOwner.equals(Session.queueOwner(context))){cachedJourney.put("pending",Math.max(0,cachedJourney.getInt("pending")-acceptedPoints)).put("synced",cachedJourney.getInt("synced")+acceptedPoints);cachedRevision=revision;}
 }
 synchronized JSONObject journey(String owner)throws Exception{
  if(owner.isEmpty())return new JSONObject();
  if(cachedJourney!=null&&cachedRevision==revision&&cachedOwner.equals(owner))return cachedJourney;
  SQLiteDatabase db=getWritableDatabase();
  // Backfill existing 1.2–1.4 offline points without altering their receipt IDs.
  if(owner.equals(Session.queueOwner(context)))try(Cursor c=db.rawQuery("SELECT e.id,e.payload FROM events e WHERE NOT EXISTS(SELECT 1 FROM journey_points p WHERE p.device_id=? AND p.id=e.id) ORDER BY recorded_at DESC LIMIT 3000",new String[]{owner})){while(c.moveToNext())retain(db,owner,readEvent(c.getString(0),c.getString(1)));}
  db.execSQL("DELETE FROM journey_points WHERE device_id=? AND NOT EXISTS(SELECT 1 FROM events e WHERE e.id=journey_points.id) AND (recorded_at<? OR id NOT IN(SELECT id FROM journey_points WHERE device_id=? ORDER BY recorded_at DESC,id DESC LIMIT 20000))",new Object[]{owner,System.currentTimeMillis()-30L*86400000,owner});
  String trip="";try(Cursor c=db.rawQuery("SELECT trip_id FROM journey_points WHERE device_id=? ORDER BY recorded_at DESC,id DESC LIMIT 1",new String[]{owner})){if(c.moveToFirst())trip=c.getString(0);}
  JSONArray points=new JSONArray();int total=0,pending=0;
  if(!trip.isEmpty()){
   try(Cursor c=db.rawQuery("SELECT COUNT(*),SUM(CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END) FROM journey_points p LEFT JOIN events e ON e.id=p.id WHERE p.device_id=? AND p.trip_id=?",new String[]{owner,trip})){if(c.moveToFirst()){total=c.getInt(0);pending=c.getInt(1);}}
   java.util.ArrayList<JSONObject> recent=new java.util.ArrayList<>();
   try(Cursor c=db.rawQuery("SELECT id,payload FROM journey_points WHERE device_id=? AND trip_id=? ORDER BY recorded_at DESC,id DESC LIMIT 3000",new String[]{owner,trip})){while(c.moveToNext())recent.add(Session.unseal(c.getString(1),"rider-journey:"+owner+":"+c.getString(0)));}
   for(int i=recent.size()-1;i>=0;i--)points.put(recent.get(i));
  }
  cachedOwner=owner;cachedRevision=revision;cachedJourney=new JSONObject().put("tripId",trip).put("points",points).put("total",total).put("pending",pending).put("synced",total-pending).put("shown",points.length());return cachedJourney;
 }
 synchronized int count(){try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM events",null)){c.moveToFirst();return c.getInt(0);}}
 private String encode(String deviceId,JSONObject command)throws Exception{return new JSONObject().put("sealed",Session.seal(command,"rider-command:"+deviceId+":"+command.getString("operationId"))).toString();}
 private JSONObject decode(String id,String device,String raw)throws Exception{JSONObject wrapper=new JSONObject(raw);return wrapper.has("sealed")?Session.unseal(wrapper.getString("sealed"),"rider-command:"+device+":"+id):wrapper;}
 synchronized void addCommand(String deviceId,JSONObject command)throws Exception{ContentValues row=new ContentValues();row.put("id",command.getString("operationId"));row.put("device_id",deviceId);row.put("payload",encode(deviceId,command));getWritableDatabase().insertOrThrow("commands",null,row);}
 synchronized JSONObject command()throws Exception{try(Cursor c=getReadableDatabase().rawQuery("SELECT id,device_id,payload,last_error FROM commands ORDER BY seq LIMIT 1",null)){if(!c.moveToFirst())return null;return new JSONObject().put("id",c.getString(0)).put("deviceId",c.getString(1)).put("payload",decode(c.getString(0),c.getString(1),c.getString(2))).put("error",c.getString(3));}}
 synchronized JSONArray commands()throws Exception{JSONArray rows=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT id,device_id,payload,last_error FROM commands ORDER BY seq LIMIT 100",null)){while(c.moveToNext()){JSONObject p=decode(c.getString(0),c.getString(1),c.getString(2));boolean proof=p.has("otp");p.remove("otp");rows.put(new JSONObject().put("payload",p).put("proofRequired",proof).put("error",c.getString(3)));}}return rows;}
 synchronized void correctOtp(String device,String id,String otp)throws Exception{
  if(!otp.matches("[0-9]{6}"))throw new IllegalStateException("Enter the six-digit customer delivery OTP.");
  try(Cursor c=getReadableDatabase().rawQuery("SELECT payload,last_error FROM commands WHERE id=? AND device_id=?",new String[]{id,device})){
   if(!c.moveToFirst()||c.getString(1).isEmpty())throw new IllegalStateException("This saved report is no longer rejected. Refresh deliveries.");
   JSONObject p=decode(id,device,c.getString(0));if(!p.optString("action").equals("delivered")||!p.has("otp"))throw new IllegalStateException("Choose a rejected OTP delivery report.");
   p.put("otp",otp);ContentValues value=new ContentValues();value.put("payload",encode(device,p));value.put("last_error","");getWritableDatabase().update("commands",value,"id=? AND device_id=?",new String[]{id,device});
  }
 }
 synchronized void commandDone(String id){getWritableDatabase().delete("commands","id=?",new String[]{id});}
 synchronized void commandError(String id,String error){ContentValues value=new ContentValues();value.put("last_error",error);getWritableDatabase().update("commands",value,"id=?",new String[]{id});}
 synchronized int commandCount(){try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM commands",null)){c.moveToFirst();return c.getInt(0);}}
 synchronized boolean pending(String action,String dispatchId){try(Cursor c=getReadableDatabase().rawQuery("SELECT id,device_id,payload FROM commands WHERE last_error=''",null)){while(c.moveToNext())try{JSONObject p=decode(c.getString(0),c.getString(1),c.getString(2));if(p.optString("action").equals(action)&&p.optString("dispatchId").equals(dispatchId))return true;}catch(Exception ignored){}return false;}}
 synchronized boolean completedLocally(String dispatchId){return pending("delivered",dispatchId);}
 synchronized boolean completedStopLocally(String dispatchId,String stopId){try(Cursor c=getReadableDatabase().rawQuery("SELECT id,device_id,payload FROM commands WHERE last_error=''",null)){while(c.moveToNext())try{JSONObject p=decode(c.getString(0),c.getString(1),c.getString(2));if(p.optString("action").equals("delivered")&&p.optString("dispatchId").equals(dispatchId)&&p.optString("stopId").equals(stopId))return true;}catch(Exception ignored){}return false;}}

 synchronized void clearCommands(){getWritableDatabase().delete("commands",null,null);}
 synchronized void clear(){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("events",null,null);db.delete("journey_points",null,null);db.setTransactionSuccessful();}finally{db.endTransaction();}revision++;cachedJourney=null;}
}
