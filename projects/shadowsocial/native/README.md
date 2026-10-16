# ShadowSocial native Android
Version 0.2.1 (3), package ke.co.shadownet.shadowsocial. Flutter 3.32.8, Java 17, API 35, minimum Android 8.0 (API 26).
Native compiled Flutter screens; no WebView, Custom Tabs or browser launcher.
Own email/username and password accounts, secure Android session storage, single-use recovery codes, animated splash, social feed, photo capture/picker, profiles, private follows, activity, messaging between mutual followers, moderation office.
Messages are server-stored, not end-to-end encrypted. New messages refresh every 8 seconds while the conversation is open.
Owner password is explicitly linked to the existing verified owner account from /account-access; native signup never grants owner based on a claimed email.
Build: flutter pub get; flutter analyze; flutter test; flutter build apk --release. Run tool/prepare_android.py after generating Android scaffolding.
Release APK is signed privately using the existing owner key, never a committed debug key.

## Managed updates (v0.4.0, build 5)
The owner's web office controls the selected release, release notes and important-update notices. App checks are independent of sign-in and never block offline access. The update page is available by tapping ShadowSocial's version in Your space; a banner appears for compatible higher builds. Native Kotlin verifies the download and signing identity before opening Android's installer. Clients explicitly consent to downloads and installations.

The previous 0.2.1 APK included ARM32, ARM64 and x86_64. Releases 0.3.0 and 0.4.0 for direct download target ARM64; their smaller size is a processor packaging choice. They remain native Flutter apps with bundled UI and WebRTC. No artificial padding is added.
