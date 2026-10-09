package app.shadownet.routeforge.driver;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONObject;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class Session {
 static final String API="https://routeforge-shadownet.sammymuya167.chatgpt.site";
 private static final String KEY="routeforge_device_token";
 private static final Object KEY_LOCK=new Object();
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("routeforge",Context.MODE_PRIVATE);}
 // New offline proof reports and customer snapshots use the existing device
 // keystore. Scope binds ciphertext to its rider and operation, without
 // changing the old session format or deleting pre-upgrade reports.
 static String seal(JSONObject data,String scope)throws Exception{
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());cipher.updateAAD(scope.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  return Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
 }
 static JSONObject unseal(String value,String scope)throws Exception{
  String[] parts=value.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));cipher.updateAAD(scope.getBytes(java.nio.charset.StandardCharsets.UTF_8));
  return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));
 }
 static void cacheState(Context c,JSONObject data)throws Exception{
  String encrypted=seal(data,"rider-state:"+queueOwner(c));
  if(!prefs(c).edit().putString("rider_state_encrypted",encrypted).remove("rider_state").commit())throw new java.io.IOException("Could not retain the delivery snapshot.");
 }
 static JSONObject cachedState(Context c)throws Exception{
  String value=prefs(c).getString("rider_state_encrypted",null);
  return value!=null?unseal(value,"rider-state:"+queueOwner(c)):new JSONObject(prefs(c).getString("rider_state","{}"));
 }
 private static SecretKey key() throws Exception {
  synchronized(KEY_LOCK){
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(!store.containsAlias(KEY)){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}
  return (SecretKey)store.getKey(KEY,null);
  }
 }
 private static synchronized void store(Context c,String field,JSONObject data) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String value=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!prefs(c).edit().putString(field,value).commit())throw new java.io.IOException("Could not save this device link.");
 }
 static synchronized void save(Context c,JSONObject data) throws Exception {
  String previous=queueOwner(c);if((EventQueue.get(c).count()>0||EventQueue.get(c).commandCount()>0)&&!previous.equals(data.getString("deviceId")))throw new IllegalStateException("Sync saved reports with the original rider account first.");
  clear(c);store(c,"session",data);prefs(c).edit().putString("driver",data.getString("driverName")).putString("device_id",data.getString("deviceId")).putString("queue_device_id",data.getString("deviceId")).commit();
 }
 static JSONObject get(Context c){return read(c,"session");}
 static boolean loggedIn(Context c){JSONObject s=get(c);return s!=null&&s.optBoolean("loggedIn",false);}
 static String queueOwner(Context c){String id=prefs(c).getString("device_id",prefs(c).getString("queue_device_id",""));if(id.isEmpty())try{JSONObject row=EventQueue.get(c).command();if(row!=null)id=row.optString("deviceId");}catch(Exception ignored){error(c,"Could not read the saved rider reports. Review the queue with your office.");}return id;}
 static JSONObject pendingUnlink(Context c){return read(c,"pending_unlink");}
 static void saveUnlink(Context c,JSONObject data)throws Exception{store(c,"pending_unlink",data);}
 private static synchronized JSONObject read(Context c,String field) {
  String value=prefs(c).getString(field,null);if(value==null)return null;
  try{String[] parts=value.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));}catch(Exception e){error(c,"Device credentials are unavailable. Sign in again with your rider username and password.");return null;}
 }
 static synchronized void clear(Context c){OfflineRoads.cancel();String owner=prefs(c).getString("device_id","");if(!owner.isEmpty())prefs(c).edit().putString("queue_device_id",owner).commit();DriverAlerts.clear(c);prefs(c).edit().remove("session").remove("driver").remove("trip").remove("last_fix").remove("last_sync").remove("last_point").remove("rider_state").remove("rider_state_encrypted").remove("rider_roads_encrypted").remove("road_issue").remove("roads_paused_key").remove("device_id").remove("duty").remove("notified").remove("notified_assignment").remove("active_offer_alerts").remove("active_assignment_alert").remove("state_error").remove("alerts_error").putString("error","").commit();}
 static void error(Context c,String message){prefs(c).edit().putString("error",message).apply();}
}
