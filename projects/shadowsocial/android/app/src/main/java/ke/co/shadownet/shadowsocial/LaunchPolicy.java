package ke.co.shadownet.shadowsocial;

import java.net.URI;

/** One canonical production origin, with no native social database or API proxy. */
public final class LaunchPolicy {
    public static final String SITE_URL = "https://shadowsocial-shadownet.sammymuya167.chatgpt.site/";
    public static final String CUSTOM_TABS_SERVICE = "android.support.customtabs.action.CustomTabsService";
    public static final String SESSION_EXTRA = "android.support.customtabs.extra.SESSION";
    private LaunchPolicy() { }
    public static boolean isCanonicalOrigin(String input) {
        try {
            URI uri = new URI(input);
            URI site = new URI(SITE_URL);
            return "https".equals(uri.getScheme()) && site.getHost().equals(uri.getHost()) && uri.getPort() == -1 && uri.getUserInfo() == null;
        } catch (Exception ignored) { return false; }
    }
    public static String launchUrl(String ignoredIncomingUrl) { return SITE_URL; }
}
