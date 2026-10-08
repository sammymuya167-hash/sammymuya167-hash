# RouteForge Rider release record

Status on 2026-10-08: **completed and published**, version 6.

- Dashboard: https://routeforge-shadownet.sammymuya167.chatgpt.site
- Rider APK: https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider.apk
- Installer metadata: https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider-release.json
- Sites source commit: `3a84ed3fad0ff708dd44b148c282bb379dc9eefc`
- Saved version: `appgprj_6ac6a091041481919cdfd5d22ab08ff2~appgver_e0df915864c881918adf05b03e835fa9`
- Deployment: `appgdep_6ac7d191b6e08191928a185ec902e604`, terminal status `succeeded`.

The execution workspace recovered and its unfinished source was preserved. The complete matching server, office, database migration and native app are released together. This completes the authorized update to existing catalogue idea #92; it does not create another catalogue completion.

## Delivered behavior

- Phone GPS being enabled is distinguished from receiving a fresh position; pairing resets old telemetry and starts duty after consent/permissions.
- On-duty riders receive five-second delivery offers. First atomic acceptance wins; unclaimed offers select a free, on-duty rider at random, or return to the queue if none is eligible.
- Collection confirmation, delivery/ride completion and cash/company-till reports update the same stored office order. Durable offline command IDs preserve order and stop identity and prevent duplicate sales.
- Unlinking ends duty and cancels unfinished assignments for office follow-up when the server receives it. Uploaded history and recorded payments remain; offline unlink requests retry securely.
- Home, Offers, Route, Trips and Account use the requested navy/blue interface and restrained animation. The office has sales totals, a reviewable payment ledger and restored planner controls.
- All-time financial, completed-order, mileage and cost totals include records beyond the latest 500 rows displayed. Office verification is distinct from a rider report.

## Verification and signing

43 Node unit tests and 60 actual Worker/D1 integration checks passed, along with TypeScript checks and a production Worker build. Tests cover account isolation, competing claims, busy-driver exclusion, deadline fallback, completion, exact minor-unit payments, replay protection, offline UI actions, upgrade continuity, unlinking and older-record totals.

Final native source: `1a9a3419c18ae53402fca2e47da0f3e0f6f7ac5c`; CI merge checkout: `be49b78907d8f2443b11070a3871d0532c999920`. [Actions run 37811923084](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37811923084) passed debug/release compilation, debug/release lint and seven API 35 emulator instrumentation cases, including the packaged UI/bridge check. All 14 source-manifest checksums match the released native source.

The aligned APK was signed privately; Android APK Signature Schemes v2 and v3 verify. The deployment archive contains the same verified bytes.
- Application ID: `app.shadownet.routeforge.rider`
- Version code/name: `2 / 1.0-rider`
- Minimum/target API: `26 / 35`
- APK SHA-256: `552ea88f006d2d12d590e675b8fbdd96090d2e274750cce05575abcc5f738efd`
- Public signer certificate SHA-256: `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c`
- Original unchanged pilot APK SHA-256: `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.

Private signing keys/passwords are retained outside public source and hosting. Use the same owner key for future Rider install-over upgrades.

## Install or migrate

For an existing pilot phone, sync until its queue is zero and stop its trip. In the office tracking portal, choose **Rider app upgrade code** on the existing driver's card. Install RouteForge Rider alongside the old app and pair using that single-use ten-minute code. Grant precise location and notifications. The upgrade rotates the phone token while retaining the same driver, assignment, uploaded journeys and payment records. Keep the old recorder stopped. A new driver uses **Link a driver**.

Refresh the office dashboard to load this version. Verify on the actual rider phone that enabled GPS produces a fresh fix, that a delivery offer is visible, and that a completed delivery and payment report reach the office after reconnection.

## Practical limits

Five seconds is a server claim deadline, not a guarantee every phone sees the alert within five seconds. Active duty polls offers; internet loss, OS scheduling and battery restrictions can delay delivery. The server has a durable deadline plus a best-effort background wakeup and polling recovery, so fallback can be later during an outage. Offline events appear in the office only after sync.

Till reports require office receipt verification. No payment transfer, refund, split-payment or banking reconciliation is implemented. Map lines and measured mileage/costs remain estimates; road directions use external navigation. Interactive browser QA and broad real-device background testing were unavailable in this environment; automated Worker and Android emulator checks are the verified evidence.
