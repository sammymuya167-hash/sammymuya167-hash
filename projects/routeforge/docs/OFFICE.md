# Main office operations

The office reads the owner's existing paired phones. It seeds no drivers, vehicles, orders, partner shops or office address. Existing devices, GPS history, the pilot APK and saved planning records are preserved. Refresh the office browser after deployment. Phone-side offers, completion and payment reports require the new signed Rider app; use an existing driver's upgrade code to retain its record and assignment.

## First setup

1. Sign in to the same ChatGPT account used for linking the drivers.
2. Open the company name in the sidebar. Set the office name and select the actual collection entrance, using place search or a checked map crosshair. The computer location button asks the browser for a location only when clicked. Driver GPS is not assumed to be the office address.
3. Open **Drivers & fleet → Driver details**. Complete the vehicle/registration, callable phone number and duty status. An optional agreed KSh/km rate is saved for future assignments. Changing it does not rewrite earlier order rates.
4. Open **Partner destinations → Add destination**. Search a shop, building, street or area; check the entrance pin and save the shop name/contact. Pausing a partner prevents new selections while retaining past orders.

The system cannot infer the real office address, shop registry, vehicle registrations, phone contacts or agreed rates. These fields must be entered by the office. Previous saved planning locations are offered as clearly labelled suggestions, without silently registering them as business partners.

## Create and dispatch

**New delivery** stores a collection point, delivery point, reference and instructions. Selecting a search result or registered partner fills coordinates. Editing search text clears an old selection; a name typed without a selected location cannot create the request. Use **Save to queue** if there is no available driver.

Automatic assignment chooses the free, on-duty, non-revoked paired driver with a GPS fix and phone contact within 90 seconds. Longest idle time means the oldest of the driver's latest office assignment/release cycle; a driver never assigned here comes first. Ties use straight-line pickup proximity, then a stable ID. It does not interpret a stationary phone as proof the driver is available. Manual selection lists only onboarded drivers and applies the same availability rules. If another dispatcher assigns work first, the losing request stays queued.

**Offer to riders · 5s** broadcasts the stored order to eligible free riders. Android Rider phones poll for offers while on duty and show a delivery notification. The first claim received before the server deadline wins, using a database reservation to prevent double assignment. After five seconds, the server chooses a free eligible driver at random; if none is available, the order returns to the queue. The durable deadline is recovered by subsequent office/rider polls if the best-effort server wakeup is interrupted. Internet loss or Android scheduling can delay an alert; an offline phone cannot claim an expired offer.

The pickup and destination are shown on the actual GPS map. GPS arrival needs two precise fixes inside the 100 m radius, at least 15 seconds apart in one trip and no more than two minutes apart. The office confirms collection, then follows the destination and confirms delivery. GPS arrival does not prove a parcel handover. Cancellation from either the office or tracker closes the same order and keeps the phone recorder running.

## Monitor and contact

**Live tracking** opens a dedicated map dialog with company drivers in a side column. Select a driver, pan/zoom, follow new fixes and inspect battery, speed, accuracy and estimated movement. The office shows the latest 500 points from the last 24 hours; the full tracker can load earlier history. Offline phones keep a visibly delayed last-known position and are excluded from new assignments.

**Driver details** includes a `tel:` call link when a valid phone is saved. The link opens the device's configured calling application; it does not place a call by itself or provide a calling service for a computer without one. Optional browser notifications apply to the currently open dashboard.

## Mileage and rate estimates

Initial distance is straight-line driver-to-pickup plus pickup-to-destination. Recorded mileage sums sampled GPS fixes from assignment through destination arrival, excluding trip boundaries, gaps over 120 seconds, accuracy over 50 m, jumps over 45 m/s and stationary jitter. The server processes at most the latest 5,000 eligible fixes; an excluded segment also flags truncation. Recording can miss real travel, especially offline gaps, OS stops or poor GPS. No road-routing distance, live traffic, certified mileage or payment transfer is provided. Review the GPS estimate and agreed rate before paying.

## Driver app boundary

