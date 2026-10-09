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
 static synchronized EventQueue get(Context c){if(instance==null)instance=new EventQueue(c.getApplicationContext());return instance;}
 private EventQueue(Context c){super(c,"journey.sqlite",null,2);}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE events(id TEXT PRIMARY KEY, recorded_at INTEGER NOT NULL, payload TEXT NOT NULL)");db.execSQL("CREATE INDEX queue_time ON events(recorded_at,id)");commandsSchema(db);}
 private void commandsSchema(SQLiteDatabase db){db.execSQL("CREATE TABLE IF NOT EXISTS commands(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,device_id TEXT NOT NULL,payload TEXT NOT NULL,last_error TEXT NOT NULL DEFAULT '')");}
 public void onUpgrade(SQLiteDatabase db,int old,int next){if(old<2)commandsSchema(db);}
 synchronized void add(JSONObject event) throws Exception {ContentValues row=new ContentValues();row.put("id",event.getString("eventId"));row.put("recorded_at",event.getLong("recordedAt"));row.put("payload",event.toString());getWritableDatabase().insertOrThrow("events",null,row);}
 synchronized JSONArray batch() throws Exception {JSONArray result=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM events ORDER BY recorded_at,id LIMIT 50",null)){while(c.moveToNext())result.put(new JSONObject(c.getString(0)));}return result;}
 synchronized void acknowledge(JSONArray batch,JSONArray acknowledgements) throws Exception {
  Set<String> sent=new HashSet<>();for(int i=0;i<batch.length();i++)sent.add(batch.getJSONObject(i).getString("eventId"));
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
  try{for(int i=0;i<acknowledgements.length();i++){String id=acknowledgements.getString(i);if(!sent.contains(id))throw new IllegalArgumentException("Unexpected acknowledgement");db.delete("events","id=?",new String[]{id});}db.setTransactionSuccessful();}finally{db.endTransaction();}
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
 synchronized void clear(){getWritableDatabase().delete("events",null,null);}
}
