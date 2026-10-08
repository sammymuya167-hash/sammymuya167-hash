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
 private EventQueue(Context c){super(c,"journey.sqlite",null,1);}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE events(id TEXT PRIMARY KEY, recorded_at INTEGER NOT NULL, payload TEXT NOT NULL)");db.execSQL("CREATE INDEX queue_time ON events(recorded_at,id)");}
 public void onUpgrade(SQLiteDatabase db,int old,int next){throw new IllegalStateException("Unsupported queue upgrade");}
 synchronized void add(JSONObject event) throws Exception {ContentValues row=new ContentValues();row.put("id",event.getString("eventId"));row.put("recorded_at",event.getLong("recordedAt"));row.put("payload",event.toString());getWritableDatabase().insertOrThrow("events",null,row);}
 synchronized JSONArray batch() throws Exception {JSONArray result=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM events ORDER BY recorded_at,id LIMIT 50",null)){while(c.moveToNext())result.put(new JSONObject(c.getString(0)));}return result;}
 synchronized void acknowledge(JSONArray batch,JSONArray acknowledgements) throws Exception {
  Set<String> sent=new HashSet<>();for(int i=0;i<batch.length();i++)sent.add(batch.getJSONObject(i).getString("eventId"));
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
  try{for(int i=0;i<acknowledgements.length();i++){String id=acknowledgements.getString(i);if(!sent.contains(id))throw new IllegalArgumentException("Unexpected acknowledgement");db.delete("events","id=?",new String[]{id});}db.setTransactionSuccessful();}finally{db.endTransaction();}
 }
 synchronized int count(){try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM events",null)){c.moveToFirst();return c.getInt(0);}}
 synchronized void clear(){getWritableDatabase().delete("events",null,null);}
}
