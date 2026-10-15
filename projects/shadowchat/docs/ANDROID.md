# ShadowChat Android 0.2.0

A small browser-backed Android APK for the existing invitation-only ShadowChat service:

`https://shadowchat-shadownet.sammymuya167.chatgpt.site/`

## Same conversations on Android and web

The APK launches an Android Custom Tab on that exact origin, using a regular browser profile. It does not create another account system or native message database. The browser handles hosted sign-in, private keys, encryption, APIs and messages using the same application as desktop/mobile web. Browser controls may remain visible. A modern browser is required.

1. Sign in with the **same ChatGPT account** on each screen.
2. On your existing device, use **Settings → Save encrypted recovery key**.
3. Transfer that encrypted file privately to the new device.
4. Enter the original passphrase and restore the key there once.
5. Send a message. The other open, online screen loads it from the same message service, normally within a few seconds.

If the APK and phone website use the same regular browser profile, their sign-in and origin storage are shared. A different browser profile still requires sign-in/key restoration. The selected browser package is retained for consistent future launches. Background push and independent per-device key revocation are outside this release.

## Build and checks

The GitHub workflow `.github/workflows/shadowchat-android.yml` uses JDK 17, Gradle 8.11.1, AGP 8.9.2 and Android SDK/build tools 35. The app supports Android 8.0/API 26 and newer.

From the `android/` folder with those tools installed:

```bash
gradle :app:assembleRelease :app:lintRelease :app:testDebugUnitTest :app:assembleDebugAndroidTest
gradle :app:connectedDebugAndroidTest
```

Tests cover the fixed canonical origin, rejection of untrusted destinations, the non-ephemeral browser session, and absence of native network/storage permissions. The APK does not embed a WebView, scrape cookies, collect credentials, add authorization headers or accept arbitrary destinations from incoming intents.

CI produces an aligned unsigned release plus build provenance and SDK signing tools. Signing occurs privately after download. Private keystores and their passwords must never be committed or uploaded to CI artifacts. The owner signing backup is retained privately so future APK updates can use the same certificate.

Physical-device sign-in, key restoration and a real two-person conversation remain field checks. Emulator launch-policy checks do not claim a completed ChatGPT sign-in or a live production conversation.

## Release verification

GitHub Actions run **38773113521** passed debug/release compilation, release lint, three local unit tests and four API 35 emulator instrumentation checks for source commit `7ce2307ff6b878a9e7ccba8cca92500d000f6ad6`. All 16 manifest-recorded native source/configuration files match the downloaded build. The artifact ZIP SHA-256 matches GitHub's recorded digest.

The release APK is signed with the retained owner certificate using APK Signature Schemes v2 and v3. Its SHA-256 is `80a802f632f59c49723b6f124afa0d9cb6858562470ed159a5e7fccf6ccd3d78`; certificate SHA-256 is `1694b52bc5f49ea85d3bc751d75aa4b7b68e10ec0c39ecece311a3a1e9086851`. Public release metadata is in `public/downloads/shadowchat-android-release.json`. No private signing material is present in the app, Site source, GitHub or CI artifacts.

Five built-Worker integration flows include sending from a restored phone identity and reading that same message on a separately held desktop identity, followed by a web reply decrypted by the phone identity. This verifies the shared service and encryption/key-restoration path with synthetic sessions. It is not a claim of a completed physical-phone sign-in or a real production conversation.

## Web access update 0.2.1

The installed 0.2.0 APK opens the live web application and automatically receives the invitation access fix; reinstalling is unnecessary. The entry page and APK download are publicly reachable, while signing in with the invited email and accepting the owner's invitation are required for membership. No separate hosting viewer approval is required. Existing accounts, recovery keys and conversations are unchanged.
