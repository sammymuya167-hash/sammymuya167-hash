# SHADOWNET build log

Build one substantial project at a time, aiming for a daily release with working server behavior, documented origin, meaningful checks and a verified deployment.

| Build | PDF idea | Project | State |
|---|---|---|---|
| 01 · 2026-10-07 | 92 · Delivery Route Optimizer | RouteForge | Built · public demo · signed Rider + dispatch + sales |
| 02 · 2026-10-08 | 33 · Jira Clone | SprintForge | Built · public demo · 28 checks |
| 03 · 2026-10-08 | 98 · API Testing Tool | RequestLab | Built · public demo · 32 checks |
| 04 · 2026-10-08 | 77 · Design Collaboration Tool | CanvasRoom | Built · public demo · 5 domain tests |
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
