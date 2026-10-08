# RouteForge Rider 1.1 release record

Status on 2026-10-08: **completed and published**, Sites version 7.

- Dashboard: https://routeforge-shadownet.sammymuya167.chatgpt.site
- Rider APK: https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider.apk?v=3
- Installer metadata: https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider-release.json
- Sites source commit: `dc9924223b80342ae8b94e3b5bc0e0ec1efc17b3`
- Saved version: `appgprj_6ac6a091041481919cdfd5d22ab08ff2~appgver_a252229dd00c819197d8f5dd97a6b49a`
- Deployment: `appgdep_6ac7e7743be88191a0eea2e71aac72c2`, terminal status `succeeded`.

This updates the existing RouteForge project and catalogue idea #92; it does not create another catalogue completion. The original pilot installer, driver records, uploaded GPS history, payment receipts and saved planning scenarios are preserved.

## Delivered behaviour

Rider 1.1 fixes a three-second state timeout that silently hid assignments when the server took longer. The state endpoint now uses a device-scoped database batch, returns the current order independently of recent-history limits, and defers offer fallback work. The app permits longer reads, reports delivery-connection failures separately from GPS upload status, and retains cached assignments during an outage.

Eligible free riders receive high-importance offer notifications with sound and vibration, an in-app banner on every tab, and a left-to-right five-second claim timer. Direct and automatic assignments have their own notification and persistent active-ride card. Native, interface and database checks prevent a busy, off-duty, GPS-disabled or stale Rider phone from claiming another delivery. Unclaimed offers select a currently free eligible rider at random, or return to the queue.

Working native confirmations let riders finish deliveries; every stop on a legacy route must finish before normal End duty. Privacy pause remains available. Cash and company-till reports retain durable operation IDs, exact amounts, replay protection and office verification. All-time totals include older records.

Routes & planning shares the office navigation and retains route maps, costs, shifts, capacities, windows, weights, CSV import/export, manifests, optimization, settings and saved scenarios. Planning drafts survive navigation, and saved plans reopen for editing. Planning estimates remain distinct from actual customer collections.

See [the requirement-by-requirement update guide](RIDER_UPDATE.md).

## Verified release

- 51 Node unit cases, 61 actual Worker/D1 flows, TypeScript checks, ESLint and the production Worker build passed.
- [Actions run 37827113523](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37827113523) passed debug/release compilation, lint and all 11 API 35 emulator instrumentation checks. These include independent assignment alerts, sound/popup channel configuration, complete legacy-stop gating and a real WebView native confirmation.
- Native source commit: `2305a6da905ed7052caac8227843e9e54d32e829`; CI merge checkout: `a7e442b166dbcea07094f26bab05351beac6265a`.
- Artifact ID: `11572441423`; all 15 main-source/build manifest checksums match the released source.
- Application ID: `app.shadownet.routeforge.rider`; version code/name: `3 / 1.1-rider`; minimum/target API: `26 / 35`.
- Signed APK SHA-256: `03692fbf6822d7d0759af43d86e979b4913aab5213a021152acc9a5a86c6330d`.
- Owner signer certificate SHA-256: `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c`; APK signature schemes v2 and v3 verify.
- Original unchanged pilot SHA-256: `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.

Private signing material remains outside public source and hosting. Future Rider upgrades must use this same owner key.

## Install and field check

Install Rider 1.1 over an existing RouteForge Rider installation; keep its link and queue. Do not unlink or clear storage. In Account, use **Play delivery alert test** and inspect both offer and assigned-delivery settings. Start duty with GPS enabled and a fresh fix, then verify an offered delivery, automatic assignment, completion and cash/till report on the actual phone.

An original pilot installation still requires the one-time existing-driver upgrade code, with the pilot synced and stopped first. Rider installs alongside that older package, and pairing rotates the phone token while retaining the driver and uploaded history.

## Practical limits

The five-second deadline is enforced by the server. A working connection and active duty service are required for prompt offers. Android permission, volume, channel settings, Do Not Disturb, scheduling and cooldown govern sound and popups. There is no claim of a hardware speaker test or broad real-device background verification. Managed-environment browser gestures were unavailable; verified evidence is the Worker and Android emulator checks.

Till reports need office receipt verification. No bank transfer, refund or automated payment reconciliation is implemented. Maps, mileage and planning costs remain estimates.

## Previous release

Rider 1.0 / code 2 was published in Sites version 6 from source `3a84ed3fad0ff708dd44b148c282bb379dc9eefc`. Its APK SHA-256 was `552ea88f006d2d12d590e675b8fbdd96090d2e274750cce05575abcc5f738efd`. This release uses the same Rider package and certificate for an install-over upgrade.