The signed **RouteForge Rider** app retrieves the same office assignment and provides destination maps, offer acceptance, collection confirmation, delivery/ride completion and customer payment reports. Maps show recorded GPS and destination pins; external navigation opens the destination in Google Maps. The office retains its GPS-arrival confirmation controls. **End duty** requires completion of active deliveries. **Privacy pause** always stops sharing immediately and flags unfinished work for follow-up.

Existing pilot apps retain their GPS upload protocol. Before migrating, sync the pilot queue and stop its trip. Generate **Rider app upgrade code** on the existing driver card, install Rider alongside the pilot, then pair Rider with that code. This rotates the token while retaining the driver, assignments and payment/history records. Phone-side unlinking revokes the link, ends duty and cancels unfinished assignments when its request reaches the server; offline unlink requests remain encrypted and retry when connected.

## Sales and payment review

Enter the expected customer amount when creating an order. After finishing delivery, a rider reports the amount actually received as **Cash** or **Company till**, with an optional receipt/reference. Completion and payment reports have durable operation IDs and retry in order after an outage; repeat uploads cannot create duplicate sales. Reports contribute to customer collection totals immediately, with **Awaiting office review** clearly shown. Office staff verify cash or the till receipt, then mark it **Office verified**, or **Void report** while retaining its audit record. The app does not transfer money or automatically verify M-Pesa receipts.

**Sales & totals** shows reported cash/till, verified collections, today's Nairobi collections, expected order value, delivered orders awaiting reports and recorded mileage/driver-cost estimates. All-time totals include records older than the latest 500 displayed rows. CSV export covers the currently displayed payment reports.

## Data and limits

All office records and GPS endpoints require the trusted hosting identity and filter by owner. Mutation endpoints enforce same origin and reject a submitted owner ID. Responses use `Cache-Control: private, no-store`. Public GitHub source and the public sign-in shell contain no production company contacts or coordinates. The current office is one account's workspace; shared staff roles are not implemented.

Limits: 50 linked/pending phones under the existing tracking quota; 250 partners; 300 open requests; 500 displayed recent orders and payment reports, with open orders first. Older records remain stored and contribute to all-time totals but do not yet have pagination. **Route planner & costs** loads the office's saved depot, queued destinations and paired fleet; planner drafts calculate capacity, shifts, manifests and estimates without dispatching live work. Saved planning scenarios remain archived separately. Apply migrations `0000` through `0004` in order for a new installation; the hosting deployment applies additive migrations to the existing D1 database.

## Place search, attribution and reuse

Place search uses [Photon's public API](https://github.com/komoot/photon/blob/master/docs/api-v1.md), restricted to Kenya. Its [maintainer notes](https://github.com/komoot/photon) allow reasonable project use but provide no availability guarantees and may throttle extensive use. The browser debounces queries for 1.2 seconds; a database gate reserves at most one uncached upstream request per 1.1 seconds across accounts. Owner-scoped results are cached for 24 hours with a maximum of 200 entries per owner. An 8-second timeout and failure message leave registered partners, manual coordinates and map pin selection available.

Typed search text is sent to Photon. Map tiles reveal the viewed map area to OpenStreetMap's tile provider; Google Maps links disclose the selected coordinates when opened. Neither external service receives phone tokens or order records. Search results may identify an area centroid rather than an entrance: the office must check the pin. A server-only `PLACE_SEARCH_URL` can point to an authorized HTTPS Photon-compatible endpoint for later scale; no new paid service or credential is introduced here.

Photon is Apache-2.0 licensed and is used as an external API; no upstream code or assets were copied. Map and geocoder data are © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under ODbL. UI attribution is retained. The office implementation is original AI-assisted TypeScript/React, under this project's MIT licence. Existing VROOM reference attribution remains in the project README.

## Checks

Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, a production build, then `pnpm run test:integration`. Tests cover owner isolation, idempotent orders, partner resolution, pending/foreign/off-duty/stale drivers, competing phone/order reservations, two-stage arrival/confirmation, cancellation from both interfaces, mileage/rate snapshots, idle timestamps and unchanged APK serving. Photon contract tests use a synthetic outbound fixture; they do not establish public-provider uptime. Real browser gestures and phone hardware require verification in a supported browser/device environment.
