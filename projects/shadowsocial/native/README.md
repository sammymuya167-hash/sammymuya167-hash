# ShadowSocial native Android
Version 0.2.1 (3), package ke.co.shadownet.shadowsocial. Flutter 3.32.8, Java 17, API 35, minimum Android 8.0 (API 26).
Native compiled Flutter screens; no WebView, Custom Tabs or browser launcher.
Own email/username and password accounts, secure Android session storage, single-use recovery codes, animated splash, social feed, photo capture/picker, profiles, private follows, activity, messaging between mutual followers, moderation office.
Messages are server-stored, not end-to-end encrypted. New messages refresh every 8 seconds while the conversation is open.
Owner password is explicitly linked to the existing verified owner account from /account-access; native signup never grants owner based on a claimed email.
Build: flutter pub get; flutter analyze; flutter test; flutter build apk --release. Run tool/prepare_android.py after generating Android scaffolding.
Release APK is signed privately using the existing owner key, never a committed debug key.
