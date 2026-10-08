# RouteForge Rider release checkpoint

Status on 2026-10-08: **unfinished; do not install or announce this as a live release**.

The existing public RouteForge office remains version 5 at https://routeforge-shadownet.sammymuya167.chatgpt.site. Sites source commit: `ff8e68f4297958aecc081024d98cb81b4c548998`. Its audience and production integrations have not been changed.

Finish this authorized Rider/office update before selecting another portfolio idea. This updates completed catalogue idea #92; it is not a new catalogue completion.

## Saved source and evidence

The new native client and Android CI workflow are saved on branch `routeforge-rider-v2`, in [draft PR #1](https://github.com/sammymuya167-hash/sammymuya167-hash/pull/1). Latest native source commit: `deb5031ac548e1a30e67118e87391d89cf3f087e`.

[GitHub Actions run 37807999776](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37807999776) completed successfully. The Android job compiled debug and release variants, ran debug/release lint, and completed six API 35 emulator instrumentation checks with zero skipped or failed checks. They cover durable GPS acknowledgements, invalid acknowledgement rollback, FIFO delivery commands and reopen, version-one queue migration, encrypted credential clearing, telemetry reset and retained offline unlink.

The run produced an **aligned unsigned** release artifact, `routeforge-rider-release` (artifact ID `11563444125`). It includes the unsigned APK, apksigner tool/SDK notice, source SHA and source checksum manifest. It is not an installable signed release. Artifacts have limited retention; rebuild from the saved source when needed.

The workflow's web job checked the existing committed version-5 web source. It does not establish that the new office/API implementation is on GitHub or deployed.

The matching office/API implementation and later native refinements were in the uncommitted checkout at `/workspace/sites/routeforge` when the execution environment disconnected. Preserve that checkout if it recovers; do not reset, replace or discard its work.

Before the disconnect, local verification completed 43 Node checks, 57 built-Worker/D1 integration groups, lint, typecheck and a production Worker build. Later legacy-dispatch replay and stop-duty race refinements require another integration run. A seventh native UI/bridge instrumentation check and a polling guard were added locally but are not in the saved native commit or the six-check CI result. Final field testing and interactive browser QA have not been completed.

## Authorized release behavior

- Keep the useful planner controls: capacity, shift and cost assumptions, saved plans, imports, exports and manifests. Populate operational views from actual paired company drivers, orders and destinations.
- Detect GPS enabled separately from receipt of the first fresh fix. Reset old telemetry on pairing, request a fresh fix, and recover after the phone provider is enabled.
- Clear link ends company duty, revokes the native credential and cancels unfinished assignments for office follow-up, while retaining uploaded journey and payment history. Offline unlink is encrypted and retried once connected; the office cannot know about an offline action before it receives it.
- Riders can record collection and finish delivery. A normal End duty action is blocked while a delivery is unfinished; a clearly labelled privacy pause remains immediately available at all times and does not invent a completed delivery or payment.
- Broadcast each new order for a five-second first-accept window to fresh, on-duty, free company riders. The first atomic acceptance wins. After expiry choose a random currently eligible free rider; leave the order queued when none is free. Keep explicit manual and longest-idle office assignment.
- Persist rider actions in FIFO order with unique operation IDs. Remove only acknowledged reports; retain rejected reports with a visible error. Preserve exact legacy stop identity so replay cannot complete a different destination.
- After finishing delivery, riders report actual cash or company-till amount and an optional reference. Amounts use exact minor units. Reports contribute to office totals but remain distinct from office verification. No till API, transfer or settlement is implied.
- Show rider totals, payment/report history, order maps, destination navigation and queue/account controls in a dark navy/blue interface with restrained animation and reduced-motion support. Office includes a sales ledger, cash/till totals, verification/void controls and exported records.
- Use real OpenStreetMap tiles and uploaded GPS locations. Dashed lines are planning estimates; external navigation supplies road directions. Do not claim live camera imagery, guaranteed arrival/delivery or verified banking transactions.

## Local implementation locations to recover

Backend and database: `lib/driver-store.ts`, `lib/assignment-store.ts`, `lib/offer-store.ts`, `lib/office-context.ts`, updated office/tracking stores and contracts, `db/schema.ts`, additive migration `0004`, native bearer routes under `app/api/driver/`, office payment review route, and Worker execution-context wiring in `build/sites-worker.ts`.

Office/planner: `app/office/sales.tsx`, office forms/workspace, tracking portal/map, `app/planner/page.tsx`, restored `app/workspace.tsx`, real `app/route-map.tsx` and scoped `app/globals.css` styling. The portal references the future rider APK path, so do not publish it before the signed binary is present.

Native and checks: `android-driver/`, Node rider UI tests and the built-Worker/D1 integration suite. Documentation writes at disconnect were not confirmed; inspect before claiming they were saved.

All implementations are original and AI-assisted; retain existing licence and map/provider attribution. Do not commit real phone tokens, production driver records, signing keys, passwords or Site credentials.

## Signing and migration

The original pilot signing key is unavailable. The new client uses a separate application ID, `app.shadownet.routeforge.rider`, version code 2, version name `1.0-rider`, and must install alongside the pilot. It cannot be a silent replacement of that APK.

An owner-retained release key and password were generated and backed up privately. Public signing certificate SHA-256: `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c`. Never publish the key/password or send them to public CI.

For upgrade, first sync the pilot until its GPS queue is zero, then stop it. After the matching backend is deployed, create an upgrade pairing code for the existing paired driver. The new token replaces the old one while preserving the same driver ID, unfinished order, recorded journey and payment history. Keep the original pilot APK download intact.

Original pilot APK SHA-256: `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.

## Remaining release steps

1. Restore the execution workspace and recover all uncommitted source. Finish and rerun the final Worker/D1 checks; push the complete matching office/API and native source to the draft branch.
2. Run Android CI against the final native source, including the additional UI/bridge check. Download its artifact and compare the source checksum manifest to the checked-out native source.
3. Sign the aligned release APK locally with the private owner key. Verify its public signer certificate and SHA-256. Preserve the old APK and add the signed new APK plus honest release metadata.
4. Complete setup, architecture, limitations, attribution and verification documentation. Check the packaged Worker includes the expected APK bytes.
5. Publish through the existing Sites project, preserving public audience and private account data. Use the actual `pnpm build` command and the Sites source/package workflow. Save and deploy the exact pushed source, then verify terminal success and the current live URL.
6. Only after a verified live release, sync the final self-contained source to the profile repository's main branch and update the project index/featured description/build log accurately.

## Operational limitations

The five-second offer window is a server acceptance rule, not a guarantee that every phone receives a notification within five seconds. Active native duty polls offers; there is no new push-notification service. Expiry reconciliation uses a best-effort Worker background task and subsequent office/rider polling, so random fallback can be later than five seconds during outages.

Offline GPS, delivery, payment and unlink records become visible only after network recovery. Company-till entries are driver reports until an office person verifies them. Measured distance and suggested driver compensation remain GPS estimates. No refunds, split payments or bank reconciliation have been implemented for this release candidate.

## Blocker

The local execution server returned `409 Conflict, environment_offline: Environment is not connected`. Both the primary and independent read-only recovery probes failed. Cloud GitHub/Sites connectors remained available, allowing this checkpoint and native CI evidence to be saved. No signed APK or new Site deployment was completed.
