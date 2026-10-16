# ShadowSocial 0.3.0 verification

Status: implementation and media verification complete; APK signing awaits explicit authorization to access the existing private signing backup in the isolated Vercel build environment. The published Android download remains 0.2.1.

## Features

- Native one-to-one voice and video calls between mutual accepted followers.
- Incoming accept/decline while the app is foregrounded; mute, speaker, camera toggle, camera switching and hang-up.
- Native live broadcasting and watch-only playback, with public-to-members or accepted-follower audiences.
- Private profiles always broadcast to accepted followers.
- Owner and moderator session stop controls with audit reasons; owner-wide calls/live switches.
- Blocks, restrictions, audience changes, expiry and busy-state controls enforced by the server.
- Foreground sessions only; leaving/backgrounding ends the session. Background incoming push is not configured.
- Live broadcasts support 30 viewers and sessions up to one hour.
- No call/live recording. WebRTC transport encryption; no end-to-end encryption against the media provider.

## Evidence

- 85 existing D1/R2 API checks passed.
- 29 authentication/session/direct-message checks passed.
- 41 realtime state, access, privacy, blocking, ban, expiry and staff-control checks passed.
- Flutter analyzer and 3 UI/session tests passed.
- Android emulator signup, posting and follow flows passed in [CI run 38867603578](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/38867603578).
- Production media checks used synthetic camera/microphone sources and app-issued participant credentials. Permanent provider credentials stayed in backend runtime configuration.
- Two-way voice: 6 decoded audio frames in each direction.
- Two-way video: 6 decoded audio and 6 video frames in each direction.
- Live viewer: 6 decoded audio and 6 video frames.
- Synthetic video emitted periodic keyframes for bounded decoder checks.
- Temporary QA accounts were removed; a production profile-table check found no remaining qa_rtc_ usernames.
- Backend and office deployed successfully as Site version 9. Native app source is commit 3a6cb8221dc89e1c670905c4ecf67a047c2ef36a; the cleanup update is c62508d9400b2697f278ba53002d660b60dfc5ec.

## Android candidate

Package: ke.co.shadownet.shadowsocial
Version: 0.3.0, code 4
Minimum Android: API 26
Target Android: API 35
Compile SDK: 36
Prepared candidate ABI: arm64-v8a
Unsigned aligned bytes: 30544773
Unsigned SHA-256: a5f346cb8eae8bbc767b5652190a3a4e0e382d1728fe25808653e5a88a0ae5ec

The unsigned candidate was compiled and checked with aapt and zipalign (16 KB page alignment). The CI artifact retains a reproducible unsigned release and source-SHA record for signing. Its universal input can be restricted to arm64-v8a and realigned before signing. The final signed APK will have a different SHA-256. Use the existing owner certificate so installed 0.2.1 users can upgrade in place.

Two automatic reviews rejected disclosure of permanent media credentials and the private Android signing backup to a temporary external build VM. Media testing was completed safely through the deployed backend instead. The private signing material was never transferred. Signing and release remain pending authorization for the Vercel destination.
