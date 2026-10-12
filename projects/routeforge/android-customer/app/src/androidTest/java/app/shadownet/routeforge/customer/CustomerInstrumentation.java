package app.shadownet.routeforge.customer;
import android.app.Instrumentation;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.LinearLayout;
import java.util.Arrays;
public final class CustomerInstrumentation extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 private void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 @Override public void onStart(){Bundle result=new Bundle();try{
  PackageInfo p=getTargetContext().getPackageManager().getPackageInfo(getTargetContext().getPackageName(),PackageManager.GET_PERMISSIONS);
  check(p.packageName.equals("app.shadownet.routeforge.customer"),"Distinct customer package");check(p.applicationInfo.targetSdkVersion==36,"API 36 target");check(!Arrays.asList(p.requestedPermissions).contains("android.permission.ACCESS_BACKGROUND_LOCATION"),"No background location");check(!Arrays.asList(p.requestedPermissions).contains("android.permission.READ_CONTACTS"),"No contacts");
  Activity a=startActivitySync(new Intent(getTargetContext(),MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));runOnMainSync(()->{LinearLayout root=(LinearLayout)((android.view.ViewGroup)a.findViewById(android.R.id.content)).getChildAt(0);WebView w=(WebView)root.getChildAt(0);check(w.getSettings().getJavaScriptEnabled(),"Interactive shop");check(w.getSettings().getDomStorageEnabled(),"Saved basket");check(!w.getSettings().getAllowFileAccess(),"No file access");check(!w.getSettings().getAllowContentAccess(),"No content access");check(w.getSettings().getMixedContentMode()==android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW,"HTTPS only");check(w.getSettings().getUserAgentString().contains("RouteForgeCustomer/1.0"),"Installed customer version");a.finish();});
  result.putString("stream","\nRouteForge customer Android checks: 10 passed\n");finish(Activity.RESULT_OK,result);
 }catch(Throwable e){result.putString("stream",e.toString());finish(Activity.RESULT_CANCELED,result);}}
}
