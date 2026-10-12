package app.shadownet.routeforge.customer;
import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.CookieManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

public final class OrderUpdates extends Worker {
 public OrderUpdates(Context context,WorkerParameters params){super(context,params);}
 private JSONObject get(String path,String cookie)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(ShopOrigin.ORIGIN+path).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(12000);c.setRequestProperty("Cookie",cookie);c.setRequestProperty("Accept","application/json");try{if(c.getResponseCode()!=200)return null;try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>500000)throw new Exception("Response too large");}return new JSONObject(out.toString("UTF-8"));}}finally{c.disconnect();}}
 @Override public Result doWork(){try{
  String cookie=CookieManager.getInstance().getCookie(ShopOrigin.ORIGIN);if(cookie==null||!cookie.contains("__Host-routeforge-customer="))return Result.success();JSONObject session=get("/api/customer/session",cookie);if(session==null||session.isNull("customer"))return Result.success();String account=session.getJSONObject("customer").getString("id");SharedPreferences prefs=getApplicationContext().getSharedPreferences("order-update-status",Context.MODE_PRIVATE);if(!account.equals(prefs.getString("account","")))prefs.edit().clear().putString("account",account).commit();
  JSONObject data=get("/api/customer/orders",cookie);if(data==null)return Result.retry();JSONArray orders=data.getJSONArray("orders");NotificationManager manager=getApplicationContext().getSystemService(NotificationManager.class);boolean allowed=manager.areNotificationsEnabled()&&(Build.VERSION.SDK_INT<33||getApplicationContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);SharedPreferences.Editor edit=prefs.edit();
  for(int i=0;i<orders.length();i++){JSONObject o=orders.getJSONObject(i);String id=o.getString("id"),status=o.getString("status"),previous=prefs.getString(id,null);if(previous!=null&&!previous.equals(status)&&allowed&&manager.getNotificationChannel("customer-orders")!=null){Intent intent=new Intent(getApplicationContext(),MainActivity.class);PendingIntent open=PendingIntent.getActivity(getApplicationContext(),id.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification notification=new Notification.Builder(getApplicationContext(),"customer-orders").setSmallIcon(R.drawable.ic_shop).setContentTitle(o.getString("reference")+" · RouteForge").setContentText(ShopOrigin.label(status)).setContentIntent(open).setAutoCancel(true).build();manager.notify(id.hashCode(),notification);}edit.putString(id,status);}edit.apply();return Result.success();
 }catch(Exception e){return Result.retry();}}
}
