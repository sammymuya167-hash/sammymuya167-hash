package app.shadownet.routeforge.driver;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import org.json.JSONArray;
import org.json.JSONObject;

/** Android owns sound and heads-up delivery; never bypass a rider's mute or DND. */
final class DriverAlerts {
 static final String OFFERS="delivery-offers-v2", ASSIGNMENTS="delivery-assignments-v1";
 static void channels(Context c){
  NotificationManager manager=c.getSystemService(NotificationManager.class);
  for(String id:new String[]{OFFERS,ASSIGNMENTS}){
   NotificationChannel channel=new NotificationChannel(id,id.equals(OFFERS)?"New delivery offers":"Assigned deliveries",NotificationManager.IMPORTANCE_HIGH);
   channel.setDescription(id.equals(OFFERS)?"Sound, vibration and a popup during the five-second claim window.":"A delivery has been assigned to this rider, including automatic assignments.");
   channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
   channel.enableVibration(true);channel.setVibrationPattern(new long[]{0,250,150,250});
   manager.createNotificationChannel(channel);
  }
 }
 static JSONObject status(Context c)throws Exception{
  NotificationManager manager=c.getSystemService(NotificationManager.class);AudioManager audio=c.getSystemService(AudioManager.class);
  boolean enabled=manager.areNotificationsEnabled(),volume=audio.getStreamVolume(AudioManager.STREAM_NOTIFICATION)>0&&audio.getRingerMode()==AudioManager.RINGER_MODE_NORMAL;
  JSONObject result=new JSONObject().put("enabled",enabled).put("volumeOn",volume);
  for(String id:new String[]{OFFERS,ASSIGNMENTS}){
   NotificationChannel channel=manager.getNotificationChannel(id);String name=id.equals(OFFERS)?"offers":"assignments";
   result.put(name+"Enabled",enabled&&channel!=null&&channel.getImportance()>NotificationManager.IMPORTANCE_NONE);
   result.put(name+"Sound",enabled&&volume&&channel!=null&&channel.getSound()!=null&&channel.getImportance()>=NotificationManager.IMPORTANCE_DEFAULT);
   result.put(name+"Popup",enabled&&channel!=null&&channel.getImportance()>=NotificationManager.IMPORTANCE_HIGH);
  }
  return result;
 }
 private static boolean enabled(NotificationManager manager,String channel){NotificationChannel ch=manager.getNotificationChannel(channel);return manager.areNotificationsEnabled()&&ch!=null&&ch.getImportance()>NotificationManager.IMPORTANCE_NONE;}
 private static PendingIntent open(Context c,String id,String tab){return PendingIntent.getActivity(c,id.hashCode(),new Intent(c,MainActivity.class).setAction("delivery:"+id).putExtra("tab",tab).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);}
 private static Notification.Builder base(Context c,String channel,String id,String tab){return new Notification.Builder(c,channel).setSmallIcon(R.drawable.ic_route).setCategory(Notification.CATEGORY_EVENT).setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open(c,id,tab)).setOnlyAlertOnce(true).setAutoCancel(true);}
 private static JSONArray ids(Context c){try{return new JSONArray(Session.prefs(c).getString("active_offer_alerts","[]"));}catch(Exception ignored){return new JSONArray();}}
 static void sync(Context c,JSONObject data){
  try{
   channels(c);NotificationManager manager=c.getSystemService(NotificationManager.class);
   JSONArray offers=data.optJSONArray("offers"),current=new JSONArray();String seen=Session.prefs(c).getString("notified","");
   if(offers!=null)for(int i=0;i<offers.length();i++){
    JSONObject o=offers.getJSONObject(i);String id=o.getString("id");long remaining=o.optLong("offerDeadline")-data.optLong("serverTime");
    if(remaining<=0)continue;current.put(id);
    if(seen.contains(id)||!enabled(manager,OFFERS))continue;
    manager.notify("offer:"+id,id.hashCode(),base(c,OFFERS,id,"offers").setContentTitle("New delivery · "+o.optString("title")).setContentText("Open to claim · "+Math.max(1,(remaining+999)/1000)+" seconds left").setWhen(System.currentTimeMillis()+remaining).setUsesChronometer(true).setChronometerCountDown(true).setTimeoutAfter(remaining).setProgress(5000,(int)Math.max(0,5000-remaining),false).build());
    seen+=","+id;
   }
   JSONArray previous=ids(c);for(int i=0;i<previous.length();i++){String id=previous.getString(i);boolean found=false;for(int j=0;j<current.length();j++)if(id.equals(current.getString(j)))found=true;if(!found)manager.cancel("offer:"+id,id.hashCode());}
   if(seen.length()>4000)seen=seen.substring(seen.length()-3000);
   JSONObject assignment=data.optJSONObject("assignment");String active="";
   if(assignment!=null){JSONArray stops=assignment.optJSONArray("stops");if(stops!=null)for(int i=0;i<stops.length();i++)if(stops.getJSONObject(i).isNull("deliveredAt")){active=assignment.optString("id");break;}}
   String old=Session.prefs(c).getString("active_assignment_alert","");if(!old.isEmpty()&&!old.equals(active))manager.cancel("assignment:"+old,old.hashCode());
   if(!active.isEmpty()&&!active.equals(Session.prefs(c).getString("notified_assignment",""))&&enabled(manager,ASSIGNMENTS)){
    manager.notify("assignment:"+active,active.hashCode(),base(c,ASSIGNMENTS,active,"home").setContentTitle("Delivery assigned to you").setContentText(assignment.optString("name")+" · Open your active ride and destination").setStyle(new Notification.BigTextStyle().bigText("Your office assigned "+assignment.optString("name")+". Open RouteForge to view collection, delivery, navigation and payment controls.")).build());
    Session.prefs(c).edit().putString("notified_assignment",active).apply();
   }
   Session.prefs(c).edit().putString("active_offer_alerts",current.toString()).putString("active_assignment_alert",active).putString("notified",seen).putString("alerts_error","").apply();
  }catch(Exception ignored){Session.prefs(c).edit().putString("alerts_error","Android could not show a delivery alert. Open alert settings; the in-app delivery card remains available.").apply();}
 }
 static void test(Context c){channels(c);NotificationManager manager=c.getSystemService(NotificationManager.class);if(enabled(manager,OFFERS))manager.notify("alert-test",55,base(c,OFFERS,"test","account").setContentTitle("RouteForge delivery alert test").setContentText("This is the sound and popup used for delivery offers.").setTimeoutAfter(10000).build());}
 static void clear(Context c){try{NotificationManager manager=c.getSystemService(NotificationManager.class);JSONArray offers=ids(c);for(int i=0;i<offers.length();i++){String id=offers.getString(i);manager.cancel("offer:"+id,id.hashCode());}String a=Session.prefs(c).getString("active_assignment_alert","");if(!a.isEmpty())manager.cancel("assignment:"+a,a.hashCode());}catch(Exception ignored){}}
}
