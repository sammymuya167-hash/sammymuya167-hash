# Architecture and engineering decisions

## Request and storage boundary

The main browser workspace loads real company operations from `/api/office` and `/api/tracking/devices`. The retained planning API accepts scenarios at `POST /api/optimize`. Sites injects the authenticated identity; the handler requires it, checks same-origin browser requests, validates a bounded JSON payload with Zod, computes the plan and persists an immutable run. A failed database write fails the request rather than pretending the run was saved.

`GET /api/plans` returns only the current owner's saved plans and latest 15 runs. `POST /api/plans` creates a saved scenario or updates an existing record with both its ID and owner in the predicate. `PATCH /api/plans` archives or restores with the same ownership predicate. No client-supplied owner ID is accepted. Responses containing private data use `Cache-Control: private, no-store`.

D1 indexes `(owner_id, updated_at)` and `(owner_id, created_at)` support the plan and history views. SQL is generated through Drizzle migrations, with no runtime schema creation. Archive is a timestamp, so restore does not recreate or lose a plan.

## Optimization

1. Consider high-priority stops before standard stops, then earlier deadlines and heavier loads.
2. Evaluate every insertion position in every active vehicle's current route.
3. Reject candidates exceeding payload, arrival windows or depot-return shift deadline.
4. Choose the least incremental distance with a small incremental-duration tie preference.
5. Improve each route with at most five 2-opt passes, rechecking every hard constraint.
6. Return every unassigned stop with a capacity or combined-feasibility reason.

Input objects remain unchanged. The distance baseline uses the same assigned stops and vehicles, in input order, which makes the distance comparison reproducible. This is a planning heuristic, not a proof of optimality.

## Product integrity

The first view reads private stored records and actual paired phone GPS. Empty company records stay empty. No sample driver, vehicle, order, shop or office coordinate is inserted on load. Previous scenarios/runs remain an archive and do not become operational orders. CSV manifests and order exports neutralize spreadsheet formulas in text fields.

## Driver operations

`GET /api/tracking/devices` returns owner-scoped devices, current assignments and derived fleet alerts with private, no-store headers. `POST/PATCH /api/tracking/dispatch` require dispatcher identity and same-origin requests. Assignment creation verifies ownership of a paired, non-revoked device; mutations include the assignment ID so stale controls cannot cancel or confirm a replacement assignment. The `driver_dispatches` table has one row per device and an owner index.

The existing phone upload protocol and APK are unchanged. Immutable events and a durable batch acknowledgement remain the source of truth. Arrival reconciliation reads stored capture-time points after assignment/previous delivery, bounds inspection to the latest 5,000 eligible fixes, and uses revision plus exact-row compare-and-swap to avoid overwriting concurrent actions. A reconciliation failure does not invalidate acknowledged GPS; portal refresh retries processing. Dispatch state never automatically confirms delivery. Removing an already unlinked device explicitly removes its dispatch and GPS history together.

The web map uses Mercator projection, viewport-only OSM tiles, pointer capture for drag/pinch, cursor-anchor zoom and a selectable follow mode. Panning stores an independent viewport so polling does not snap it back to the route centre. Trip changes or gaps over five minutes break the drawn path. GPS speed supplies explicitly estimated activity; optional notifications run only in the open web dashboard. No new native permissions or remote binary updater are implemented.

## Next engineering milestones

- Add a road travel-time matrix provider and draw road-following geometry.
- Add authenticated driver-side assignment retrieval and road navigation in a separately signed native update.
- Add distance/cost objectives and regret insertion to improve difficult cases.
- Extend the Worker/D1 HTTP integration suite with browser accessibility tests in a supported QA environment.
- Add explicit commerce import integrations, fine-grained staff roles, pagination and a full event audit before scaling beyond one account office.

## Persistent office operations

Migration `0003` adds owner-scoped orders, partners, driver profiles, office settings, private geocoder caches and a global provider gate. Orders hold immutable location and rate snapshots plus current progress. Device IDs are validated against paired, non-revoked records; caller-supplied driver names and owner IDs are rejected. Profiles update contact/vehicle labels without touching device credentials.

`POST /api/office/orders` uses a client UUID and normalized input snapshot for retry idempotency. Partner selections are resolved again under the owner and active-state predicate; submitted coordinates cannot silently move a registered partner. A transaction reserves the one-per-device dispatch slot and changes the queued order only when both row version and reservation match. Concurrent attempts cannot double-book a phone or place one order on two phones. Server predicates independently check duty, contact freshness and GPS freshness.

The office assignment contains pickup and drop-off. Immutable GPS reconciliation detects arrival; confirmation changes the next stage only after that arrival. `office-sync.ts` derives order state from the authoritative dispatch using version plus exact-dispatch comparisons, preventing stale reconciliation from regressing a newer stage. Office reads retry derived state without requiring another upload. Canceling through either portal removes the active reservation and retains the cancelled order. Closed orders keep history when a later assignment replaces the dispatch slot.

Mileage sums stored fixes from assignment through destination arrival. Trip boundaries, gaps over two minutes, accuracy worse than 50 m, impossible speeds and stationary jitter are excluded. Processing is capped at the latest 5,000 points and flags truncation as an excluded segment. Rate is snapshotted on assignment. Suggested pay is a reviewable estimate, never a payment instruction or transfer.

`/api/office/places` proxies a fixed HTTPS Photon endpoint, validates bounded queries/GeoJSON, restricts country to Kenya and caches under the owner's identity. A D1 reservation enforces the provider throttle across isolates. Failure leaves saved partners and map pin/coordinate selection usable. Place queries disclose the typed address to the external provider; only the account's API can read its cached query results. The source contains no real company names, phone contacts, journey points or tokens.
