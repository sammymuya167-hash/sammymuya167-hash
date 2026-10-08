package app.shadownet.routeforge.driver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
final class Api {
 static final class Rejected extends Exception {final int status;Rejected(int status,String message){super(message);this.status=status;}}
 static JSONObject post(String path,JSONObject body,String token)throws Exception {return post(path,body,token,15000);}
 static JSONObject post(String path,JSONObject body,String token,int timeout)throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL(Session.API+path).openConnection();
  try{connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(timeout);connection.setReadTimeout(timeout);connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");if(token!=null)connection.setRequestProperty("Authorization","Bearer "+token);
   byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);try(java.io.OutputStream out=connection.getOutputStream()){out.write(bytes);}
   int status=connection.getResponseCode();InputStream raw=status>=200&&status<300?connection.getInputStream():connection.getErrorStream();
   ByteArrayOutputStream response=new ByteArrayOutputStream();if(raw!=null)try(InputStream in=raw){byte[] chunk=new byte[4096];int n;while((n=in.read(chunk))!=-1){if(response.size()+n>65536)throw new java.io.IOException("Response is too large");response.write(chunk,0,n);}}
   JSONObject data;try{data=new JSONObject(response.toString(StandardCharsets.UTF_8.name()));}catch(Exception e){throw new java.io.IOException("Portal returned an unreadable response. Your queue is safe.");}
   if(status<200||status>=300)throw new Rejected(status,data.optString("error","Portal is temporarily unavailable"));
   return data;
  }finally{connection.disconnect();}
 }
 static synchronized boolean sync(Context c) {
  JSONObject session=Session.get(c);if(!Session.loggedIn(c))return EventQueue.get(c).count()==0;
  if(EventQueue.get(c).count()>0&&!Session.queueOwner(c).equals(session.optString("deviceId"))){Session.error(c,"Saved GPS belongs to another rider. Sign in to the original account.");return false;}
  try{for(int rounds=0;rounds<10;rounds++){JSONArray batch=EventQueue.get(c).batch();if(batch.length()==0){Session.error(c,"");return true;}
    JSONObject response=post("/api/tracking/ingest",new JSONObject().put("events",batch),session.getString("token"));
    JSONArray ack=response.getJSONArray("acknowledged");if(ack.length()==0)throw new java.io.IOException("Portal did not acknowledge this batch.");
    EventQueue.get(c).acknowledge(batch,ack);Session.prefs(c).edit().putLong("last_sync",System.currentTimeMillis()).apply();Session.error(c,"");
   }return EventQueue.get(c).count()==0;
  }catch(Rejected e){if(e.status==401){Session.clear(c);c.stopService(new Intent(c,TrackingService.class));Session.error(c,"Your rider session ended. Recording stopped. Sign in to the same account to sync unsent events.");}else Session.error(c,e.getMessage());return false;}
  catch(Exception e){Session.error(c,"Offline or unable to sync. Journey events remain on this phone.");return false;}
 }
}
