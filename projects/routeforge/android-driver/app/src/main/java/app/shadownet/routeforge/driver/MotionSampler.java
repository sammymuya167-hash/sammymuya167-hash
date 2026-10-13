package app.shadownet.routeforge.driver;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

/** Local movement evidence only. No location, network or extra permission. */
final class MotionSampler implements SensorEventListener {
 private SensorManager manager;
 private long firstAt=-1,lastAt=-1,lastMotion=-1,burstAt=-1;
 private int samples,burst;
 private double baseline;
 void start(Context context){
  try{manager=context.getSystemService(SensorManager.class);Sensor sensor=manager==null?null:manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);if(sensor!=null)manager.registerListener(this,sensor,SensorManager.SENSOR_DELAY_NORMAL);}catch(RuntimeException ignored){manager=null;}
 }
 void stop(){if(manager!=null)manager.unregisterListener(this);manager=null;firstAt=lastAt=lastMotion=burstAt=-1;samples=burst=0;}
 void sample(float x,float y,float z,long at){
  if(!Float.isFinite(x)||!Float.isFinite(y)||!Float.isFinite(z)||at<0||lastAt>=0&&at<=lastAt)return;
  double magnitude=Math.sqrt((double)x*x+(double)y*y+(double)z*z);
  if(firstAt<0){firstAt=at;baseline=magnitude;}
  double change=Math.abs(magnitude-baseline);baseline=baseline*.9+magnitude*.1;lastAt=at;samples++;
  if(samples>5&&change>.35){if(burstAt<0||at-burstAt>2000){burstAt=at;burst=0;}if(++burst>=3)lastMotion=at;}
 }
 String evidence(long now){
  if(firstAt<0||samples<20||now<lastAt||now-lastAt>3000||now-firstAt<6000)return "unknown";
  return lastMotion>=0&&now-lastMotion<=8000?"moving":"still";
 }
 @Override public void onSensorChanged(SensorEvent event){if(event.values.length>=3)sample(event.values[0],event.values[1],event.values[2],event.timestamp/1000000L);}
 @Override public void onAccuracyChanged(Sensor sensor,int accuracy){}
}
