# RouteForge Shop customer app

This is the customer frontend of the existing RouteForge platform. Its original
backend, merchant dashboard and rider app remain in their existing locations.

Package: `app.shadownet.routeforge.customer`. Version: `1.0-customer` (code 1).
Target Android 16 / API 36, minimum Android 8 / API 26.

The native app provides a restricted HTTPS shopping WebView, persistent customer
sessions, an offline reconnect screen, optional foreground delivery-pin location
and native background order notifications through WorkManager. Background checks
run at an Android-controlled interval of at least 15 minutes; they are not instant
push notifications. Account deletion and privacy links are available in the shop.
No rider GPS service, contacts permission, microphone, camera or live financial
SDK is included. Web updates deploy through the existing RouteForge site. Native
updates require an APK install or a Google Play update after publishing.

Build with Java 17, Gradle 8.11.1, Android SDK platform 36:

`gradle :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease :app:bundleRelease :app:lintDebug :app:lintRelease`

Release APK and AAB are unsigned by the build. Sign the aligned APK with the
owner's retained signing key using apksigner. Sign the AAB with jarsigner using
the retained owner upload key. Never commit keys, passwords or signed credentials.
