# ShadowSocial by SHADOWNET

A standalone native Android social app with its own animated splash, email/username login, sign-up, feed, photo composer, profiles, messaging and owner-controlled moderation office. Catalogue project #7.

- [Download the signed Android APK v0.2.0](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/api/android/v0.2.0)
- [Community](https://shadowsocial-shadownet.sammymuya167.chatgpt.site)
- [Office](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/office)
- [Owner app-password setup](https://shadowsocial-shadownet.sammymuya167.chatgpt.site/account-access)

## Android release
Native Flutter 3.32.8 screens, compiled for ARM32, ARM64 and x86_64. Android 8.0+ (API 26); target API 35. Package `ke.co.shadownet.shadowsocial`, version 0.2.0 (2). The app has no WebView, Custom Tabs or browser launcher.
The universal installer is **50,843,048 bytes (50.8 MB)**, with no padding. APK SHA-256:
`c24a4b8d1ce838a4ff249c86ad35d13a03c9c7a0e6097e2a8c45c36bfc7f5b16`
Signing certificate SHA-256:
`3d48406874958d7cf34d08373101fbb346cc52fda05008a1cb0231c0db3d0a71`
The existing owner certificate is preserved for upgrades. Private signing material is never committed.
`native/` is the current Android source. `android/` records the superseded v0.1.0 browser launcher.

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
Vinext/React on Cloudflare Workers with 18 D1 tables and R2 image/release storage. The public website and native app call the same APIs. Runtime owner identity and release-publishing credentials are private Sites secrets. APK uploads are streamed, checked against SHA-256 and published as immutable versions.
Apply tracked Drizzle migrations in order. `lib/password-auth.ts`, `lib/messages.ts`, `lib/social-api.ts` and `lib/android-release.ts` contain the server behavior. Public profiles never expose account emails.
Web members use `/login`; the hosted identity path remains available for secure owner bootstrap.

## Validation
- 85 existing D1/R2 social and moderation assertions passed.
- 25 native-account and messaging assertions passed.
- 6 production-built Worker tests passed.
- Flutter analyzer clean; 3 widget/client tests passed.
- Release compiled, aligned and signatures verified.
- Production signup, native bearer login identity, posting, account deletion and revoked-session rejection passed using a temporary account, which was removed.
- The published installer was downloaded and its size and SHA-256 matched the privately signed file.
- Android emulator integration workflow exercises signup, posting, following and profiles with a real local D1/R2 API. Check its current run result before calling emulator validation complete.

## Build
Java 17, Flutter 3.32.8, Gradle 8.11.1, Android SDK 35, NDK 27.0.12077973.
```sh
cd native
flutter create --platforms=android --org ke.co.shadownet --project-name shadowsocial .
python3 tool/prepare_android.py
flutter pub get
flutter analyze
flutter test
flutter build apk --release
```
The generated Android scaffold is deliberately reproducible from the pinned Flutter toolchain and preparation script. Sign release builds privately using the owner key; no debug signing configuration is used for release.
