# ShadowSocial by SHADOWNET

A standalone native Android social app with its own animated splash, email/username login, sign-up, feed, photo composer, profiles, messaging and owner-controlled moderation office. Catalogue project #7.

- [Download the signed Android APK v0.4.0 (64-bit ARM64)](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/api/android/v0.4.0)
- [Community](https://shadowsocial-shadownet.sammymuya167.chatgpt.site)
- [Office](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/office)
- [Owner app-password setup](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/account-access)

## Android release
Native Flutter 3.32.8 screens, packaged for 64-bit ARM64 phones. Android 8.0+ (API 26); target API 35. Package `ke.co.shadownet.shadowsocial`, version 0.4.0 (5). The app has no WebView, Custom Tabs or browser launcher.
The ARM64 installer is **30,649,433 bytes (30.6 MB)**, with no padding. APK SHA-256:
`544a80efcb45af4d84709589aed081cecd7c63fc59e8014eb1bf511c50f75230`
Signing certificate SHA-256:
`3d48406874958d7cf34d08373101fbb346cc52fda05008a1cb0231c0db3d0a71`
The existing owner certificate is preserved for upgrades. Private signing material is never committed.
`native/` is the current Android source. `android/` records the superseded v0.1.0 browser launcher.

## v0.2.1 improvements
The account header, welcome card and action button adapt to small screens. Publishing closes the keyboard before returning to the feed. Long chat names fit the header. Narrow-phone widget checks pass at 320 pixels.

## Owner setup
Open `/account-access` using the verified hosted owner account. Create the owner profile if prompted, then choose an app password and save the private recovery code. Sign into the APK with the owner email and that password. The same profile and office permissions are used on phone and web.
Native signup always creates a member. Claiming an owner email never grants ownership; that address is reserved for explicit linking from the trusted owner session. Only the configured owner manages staff roles and platform settings.

## Community
- Independent email/username accounts; scrypt password hashes, hashed expiring sessions, Android Keystore-backed token storage and single-use recovery codes.
- Animated native splash, original Material UI, discover/following feeds, photo picker/camera, posts, likes, comments, saved posts and profile editing.
- Private accounts and follow approvals, block/unblock, notifications and reports.
- Direct text conversations between mutual accepted followers. Messages refresh every 8 seconds while the chat is open; messages are server-stored, **not end-to-end encrypted**.
- Native owner/admin/moderator office: users, warnings, suspension, bans, staff roles, post review, reports, appeals, audit history, rules, registration/posting switches, blocked phrases and daily posting limits.
- Bans, private-media access and roles are checked by the server on each request.
- Rules acceptance and 16+ confirmation, account deletion and data export API.

## Backend and deployment
Vinext/React on Cloudflare Workers with 21 D1 tables and R2 image/release storage. The public website and native app call the same APIs. Runtime owner identity and media-provider credentials are private Sites secrets. Release publishing uses a temporary credential, disabled after upload by clearing its runtime value and deploying that revision. APK uploads are streamed, checked against SHA-256 and published as immutable versions.
Apply tracked Drizzle migrations in order. `lib/password-auth.ts`, `lib/messages.ts`, `lib/social-api.ts` and `lib/android-release.ts` contain the server behavior. Public profiles never expose account emails.
Web members use `/login`; the hosted identity path remains available for secure owner bootstrap.

## Validation
- 85 existing D1/R2 social and moderation assertions passed.
- 29 native-account and messaging assertions passed.
- 41 call/live state and authorization checks passed.
- 22 owner Android update policy, release metadata, authorization and revision-conflict checks passed (177 API assertions total).
- Production WebRTC checks decoded two-way voice, two-way video and a live viewer using synthetic media.
- 6 production-built Worker tests passed.
- Flutter analyzer clean; 7 widget/client tests passed.
- Release compiled, aligned and signatures verified.
- Production signup, native bearer login identity, posting, account deletion and revoked-session rejection passed using a temporary account, which was removed.
- The published installer was downloaded and its size and SHA-256 matched the privately signed file.
- Android emulator flows passed: installed version, invalid update URL, install before verified download, real APK download with checksum rejection, signup, posting, following and profiles. See `docs/VERIFICATION-0.4.0.md` for the release source and CI evidence.

## Build
Java 17, Flutter 3.32.8, Gradle 8.11.1, Android compile SDK 36 / target API 35, NDK 27.0.12077973.
```sh
cd native
flutter create --platforms=android --org ke.co.shadownet --project-name shadowsocial .
python3 tool/prepare_android.py
flutter pub get
flutter analyze
flutter test
flutter build apk --release --target-platform android-arm64 --split-per-abi
```
The generated Android scaffold is deliberately reproducible from the pinned Flutter toolchain and preparation script. Sign release builds privately using the owner key; no debug signing configuration is used for release.


## Native calls and live (0.3.0)

Native WebRTC voice/video calls, a live directory with public/follower broadcasts, and web/native office controls are implemented. Keep the app foregrounded for incoming invitations and during media sessions. Backend permanent SFU/TURN credentials are runtime secrets. Calls are transport encrypted, not end-to-end encrypted against the media provider. Session recording is disabled. The signed update uses the existing owner certificate and can replace 0.2.1 without uninstalling.

The published APK is ARM64 only. The GitHub CI artifact retains the universal unsigned release input. The v0.3.0 release was signed from CI run 38867603578; its native source is unchanged in backend commit c62508d9400b2697f278ba53002d660b60dfc5ec.

## Owner-managed Android updates (0.4.0)

The website office has an **Android updates** tab for the configured owner. Select a published signed release, enable or pause offers, edit release notes and mark an important update. Each save requires a reason, checks the settings revision and records an audit event. The existing users, bans, rules, announcements, posting, call and live controls apply through the shared backend.

Users on 0.3.0 or earlier install 0.4.0 once from the download link above. Starting with 0.4.0 the native app checks at launch, on return to the foreground and every 15 minutes while open; Settings also has a manual Updates screen. A newer compatible release appears in the app. Downloads start on request, remain in private app cache and must pass size, SHA-256, package, higher version, device ABI and owner signing-certificate checks before the Android installer opens. Android requires users to trust this app as an install source and approve the installation. No silent APK changes or downgrades are supported. Server rules and account restrictions take effect without an APK install.

The old 0.2.1 APK was universal (ARM32, ARM64 and x86_64), at 50,859,432 bytes. This release is ARM64 only, at 30,649,433 bytes; native voice, video and live features remain included. It contains no size padding.
