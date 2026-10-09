package app.shadownet.routeforge.driver;

import android.content.Context;
import android.location.Location;
import android.location.LocationManager;
import android.os.SystemClock;
import org.json.JSONObject;
import java.util.UUID;

/** GPS sampling does not depend on HTTP, map tiles or road downloads. */
final class GpsRecorder {
 private Location anchor;
 private long gpsAt;
 static String begin(Context c)throws Exception {
  String trip=Session.prefs(c).getBoolean("duty",false)?Session.prefs(c).getString("trip",""):"";
  if(!trip.isEmpty())return trip;
  trip=UUID.randomUUID().toString();
  EventQueue.get(c).add(new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind","start").put("recordedAt",System.currentTimeMillis()));
  if(!Session.prefs(c).edit().putString("trip",trip).putBoolean("duty",true).commit())throw new java.io.IOException("Could not retain recording state.");
  return trip;
 }
 boolean eligible(Location fix,long elapsedNanos,long wallTime) {
  if(fix==null||!fix.hasAccuracy()||!Float.isFinite(fix.getAccuracy())||fix.getAccuracy()<0||fix.getAccuracy()>50||!Double.isFinite(fix.getLatitude())||!Double.isFinite(fix.getLongitude())||Math.abs(fix.getLatitude())>90||Math.abs(fix.getLongitude())>180)return false;
  long age=elapsedNanos-fix.getElapsedRealtimeNanos();
  if(age<0||age>30000000000L||Math.abs(wallTime-fix.getTime())>120000)return false;
  boolean satellite=LocationManager.GPS_PROVIDER.equals(fix.getProvider());
  if(!satellite&&(fix.getAccuracy()>40||(gpsAt>0&&elapsedNanos-gpsAt<30000000000L)))return false;
  if(anchor!=null) {
   long delta=fix.getElapsedRealtimeNanos()-anchor.getElapsedRealtimeNanos();
   if(delta<=0)return false;
   float metres=fix.distanceTo(anchor);
   if(delta<120000000000L&&metres>55*(delta/1e9)+anchor.getAccuracy()+fix.getAccuracy())return false;
   // Network fixes cannot win the sampling interval over a newer GPS fix.
   if(delta<2000000000L)return false;
   float noise=Math.max(3,Math.min(10,Math.min(anchor.getAccuracy(),fix.getAccuracy())*.35f));
   if(metres<noise&&delta<30000000000L)return false;
  }
  return true;
 }
 void accepted(Location fix) {anchor=new Location(fix);if(LocationManager.GPS_PROVIDER.equals(fix.getProvider()))gpsAt=fix.getElapsedRealtimeNanos();}
 JSONObject record(Context c,String trip,Location fix)throws Exception {
  long elapsed=SystemClock.elapsedRealtimeNanos(),now=System.currentTimeMillis();
  if(!eligible(fix,elapsed,now))return null;
  JSONObject event=new JSONObject().put("eventId",UUID.randomUUID().toString()).put("tripId",trip).put("kind","point").put("recordedAt",fix.getTime()).put("lat",fix.getLatitude()).put("lng",fix.getLongitude()).put("accuracy",fix.getAccuracy());
  if(fix.hasSpeed()&&Float.isFinite(fix.getSpeed())&&fix.getSpeed()>=0&&fix.getSpeed()<=200)event.put("speed",fix.getSpeed());
  if(fix.hasBearing()&&Float.isFinite(fix.getBearing())&&fix.getBearing()>=0&&fix.getBearing()<=360)event.put("heading",fix.getBearing());
  android.os.BatteryManager batteries=c.getSystemService(android.os.BatteryManager.class);int battery=batteries.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY);if(battery>=0&&battery<=100)event.put("battery",battery);
  EventQueue.get(c).add(event);accepted(fix);
  Session.prefs(c).edit().putLong("last_fix",event.getLong("recordedAt")).putString("last_point",event.toString()).remove("gps_issue").apply();
  return event;
 }
 void restore(Context c,String trip) {try {String raw=Session.prefs(c).getString("last_point","");if(raw.isEmpty())return;JSONObject p=new JSONObject(raw);long age=System.currentTimeMillis()-p.getLong("recordedAt");if(!p.optString("tripId").equals(trip)||age<0||age>120000)return;Location saved=new Location(LocationManager.GPS_PROVIDER);saved.setLatitude(p.getDouble("lat"));saved.setLongitude(p.getDouble("lng"));saved.setAccuracy((float)p.getDouble("accuracy"));saved.setTime(p.getLong("recordedAt"));saved.setElapsedRealtimeNanos(Math.max(1,SystemClock.elapsedRealtimeNanos()-age*1000000L));anchor=saved;}catch(Exception ignored){}}
}
