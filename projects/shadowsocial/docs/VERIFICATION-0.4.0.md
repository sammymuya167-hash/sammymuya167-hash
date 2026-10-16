# ShadowSocial 0.4.0 verification

Release date: 16 October 2026 (Africa/Nairobi).

## Published Android release

- Package: `ke.co.shadownet.shadowsocial`; version 0.4.0, version code 5.
- Android 8.0+ (API 26); target 35, compile SDK 36; ARM64 only.
- Native source: `d2db2b49b20f26473f2bd78fc9f4d3205f0975c9`.
- CI release input: run [38879087112](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/38879087112), artifact 12037175988.
- CI artifact ZIP SHA-256: `266b9f460fab90c4ab43a09cc72caf9464869a8791e8f18f20b1cfef00cea4aa`.
- APK bytes: 30649433; SHA-256: `544a80efcb45af4d84709589aed081cecd7c63fc59e8014eb1bf511c50f75230`.
- Owner certificate SHA-256: `3d48406874958d7cf34d08373101fbb346cc52fda05008a1cb0231c0db3d0a71` (unchanged).
- Verified APK signatures V2/V3 and 16 KB ZIP alignment; release is not debuggable.
- Inspected ARM64 `libapp.so`, `libflutter.so`, and `libjingle_peerconnection_so.so`; no other ABI libraries in the published installer.
- Published immutable URL: https://shadowsocial-shadownet.sammymuya167.chatgpt.site/api/android/v0.4.0
- Full production GET returned 200, the APK MIME type and attachment filename, with the exact signed-file bytes and SHA-256 above.
- The public update policy returned enabled=true and release 0.4.0/code 5 with the exact metadata. No owner policy was changed to perform release QA.
- Owner private signing files were removed in a finally block immediately after signing. No private signing material is in source or CI.

## Automated verification

- Clean backend TypeScript check.
- 177 real D1/R2 API assertions: 85 social/moderation, 29 accounts/messages, 41 calls/live, and 22 Android update policy tests.
- Android policy tests exercise public metadata, missing release fallback, owner authorization, paused offers, notes and important notices, CSRF, revision conflicts and audit reasons.
- Clean Flutter analyzer; 7 widget/client tests passed, including update validation, update banner navigation, dismissal/pause behavior and blocked installation after verification failure.
- Android emulator integration passed on the release source: native version information, blocked external download URL, blocked installation without a verified file, real production APK download with deliberate SHA-256 mismatch rejection, signup, sharing, following and profile flows.
- The production download uses chunked transfer without Content-Length. The native downloader accepts an absent header but always enforces actual expected bytes, maximum size, total deadline and final SHA-256. The emulator regression reached the checksum rejection after downloading the real 0.3.0 APK.
- Run 38879087112 printed `All tests passed` and captured five UI screenshots plus device logs. Its job then failed because the emulator action runs each script line in a separate shell, losing cleanup variables. Commit `bb6f0c77225eb90b2f774599add28fd0221885bc` moves logging, bounded execution and cleanup into one tracked shell script. The native app code is identical to the signed source. The follow-up workflow is [38881291529](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/38881291529).

## Behavior and limits

The configured owner controls published update offers through Office → Android updates. Every policy save is authorized, revision checked and audited. Accounts, restrictions, rules and media switches continue to use the shared backend; the web media switches also send the correct API payloads.

Install 0.4.0 once over an older release to add the updater. It checks at launch, foreground resume and every 15 minutes while open, with a manual Settings screen. Only a higher version code compatible with the device is offered; a paused policy hides offers. Installation also requires the expected bytes, checksum, package, version, compatible native libraries and owner signing certificate. APK downloads remain in private app cache and are shared with the Android installer through a dedicated FileProvider and temporary URI grant. Android installation requires user approval. Important notices remain visible but do not forcibly block calls or replace the app silently.

No future-version installation was performed on a physical phone during this release. Voice/video/live code is unchanged from 0.3.0, where production synthetic media was decoded in both call directions and by a live viewer. Incoming invitations and media sessions remain foreground only; this release does not add background push or video reels. Direct messages and calls are not end-to-end encrypted against the platform/media provider.

The previous universal 0.2.1 installer contained ARM32, ARM64 and x86_64 libraries and was 50,859,432 bytes. The 30,649,433-byte ARM64 release includes native WebRTC and uses no size padding.
