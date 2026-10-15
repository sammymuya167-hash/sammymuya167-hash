# SHADOWNET build log

Build one substantial project at a time, aiming for a daily release with working server behavior, documented origin, meaningful checks and a verified deployment.

| Build | PDF idea | Project | State |
|---|---|---|---|
| 01 · 2026-10-07 | 92 · Delivery Route Optimizer | RouteForge | Built · public demo · signed Rider + dispatch + sales |
| 02 · 2026-10-08 | 33 · Jira Clone | SprintForge | Built · public demo · 28 checks |
| 03 · 2026-10-08 | 98 · API Testing Tool | RequestLab | Built · public demo · 32 checks |
| 04 · 2026-10-08 | 77 · Design Collaboration Tool | CanvasRoom | Built · public demo · 5 domain tests |
| 05 · 2026-10-15 | 12 · WhatsApp Clone | ShadowChat | Built · private initial web release · encrypted one-to-one text |
| Candidate | 45 · Invoice Management System | Invoice studio with lifecycle states and PDF output | Unbuilt |
| Candidate | 55 · Travel Planner | Itineraries, budgets and saved places | Unbuilt |
| Candidate | 67 · Inventory Management System | Stock movement history and reorder rules | Unbuilt |
| Candidate | 14 · LMS Platform | Lessons, progress and instructor publishing | Unbuilt |

The user authorized public portfolio source and public demos on 2026-10-07. Saved visitor data stays account-private. Existing business integrations remain private. The daily task continues with unbuilt ideas and finishes any incomplete authorized build before selecting another.

The full PDF list is in `catalog.json`. Reference licences checked so far: VROOM (BSD-2-Clause), oldboyxx/jira_clone (MIT), Hoppscotch (MIT), and tldraw (custom licence; normal production use is restricted, so no tldraw code or assets were reused). These references inform original AI-assisted implementations, rather than uncredited mirrors. Check all other references before reuse and retain attribution. A daily release is a focused usable version, not a claim of production-scale parity with every reference platform.

## RouteForge driver operations update · 2026-10-08

