package ke.co.shadownet.shadowsocial;
import org.junit.Test;
import static org.junit.Assert.*;
public class LaunchPolicyTest {
    @Test public void exactProductionOrigin() { assertTrue(LaunchPolicy.isCanonicalOrigin(LaunchPolicy.SITE_URL)); }
    @Test public void insecureAndLookalikeOriginsAreRejected() {
        for (String url : new String[]{"http://shadowsocial-shadownet.sammymuya167.chatgpt.site/","https://shadowsocial-shadownet.sammymuya167.chatgpt.site.evil.test/","https://evil@shadowsocial-shadownet.sammymuya167.chatgpt.site/","https://shadowsocial-shadownet.sammymuya167.chatgpt.site:443/","javascript:alert(1)","not a url"}) assertFalse(url,LaunchPolicy.isCanonicalOrigin(url));
    }
    @Test public void externalInputNeverChangesTheLaunchDestination() {
        assertEquals(LaunchPolicy.SITE_URL,LaunchPolicy.launchUrl("https://evil.test"));
        assertEquals(LaunchPolicy.SITE_URL,LaunchPolicy.launchUrl("shadowsocial://token=secret"));
        assertEquals(LaunchPolicy.SITE_URL,LaunchPolicy.launchUrl(null));
    }
}
