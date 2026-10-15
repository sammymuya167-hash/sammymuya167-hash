package ke.co.shadownet.shadowsocial;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.test.InstrumentationTestCase;

@SuppressWarnings("deprecation")
public class LauncherInstrumentedTest extends InstrumentationTestCase {
    private MainActivity activity;
    @Override protected void setUp() throws Exception {
        super.setUp();
        getInstrumentation().getTargetContext().getSharedPreferences("ke.co.shadownet.shadowsocial.MainActivity",0).edit().clear().commit();
        Intent intent = new Intent(getInstrumentation().getTargetContext(),MainActivity.class); intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = (MainActivity)getInstrumentation().startActivitySync(intent);
    }
    @Override protected void tearDown() throws Exception { if (activity != null) getInstrumentation().runOnMainSync(()->activity.finish()); super.tearDown(); }
    public void testUsesTheSameWebOrigin() { assertEquals(LaunchPolicy.SITE_URL,activity.createChatIntent(null).getDataString()); }
    public void testBrowserSessionIsSharedAndNotEphemeral() {
        Intent launch = activity.createChatIntent("com.android.chrome");
        assertTrue(launch.hasExtra(LaunchPolicy.SESSION_EXTRA));
        assertFalse(launch.getBooleanExtra("androidx.browser.customtabs.extra.ENABLE_EPHEMERAL_BROWSING",false));
        assertEquals("com.android.chrome",launch.getPackage());
    }
    public void testIncomingUrlCannotRedirectTheUser() {
        activity.setIntent(new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("https://evil.example/")));
        assertEquals(LaunchPolicy.SITE_URL,activity.createChatIntent(null).getDataString());
    }
    public void testNoNativeNetworkOrStoragePermissions() throws Exception {
        PackageInfo p=getInstrumentation().getTargetContext().getPackageManager().getPackageInfo("ke.co.shadownet.shadowsocial",PackageManager.GET_PERMISSIONS);
        assertTrue(p.requestedPermissions==null || p.requestedPermissions.length==0);
    }
}
