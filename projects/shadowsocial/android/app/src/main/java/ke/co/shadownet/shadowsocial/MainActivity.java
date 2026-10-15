package ke.co.shadownet.shadowsocial;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Browser;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Browser-backed Android shell. All identity, posts and follows stay in the shared live service. */
public final class MainActivity extends Activity {
    private static final String PREFS = "shadowsocial_launcher";
    private static final String BROWSER_KEY = "browser_package";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        renderWelcome();
        // A returning user opens the same browser profile. Returning from its tab
        // does not trigger another launch, so Android Back never creates a loop.
        if (state == null && getPreferences(MODE_PRIVATE).getBoolean("has_opened", false)) openShadowSocial();
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openShadowSocial();
    }
    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(int resource, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(resource); view.setTextSize(size); view.setTextColor(color);
        view.setGravity(Gravity.CENTER); view.setLineSpacing(dp(4), 1f);
        if (bold) view.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2); p.topMargin = dp(16); view.setLayoutParams(p);
        return view;
    }
    private void renderWelcome() {
        final int background = Color.rgb(41,75,63), ink = Color.rgb(248,249,243), muted = Color.rgb(190,209,194);
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); scroll.setBackgroundColor(background);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER); root.setPadding(dp(29),dp(35),dp(29),dp(35));
        scroll.addView(root, new ScrollView.LayoutParams(-1,-1));
        scroll.setOnApplyWindowInsetsListener((view,insets)-> {
            root.setPadding(dp(29),dp(35)+insets.getSystemWindowInsetTop(),dp(29),dp(35)+insets.getSystemWindowInsetBottom()); return insets;
        });
        ImageView icon = new ImageView(this); icon.setImageResource(R.drawable.ic_shadowsocial); icon.setContentDescription(getString(R.string.app_name));
        GradientDrawable iconBg = new GradientDrawable(); iconBg.setColor(Color.rgb(62,100,77)); iconBg.setCornerRadius(dp(25)); icon.setBackground(iconBg);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(dp(82),dp(82)); iconParams.gravity = Gravity.CENTER; icon.setLayoutParams(iconParams); root.addView(icon);
        TextView brand = text(R.string.app_name,29,ink,true); root.addView(brand);
        TextView byline = text(R.string.brand_byline,10,Color.rgb(161,146,182),false); byline.setLetterSpacing(.2f); root.addView(byline);
        TextView title = text(R.string.welcome_title,28,ink,false); LinearLayout.LayoutParams titleParams = (LinearLayout.LayoutParams)title.getLayoutParams(); titleParams.topMargin = dp(34); root.addView(title);
        root.addView(text(R.string.welcome_body,14,muted,false));
        Button open = new Button(this); open.setText(R.string.open_chat); open.setTextSize(14); open.setAllCaps(false); open.setTextColor(Color.WHITE);
        GradientDrawable buttonBg = new GradientDrawable(); buttonBg.setColor(Color.rgb(80,115,76)); buttonBg.setCornerRadius(dp(14)); open.setBackground(buttonBg);
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-1,dp(54)); buttonParams.topMargin = dp(28); open.setLayoutParams(buttonParams); open.setOnClickListener(v->openShadowSocial()); root.addView(open);
        TextView sync = text(R.string.same_chats,13,Color.rgb(206,185,236),true); sync.setPadding(dp(6),dp(10),dp(6),dp(10)); sync.setMinHeight(dp(48)); sync.setOnClickListener(v->showSyncHelp()); root.addView(sync);
        root.addView(text(R.string.key_summary,12,muted,false));
        TextView browser = text(R.string.browser_note,11,Color.rgb(166,153,186),false); root.addView(browser);
        root.addView(text(R.string.delivery_note,11,Color.rgb(166,153,186),false));
        TextView version = text(R.string.version,9,Color.rgb(147,132,166),false); version.setLetterSpacing(.13f); root.addView(version);
        setContentView(scroll);
    }
    private void showSyncHelp() { new AlertDialog.Builder(this).setTitle(R.string.key_title).setMessage(R.string.key_steps).setPositiveButton(R.string.close,null).show(); }
    private String browserPackage() {
        String saved = getSharedPreferences(PREFS,MODE_PRIVATE).getString(BROWSER_KEY,null);
        if (saved != null) { try { getPackageManager().getPackageInfo(saved,0); return saved; } catch (PackageManager.NameNotFoundException ignored) { } }
        Intent browse = new Intent(Intent.ACTION_VIEW,Uri.parse(LaunchPolicy.SITE_URL)); browse.addCategory(Intent.CATEGORY_BROWSABLE);
        ResolveInfo resolved = getPackageManager().resolveActivity(browse,PackageManager.MATCH_DEFAULT_ONLY);
        if (resolved != null && resolved.activityInfo != null && !"android".equals(resolved.activityInfo.packageName)) return resolved.activityInfo.packageName;
        for (ResolveInfo provider : getPackageManager().queryIntentServices(new Intent(LaunchPolicy.CUSTOM_TABS_SERVICE),0)) if (provider.serviceInfo != null) return provider.serviceInfo.packageName;
        return null;
    }
    /** Exported for a test of the exact destination and the non-ephemeral session. */
    public Intent createChatIntent(String browser) {
        Intent intent = new Intent(Intent.ACTION_VIEW,Uri.parse(LaunchPolicy.launchUrl(getIntent() == null ? null : getIntent().getDataString())));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        if (browser != null) intent.setPackage(browser);
        Bundle session = new Bundle(); session.putBinder(LaunchPolicy.SESSION_EXTRA,null); intent.putExtras(session);
        intent.putExtra("android.support.customtabs.extra.TOOLBAR_COLOR",Color.rgb(41,75,63));
        intent.putExtra("android.support.customtabs.extra.TITLE_VISIBILITY",1);
        intent.putExtra("androidx.browser.customtabs.extra.SHARE_STATE",2);
        intent.putExtra(Browser.EXTRA_APPLICATION_ID,getPackageName());
        // No incognito/ephemeral flags, authentication headers, tokens, URLs or
        // JavaScript bridges are accepted from other apps.
        return intent;
    }
    private void openShadowSocial() {
        String browser = browserPackage(); Intent intent = createChatIntent(browser);
        try {
            startActivity(intent);
            if (browser != null) getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString(BROWSER_KEY,browser).apply();
            getPreferences(MODE_PRIVATE).edit().putBoolean("has_opened",true).apply();
        } catch (ActivityNotFoundException | SecurityException unavailable) {
            new AlertDialog.Builder(this).setTitle(R.string.no_browser_title).setMessage(R.string.no_browser_body).setPositiveButton(R.string.close,null).show();
        }
    }
}
