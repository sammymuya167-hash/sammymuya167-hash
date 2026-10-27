package app.shadownet.routeforge.customer;
import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends ComponentActivity {
 private WebView web;
 private LinearLayout root;
 private GeolocationPermissions.Callback pendingLocation;
 private String pendingOrigin;
 @SuppressLint({"SetJavaScriptEnabled","AddJavascriptInterface"})
 @Override public void onCreate(Bundle state){super.onCreate(state);
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(250,251,248));root.setPadding(0,0,0,0);setContentView(root);
  root.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(i.left,i.top,i.right,i.bottom);}else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  web=new WebView(this);web.getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale*100));web.setBackgroundColor(Color.rgb(250,251,248));web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setGeolocationEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.getSettings().setUserAgentString(web.getSettings().getUserAgentString()+" RouteForgeCustomer/1.0");CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);web.addJavascriptInterface(new AlertsBridge(),"RouteForgeCustomer");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String url=request.getUrl().toString();if(ShopOrigin.shopPage(url))return false;if(ShopOrigin.trusted(url)||url.startsWith("https://")||url.startsWith("mailto:")||url.startsWith("tel:")){try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){Toast.makeText(MainActivity.this,"No application can open this link.",Toast.LENGTH_SHORT).show();}}return true;}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())showOffline();}
   @Override public void onPageFinished(WebView view,String url){CookieManager.getInstance().flush();if(ShopOrigin.shopPage(url))scheduleUpdates();}
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){if(!ShopOrigin.trusted(origin)){callback.invoke(origin,false,false);return;}pendingLocation=callback;pendingOrigin=origin;if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED)finishLocation(true);else requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},42);}});
  root.addView(web,new LinearLayout.LayoutParams(-1,-1));if(state!=null)web.restoreState(state);else web.loadUrl(ShopOrigin.ORIGIN+"/shop");
  getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(web.canGoBack())web.goBack();else finish();}});
 }
 private void showOffline(){root.removeAllViews();TextView title=new TextView(this);title.setText("RouteForge Shop\nConnection interrupted");title.setTextSize(25);title.setTextColor(Color.rgb(30,53,41));title.setPadding(32,48,32,18);root.addView(title);TextView body=new TextView(this);body.setText("Your saved basket stays on this phone. Reconnect to the internet to place an order or refresh delivery progress.");body.setTextSize(16);body.setPadding(32,8,32,28);root.addView(body);Button retry=new Button(this);retry.setText("Reconnect to the shop");retry.setOnClickListener(v->{root.removeAllViews();root.addView(web,new LinearLayout.LayoutParams(-1,-1));web.loadUrl(ShopOrigin.ORIGIN+"/shop");});root.addView(retry);}
 private void finishLocation(boolean allowed){if(pendingLocation!=null)pendingLocation.invoke(pendingOrigin,allowed,false);pendingLocation=null;pendingOrigin=null;}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==42)finishLocation(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED);if(request==43){boolean allowed=Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;Toast.makeText(this,allowed?"Order update alerts enabled":"Order alerts remain off",Toast.LENGTH_SHORT).show();}}
 private void scheduleUpdates(){Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();WorkManager.getInstance(this).enqueueUniquePeriodicWork("routeforge-customer-updates",ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(OrderUpdates.class,15,TimeUnit.MINUTES).setConstraints(constraints).build());}
 private final class AlertsBridge {@JavascriptInterface public void enableAlerts(){runOnUiThread(()->{if(!ShopOrigin.shopPage(web.getUrl()))return;NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel("customer-orders","RouteForge order updates",NotificationManager.IMPORTANCE_DEFAULT));if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},43);else Toast.makeText(MainActivity.this,"Order update alerts enabled",Toast.LENGTH_SHORT).show();scheduleUpdates();});}}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @Override protected void onPause(){CookieManager.getInstance().flush();web.onPause();super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale*100));web.onResume();}}
 @Override protected void onDestroy(){finishLocation(false);root.removeAllViews();web.removeJavascriptInterface("RouteForgeCustomer");web.destroy();super.onDestroy();}
}
