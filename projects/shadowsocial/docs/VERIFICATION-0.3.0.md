# ShadowSocial 0.3.0 verification

Status: released. The owner explicitly authorized the saved Android signing key in the isolated Vercel build environment. The signed v0.3.0 APK is available at https://shadowsocial-shadownet.sammymuya167.chatgpt.site/api/android/v0.3.0.

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
CI-derived unsigned SHA-256: 4ce4925ac55330f5568526784830869fa52f53941b8027307edca6dc66c109eb
Signed bytes: 30555169
Signed SHA-256: 093f9d1d475206af1d25aa3f76e3df7baf19325339f3d7431c6ddde9b4db193a
Certificate SHA-256: 3d48406874958d7cf34d08373101fbb346cc52fda05008a1cb0231c0db3d0a71

The unsigned candidate was compiled and checked with aapt and zipalign (16 KB page alignment). The CI artifact retains a reproducible unsigned release and source-SHA record for signing. Its universal input can be restricted to arm64-v8a and realigned before signing. V2 and V3 signatures, the existing owner certificate and 16 KB ZIP alignment were verified. The published APK was downloaded and its full SHA-256 and length matched the signed file. Installed 0.2.1 users can upgrade in place.

Initial automatic reviews required explicit permission before the signing backup could enter the external build VM. The owner then authorized this destination. Signing completed with the saved key; temporary key copies were immediately removed. Permanent media secrets remained in the backend. The temporary release-publishing credential was removed after upload.
