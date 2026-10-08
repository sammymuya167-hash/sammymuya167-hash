package app.shadownet.routeforge.driver;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.Date;
import java.util.ArrayList;

public final class MainActivity extends Activity {
 private LinearLayout content;private TextView status;private Button start,pair,clear;private EditText code;private CheckBox consent;private boolean busy=false;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable update=new Runnable(){public void run(){refresh();handler.postDelayed(this,2000);}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(28,50,28,40);content.setBackgroundColor(Color.rgb(247,248,244));scroll.addView(content);setContentView(scroll);
  TextView title=text("RouteForge Driver",27);title.setTextColor(Color.rgb(33,78,56));text("Your trip. Your control.",18);
  text("This app shares GPS journey points with the dispatcher who created your pairing code. It records only while you have a trip running. You can stop at any time. Offline points stay on this phone until the portal confirms receipt.",15);
  text("Portal: "+Session.API,13);status=text("",15);
  code=new EditText(this);code.setHint("One-time pairing code");code.setSingleLine();code.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);content.addView(code);
  consent=new CheckBox(this);consent.setText("I agree to share my trip location with this dispatcher. I understand recording has a visible silent notification and I can stop it.");content.addView(consent);
  pair=button("Pair this phone",()->pair());start=button("Start trip",()->start());
  button("Stop trip",()->{stopService(new Intent(this,TrackingService.class));refresh();});
  button("Sync saved journey now",()->{if(busy)return;busy=true;new Thread(()->{Api.sync(getApplicationContext());runOnUiThread(()->{busy=false;refresh();});}).start();});
  clear=button("Clear device link and local queue",()->new AlertDialog.Builder(this).setTitle("Clear this phone?").setMessage("Recording will stop. "+EventQueue.get(this).count()+" unsent events will be deleted from this phone. Uploaded history stays with your dispatcher. Ask the dispatcher to unlink the old device in the portal.").setNegativeButton("Cancel",null).setPositiveButton("Clear", (d,w)->{stopService(new Intent(this,TrackingService.class));new Thread(()->{synchronized(Api.class){EventQueue.get(this).clear();Session.clear(this);}runOnUiThread(this::refresh);}).start();}).show());
  text("While a trip runs: keep location enabled and the phone powered on. RouteForge uses a silent ongoing notification with a Stop action. No repeated popup, sound or vibration alerts. A battery restriction, force-stop, reboot or powered-off phone can leave a gap. After an OS stop, open this app and tap Start trip again.",14);
  text("Offline capture uses GPS on the phone. Online updates are sent about every 10 seconds when a fix is available. After stopping, Android schedules retries for any remaining queue; their timing depends on the system.",14);refresh();
 }
 private TextView text(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setPadding(0,0,0,18);v.setTextColor(Color.rgb(66,80,67));content.addView(v);return v;}
 private Button button(String label,Runnable action){Button b=new Button(this);b.setText(label);b.setAllCaps(false);content.addView(b);b.setOnClickListener(v->action.run());return b;}
 private void pair(){
  if(busy||Session.get(this)!=null)return;
  if(!consent.isChecked()){Session.error(this,"Read and accept location sharing before pairing.");refresh();return;}
  if(EventQueue.get(this).count()!=0){Session.error(this,"Clear the old local queue before pairing a different device link.");refresh();return;}
  final String pairingCode=code.getText().toString().trim();busy=true;refresh();new Thread(()->{try{JSONObject body=new JSONObject().put("code",pairingCode).put("deviceName",Build.MANUFACTURER+" "+Build.MODEL);JSONObject response=Api.post("/api/tracking/pair",body,null);Session.save(this,response);SyncJob.schedule(this);}catch(Exception e){Session.error(this,e instanceof Api.Rejected?e.getMessage():"Could not pair. Check internet access and try again.");}runOnUiThread(()->{busy=false;code.setText("");refresh();});},"routeforge-pair").start();
 }
 private void start(){if(Session.get(this)==null){Session.error(this,"Pair the phone first.");refresh();return;}
  ArrayList<String> permissions=new ArrayList<>();if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);}if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)permissions.add(Manifest.permission.POST_NOTIFICATIONS);
  if(!permissions.isEmpty()){requestPermissions(permissions.toArray(new String[0]),9);return;}
  try{startForegroundService(new Intent(this,TrackingService.class));}catch(Exception e){Session.error(this,"Could not start the recorder. Keep the app open and try again.");}refresh();
 }
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==9){if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&(Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED))start();else{Session.error(this,"Precise location and notification permission are required. Grant them in Android app settings to record offline GPS.");refresh();}}}
 private void refresh(){if(status==null)return;JSONObject linked=Session.get(this);String driver=Session.prefs(this).getString("driver","");long fix=Session.prefs(this).getLong("last_fix",0),lastSync=Session.prefs(this).getLong("last_sync",0);String error=Session.prefs(this).getString("error","");
  status.setText((linked==null?"Phone not paired":driver+" · "+(TrackingService.running?"Recording trip":"Recording stopped"))+"\nUnsent events: "+EventQueue.get(this).count()+"\nLast GPS: "+date(fix)+"\nLast successful upload: "+date(lastSync)+(error.isEmpty()?"":"\n"+error));
  start.setEnabled(linked!=null&&!TrackingService.running&&!busy);pair.setEnabled(linked==null&&!busy);code.setEnabled(linked==null&&!busy);consent.setEnabled(linked==null&&!busy);clear.setEnabled(!busy&&!TrackingService.running);
 }
 private String date(long time){return time==0?"None yet":DateFormat.getDateTimeInstance().format(new Date(time));}
 @Override protected void onResume(){super.onResume();handler.post(update);}
 @Override protected void onPause(){handler.removeCallbacks(update);super.onPause();}
}