Released version 4 to the existing public [RouteForge](https://routeforge-shadownet.sammymuya167.chatgpt.site) deployment. Map dragging, keyboard pan, cursor/pinch zoom, driver follow, zoom level 19, fullscreen and vehicle/phone/walking markers replace the fixed-centre tracker. Dispatch and Fleet now include real linked phones, private route/destination assignments, destination progress, conservative GPS arrival and separate delivery confirmation. Speed, heading, battery, estimated movement and optional open-dashboard browser alerts use the existing phone uploads. Street View links to historical imagery where available.

Verification: 31 Node tests, clean lint and typecheck, generated additive migration, successful production build, and 37 built-Worker/D1 integration checks including privacy, arrival, confirmation, stale actions and the unchanged APK checksum. Sites confirmed a successful public deployment from source commit `0176b1f8c9697a861a30fe46a072e732d293ea44`. No installed app, pairing credential or upload protocol was changed. Real browser gestures and phone hardware were not retested in this environment; production HTTP probing was unavailable. This is an update to the completed #92 project, not another catalogue completion.

## RouteForge main office update · 2026-10-08

Replaced the sample planner landing view with an operational office using only paired company drivers, an actual GPS/OpenStreetMap view and working Dispatch/Live tracking navigation. Added private persistent collection/delivery orders, partner destinations, office settings, driver contact/duty/vehicle/rate profiles, searched place suggestions and checked map pin selection. Automatic assignment chooses a fresh, on-duty, free driver by longest idle time and then pickup proximity; manual assignment uses the same directory. Atomic reservations protect against double-booking and duplicate assignments. GPS arrival and office confirmation form distinct collection and delivery stages, shared with the tracker. Recorded GPS mileage and suggested pay are estimates; CSV and completed/cancelled order history are retained. Existing planning records remain archived.

Verification: 40 Node tests, clean lint and typecheck, additive migration `0003`, successful production Worker build and 47 Worker/D1 integration checks. The integration suite verifies account isolation, idempotent requests, two concurrent reservation cases, both collection/drop-off stages, cancellation from either portal, stale/off-duty/pending/foreign driver rejection, retained order history, mileage/rate snapshots and the unchanged APK checksum. Photon contracts are tested with mocked outbound responses, including redirects, failure, private cache and a shared rate gate. Real provider uptime, browser gestures and phone hardware are not claimed as verified here. Existing phone uploads, pairing credentials, APK and production integrations are preserved. Driver-side assignment navigation remains a later native update, as requested. This is an update to completed idea #92; the four-project catalogue state is unchanged.

Deployment confirmed: existing public RouteForge version 5 succeeded at `https://routeforge-shadownet.sammymuya167.chatgpt.site`, from Sites source commit `ff8e68f4297958aecc081024d98cb81b4c548998`. Existing audience and runtime integrations were preserved. Native deployment status and the current live Site URL were verified; interactive production browser QA was unavailable.

## RouteForge Rider and office release · 2026-10-08

Completed the interrupted update and published **version 6** at [RouteForge](https://routeforge-shadownet.sammymuya167.chatgpt.site). Sites source commit: `3a84ed3fad0ff708dd44b148c282bb379dc9eefc`. Deployment: `appgdep_6ac7d191b6e08191928a185ec902e604`, terminal status **succeeded**. The public audience and account-private company data are preserved. This updates completed idea #92; the four-project catalogue state is unchanged.

Rider adds phone-location detection and fresh-fix recovery, durable offline unlink, five-second first-claim delivery offers with random idle-driver fallback, collection and delivery/ride completion, cash/company-till reports, assignment maps/navigation and a navy/blue animated interface. The office adds a sales ledger, receipt verification/void controls, all-time amounts and journey/cost totals, while restoring the planner's capacity, shifts, assumptions, imports, exports and manifests. Offline actions retry with durable IDs and preserve legacy stop identity.

Verification: **43 Node unit tests**, TypeScript checks, a successful production Worker build and **60 Worker/D1 integration checks**. The final Android source at `1a9a3419c18ae53402fca2e47da0f3e0f6f7ac5c` passed debug/release compilation, both lint variants and **seven API 35 emulator instrumentation checks** in [Actions run 37811923084](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37811923084). All 14 files in the unsigned build's source manifest matched the released native source; APK v2/v3 signing and the packaged APK checksum were verified.

The signed [Rider APK](https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider.apk) has SHA-256 `552ea88f006d2d12d590e675b8fbdd96090d2e274750cce05575abcc5f738efd`. The old pilot's unavailable signing key requires a one-time install alongside it: sync its queue, stop its trip, then pair Rider with **Rider app upgrade code** from the existing driver card. The same driver ID, assignment and uploaded history are retained. Future Rider updates use the retained private owner signing key.

Five seconds is the server acceptance deadline; phone alerts and fallback timing depend on connectivity, Android scheduling and server wakeup/polling. Customer till entries remain reports until office verification; no bank transfer is performed. Real-phone background behaviour and interactive browser gestures remain field checks. The earlier disconnected-workspace blocker is resolved. [Release record](RIDER-RELEASE-CHECKPOINT.md) contains evidence and installation details.

## ShadowChat private first release · 2026-10-15

Published catalogue idea **#12** as **ShadowChat by SHADOWNET** at `https://shadowchat-shadownet.sammymuya167.chatgpt.site`. Deployment `appgdep_6ad1020b848c819194959107ab7ac250` succeeded, from source commit `c39a4d292c03c06aaf85b0851b7206f5a88e31bf`. The Site remains owner-private, with no external visitors added. The owner must initialize their profile, then grant intended contacts platform access and create email-bound application invitations. No messages or invitation emails were sent during development.

The original implementation adds authenticated one-to-one NaCl text encryption, public-key pins and safety-number comparison, encrypted key backup/restore, manual/inactivity lock, approved-member controls, ciphertext-only server content, cursor-based history, read/delivery markers, an encrypted retry queue and an installable Android web interface. Unchanged TweetNaCl.js 1.0.3 source, upstream licence and blob provenance are retained.

Verification: **18 cryptographic and D1-backed API tests**, **4 built-production-Worker flow checks**, clean TypeScript and a successful Worker build. Production-flow tests cover auth/headers, invitations, an encrypted message through the compiled Worker and storage, and install assets. Interactive browser control was unavailable, so real-browser IndexedDB, two-person device use, notifications and Android installation are unverified. The native deployment result confirms publication, not a field-tested live conversation.

This is an unaudited early release with long-term-key NaCl encryption, no forward secrecy, no independently revocable device identities, and no protection against malicious delivered app code or compromised devices. It does not include groups, attachments, voice notes, calls, background push or a native APK. It operates separately from WhatsApp. Source and the detailed security model are in `projects/shadowchat/`.

## ShadowChat signed Android APK and shared web conversations · 2026-10-15

Released **ShadowChat 0.2.0** with a signed browser-backed Android APK, available from Settings and the in-app update banner. It opens the same private Site and conversation service as web. Another browser/device signs in to the same ChatGPT account and restores the existing encrypted recovery key once; no separate Android message database is introduced. Custom Tab browser controls may remain visible. Background push remains out of scope.

The existing owner-private Site was updated successfully by deployment `appgdep_6ad108a7a570819192eb3ef4fe2bfbf4`, from Site source `f348dffd09dde59f67719f8ed355b6276009bc32`. Its audience, project identity and database binding were preserved. Native source `7ce2307ff6b878a9e7ccba8cca92500d000f6ad6` passed [Actions run 38773113521](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/38773113521): debug/release compilation, release lint, three unit tests and four API 35 emulator checks. Sixteen manifest-recorded native source/configuration files matched the downloaded artifact. The artifact ZIP matched GitHub's digest; owner signing and APK Signature Schemes v2/v3 were verified. The signing key/password backup is retained privately, outside GitHub, Site source and CI artifacts.

APK SHA-256: `80a802f632f59c49723b6f124afa0d9cb6858562470ed159a5e7fccf6ccd3d78`. Package: `ke.co.shadownet.shadowchat`. Android minimum: API 26. Certificate SHA-256: `1694b52bc5f49ea85d3bc751d75aa4b7b68e10ec0c39ecece311a3a1e9086851`.

Five built-Worker flow checks now include a restored phone identity sending a message read by a separate web identity, followed by a web reply decrypted on that phone identity. The exact served APK download hash is also checked. TypeScript and production Worker builds pass. These checks use synthetic sessions and do not claim a real physical-phone ChatGPT sign-in or production conversation; those remain field checks. [Android setup and security boundaries](../../shadowchat/docs/ANDROID.md).
