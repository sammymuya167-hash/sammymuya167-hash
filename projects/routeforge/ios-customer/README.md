# RouteForge Shop for iPhone and iPad

Customer application in the original RouteForge project. Bundle identifier
`app.shadownet.routeforge.customer`, version 1.0 (1), minimum iOS 17.
Uses the existing live shop at
https://routeforge-shadownet.sammymuya167.chatgpt.site/shop
and the original private customer API. No new database, duplicate shop or new
merchant identity is created. The Android customer and rider apps stay separate.

## Implemented

- Live Zenimart products, saved basket, sign-in, checkout, quotes and customer
  order controls through the restricted first-party WKWebView.
- Native order history, progress, totals and fresh rider pin on Apple Maps.
  Courier handoff remains distinct from final receipt. Delivery OTP is shown
  only in the authenticated order view, never in notifications.
- Optional native foreground notifications. Closed-app APNs push is not enabled;
  it needs Apple provisioning and a server APNs integration. No promised periodic
  background polling or background customer location collection.
- Native privacy, terms, account deletion and app settings. Account deletion uses
  the existing authenticated flow, including password confirmation and active
  delivery safeguards.
- Persistent HttpOnly first-party sessions, HTTPS-only navigation, external
  links in the system browser, no file downloads/admin navigation inside the
  customer WebView. Native requests reject redirects and use only the customer
  cookie in an ephemeral URLSession. Account switching clears private native
  views and notification baselines.
- Honest offline/retry screen and on-device basket persistence. Offline checkout
  is not represented as a successful order.
- Foreground delivery-pin location permission only. No camera, microphone,
  contacts, rider journeys or live payment SDK.

## Building and testing

On a Mac with Xcode and XcodeGen:

```bash
brew install xcodegen
xcodegen generate --spec project.yml
open RouteForgeShop.xcodeproj
```

Select an iPhone simulator and use Product > Test. The repository workflow
`routeforge-ios-customer.yml` builds an arm64 device archive and runs unit tests
and native UI tests on a real iOS Simulator, including a read-only live catalog
check. It does not place customer orders or change Jumia statuses.

To run the compiled simulator artifact on an Apple Silicon Mac:

```bash
unzip RouteForge-Customer-1.0-simulator.zip
xcrun simctl install booted RouteForgeShop.app
xcrun simctl launch booted app.shadownet.routeforge.customer
```

## Device signing and distribution

The unsigned device archive is a build artifact, **not an installable IPA**.
An APK cannot install on an iPhone, and the retained Android signing key cannot
sign an iOS app. There is no Apple developer team or Apple signing certificate
configured in this repository.

For a personal iPhone test, open the generated project in Xcode on a Mac, select
your Apple account's Personal Team in Signing & Capabilities, connect your iPhone
and run. Apple's free personal provisioning expires after seven days. Do not
share Apple passwords or private signing keys in chat.

For TestFlight/App Store distribution, the owner needs an enrolled Apple Developer
team, matching registered bundle ID, signing certificate/provisioning and App
Store Connect access. Select that team, archive with signing enabled, and use
Xcode Organizer > Distribute App > App Store Connect. Complete App Store privacy
answers, listing/screenshots, review access and physical-device checks first.
Apple's review approval has not been obtained or assumed.

The source stays in the original repository under `projects/routeforge/ios-customer`
on branch `routeforge-ios-customer-1-0`. No certificates or credentials belong in
Git or in a public artifact. The archived privacy manifest declares account,
contact, delivery location, user ID and purchase data used for fulfillment.

Until native distribution is signed, iPhone users can open the live shop in
Safari and choose Share > Add to Home Screen. This opens the working web shop;
it is not a signed native installation.

Apple references:
- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/testflight/
- https://developer.apple.com/app-store/review/guidelines/

Support: sammymuya167@gmail.com
