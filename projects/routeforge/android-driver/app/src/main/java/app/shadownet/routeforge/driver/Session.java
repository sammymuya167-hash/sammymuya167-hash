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
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("routeforge",Context.MODE_PRIVATE);}
 private static SecretKey key() throws Exception {
  KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
  if(!store.containsAlias(KEY)){KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}
  return (SecretKey)store.getKey(KEY,null);
 }
 private static synchronized void store(Context c,String field,JSONObject data) throws Exception {
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  String value=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(data.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!prefs(c).edit().putString(field,value).commit())throw new java.io.IOException("Could not save this device link.");
 }
 static synchronized void save(Context c,JSONObject data) throws Exception {
  clear(c);store(c,"session",data);prefs(c).edit().putString("driver",data.getString("driverName")).putString("device_id",data.getString("deviceId")).commit();
 }
 static JSONObject get(Context c){return read(c,"session");}
 static JSONObject pendingUnlink(Context c){return read(c,"pending_unlink");}
 static void saveUnlink(Context c,JSONObject data)throws Exception{store(c,"pending_unlink",data);}
 private static synchronized JSONObject read(Context c,String field) {
  String value=prefs(c).getString(field,null);if(value==null)return null;
  try{String[] parts=value.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));}catch(Exception e){error(c,"Device credentials are unavailable. Clear the old link and pair again.");return null;}
 }
 static void clear(Context c){prefs(c).edit().remove("session").remove("driver").remove("trip").remove("last_fix").remove("last_sync").remove("last_point").remove("rider_state").remove("device_id").remove("duty").remove("notified").putString("error","").commit();}
 static void error(Context c,String message){prefs(c).edit().putString("error",message).apply();}
}
