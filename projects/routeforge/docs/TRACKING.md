# Driver tracking
RouteForge pairs consenting Android drivers using a one-time code. A phone number or IMEI alone cannot locate a phone. Phone and vehicle fields are labels; no IMEI lookup, SMS lookup, contact access or hidden recording is implemented.

## Dispatcher setup
1. Sign in at /tracking and choose **Link a driver**.
2. Enter a driver name, vehicle label and optional phone label.
3. Share the 20-character code privately with that driver. It expires after ten minutes and can be used once.
4. On the driver's Android 8+ phone, download the signed **RouteForge Rider** APK from the portal, install it and enter the code.
5. The driver reads the sharing disclosure, agrees and grants precise location and notification permissions. New enrollment starts duty after permissions are granted; **Start duty** is available for later sessions. Phone location being enabled and receiving a fresh GPS fix are displayed separately.
6. See the driver's GPS map and timeline. Choose a past journey or the last 24 hours. Load earlier points when the page reports more history.
7. **Unlink device** revokes upload credentials immediately. Existing uploaded history remains private to its dispatcher. An explicit delete action is available after unlinking.

## Live dispatch and map controls
The main **Dispatch** and **Drivers & fleet** views show only paired, non-revoked company phones. Available counts require on-duty status, fresh GPS and no unfinished assignment. The **Live tracking** button opens a map dialog with a driver column. Previous planner scenarios remain under Saved plans. Select a driver to centre on their latest fix. The full tracker adds capture-time journey history.

Drag to pan, use arrow keys with the map focused, scroll at a location to zoom there, or pinch with two fingers. Plus/minus zoom around the followed driver. **Follow driver** recentres and follows new fixes; manual pan or wheel zoom pauses follow. **Fit journey** includes fixes, linked driver markers and destinations. Zoom reaches level 19, and fullscreen expands the map. Street detail depends on available map tiles and the phone's accuracy; extra zoom cannot improve GPS accuracy.

Create a collection/delivery from the office or the selected driver in the tracker. Locations offer registered partner suggestions, place search and a checked map pin; coordinates populate from the selection. Offer the order to free riders for five seconds, use longest-idle assignment or choose an available company driver manually. The first accepted offer wins; otherwise a free eligible driver is selected at random. One current dispatch exists per phone. Canceling leaves recording and GPS history intact. New office orders retain completed/cancelled history; legacy standalone dispatches retain no separate audit archive. See [OFFICE.md](OFFICE.md) for setup and assignment rules.

GPS arrival requires two distinct fixes at least 15 seconds apart in the same trip, with at most a two-minute gap. Both must have accuracy no worse than 50 m (or half the radius) and their position plus uncertainty must fit inside the arrival radius, normally 100 m. Fixes before assignment or the previous delivery confirmation do not count. Leaving the radius resets the candidate. Offline arrivals retain their capture timestamp when the stored queue returns. The server reads immutable stored GPS events, never an altered upload retry.

**GPS arrived**, **collection confirmed** and **delivery confirmed** are separate states. Confirm the pickup collection before monitoring drop-off, then confirm parcel delivery at the destination. Both the office and tracker share these stages. Battery, speed, heading and accuracy come from existing GPS uploads. Stationary/walking/moving/vehicle-speed labels are estimates; a cyclist or runner can overlap another category. Old, imprecise or missing speed becomes unknown. Movement-change alerts need two distinct observed speed readings. Low battery, delayed location, stopped trips and arrival also appear in the dashboard. Optional browser alerts work while that dashboard is open; there is no always-on push service.

The Street View link opens available historical surroundings imagery on Google Maps. It is not a live camera and may have no coverage at the selected location. Opening the link shares that location with Google Maps.

## Updating an active fleet

**Already using RouteForge Rider 1.0:** install Rider 1.1 over the existing Rider app. The package and owner signing certificate stay the same, so keep the current link and local queue. Do not unlink, clear storage or request a new pairing code just to install this update. In Account, play the delivery alert test and check both offer and assigned-delivery settings.

This release includes a new, owner-signed Rider app, using application ID `app.shadownet.routeforge.rider`. The old pilot's signing key is unavailable, so Rider installs alongside it for the one-time migration. Future Rider releases must use the same retained owner signing key for install-over upgrades.

1. In the old pilot, sync until its local queue is empty, then stop its trip. Keep it stopped so both apps do not record the same journey.
2. In the office tracking portal, find the existing driver and choose **Rider app upgrade code**. The code expires after ten minutes and can be used once.
3. Install `/downloads/routeforge-rider.apk`, open **RouteForge Rider**, agree to sharing and enter that upgrade code.
4. Allow precise location and notifications. The upgrade rotates the phone token and reconnects the same driver, current assignment, payment records and uploaded history. The old pilot token stops working after the new app pairs.
5. Check that Rider shows phone location enabled and receives a fresh GPS fix. Refresh the office dashboard to load the new interface.

For a new driver, use **Link a driver** rather than an upgrade code. Clearing a phone link and its local queue sends a durable unlink request to the office; when received, it marks the driver unlinked/off duty and cancels unfinished assignments without deleting uploaded history. An offline unlink request retries after reconnection and must sync before the phone can pair again.

## Rider delivery and payment controls

Rider 1.1 has Home, Offers, Route, Trips and Account views with animated navigation. New offers appear in a banner on every tab, with a claim button and a left-to-right five-second progress line. Assigned deliveries have their own sound/popup notification and an active-ride banner with navigation and completion controls. Offers appear while a linked rider is free and on duty. The server accepts only claims received before its five-second deadline. Polling, internet access and Android scheduling govern notification delivery; a powered-off or offline phone cannot receive an offer promptly.

The rider confirms product collection, then taps **Finish delivery / ride** to close the same order shown in the office. Legacy multi-stop assignments confirm the next stop by its identity, so retrying one confirmation cannot complete a later stop. **End duty** is blocked during an unfinished assignment. **Privacy pause** always stops GPS immediately and keeps unfinished work flagged for office follow-up.

After finishing, the rider reports the actual amount received as cash or company till, with an optional receipt/reference. The app saves completion and payment reports offline and uploads them in order with durable operation IDs. It shows server acknowledgment separately from locally queued reports. Reports appear in the office's sales totals for review; **Office verified** means the office checked the cash/receipt. RouteForge does not transfer money or automatically verify a till transaction.

## Recording and offline operation
The Android app runs a location foreground service started with driver consent. Its ongoing recording notification is visible and silent, with a **Privacy pause** action. Delivery offers and assigned rides each use a high-importance sound/vibration notification channel controlled by Android. Account shows the actual sound and popup settings, links to both channel settings and offers a delivery alert test. Muted volume, disabled notifications, Do Not Disturb and OS scheduling remain visible operating constraints. **End duty** controls appear in the app. No boot receiver restarts GPS recording, and no background-location permission is requested.

Rider requests GPS/network fixes every ten seconds with no minimum displacement, so stationary phones can refresh their position. It also requests a current fix when duty starts or a location provider becomes enabled. Uploads are attempted about every ten seconds; rider offers/state are polled approximately every second while the service is running. The first fix can take longer. Android controls actual sampling and scheduling. A foreground connectivity callback attempts upload when network access returns. GPS capture continues without internet while the running service has location permission and a usable GPS signal.

Each start, fix and stop is written to local SQLite with a UUID and its original capture timestamp. Uploads contain up to 50 events. Only acknowledged UUIDs are deleted; retries are idempotent. Network failures leave the queue intact. Persisted JobScheduler jobs retry the queue after a trip ends, including after reboot, without starting GPS. Android decides when those jobs run.

Offline capture needs a powered-on phone, enabled location and an active recorder. Powering off, force-stopping, rebooting, permission removal, exhausted storage, battery restrictions or an OS stop can leave gaps. Open the app and tap **Start duty** again after an OS stop. In-app unlinking warns before deleting unsent GPS events and local delivery/payment reports. Clearing app storage or uninstalling also deletes unsent data. Sync the queue before clearing or uninstalling. Office unlinking stops uploads and recording when the phone next contacts the portal.

The portal separates GPS capture time from phone contact time. A received backlog cannot move the latest location backwards or turn an old GPS fix into a live one. “Location delayed” is a last-known position, not proof the phone is connected. “Live” means a GPS fix and a phone contact within 90 seconds; it is not an accuracy guarantee.

## Privacy and security
Dispatcher endpoints use Sites' trusted ChatGPT identity and filter all devices and histories by owner. Device upload tokens only authorize their own device. Pairing uses 80-bit random, expiring, single-use secrets consumed by an atomic database update. Device tokens use 256 bits of randomness. Only SHA-256 hashes are stored on the server. On the phone, credentials are encrypted with Android Keystore; backup and device transfer are disabled. No location or token is logged.

Device uploads use HTTPS with redirects disabled. Input validation bounds coordinates, accuracy, timestamp drift, payload bytes and batch size. SQLite event IDs are unique per device. Batch transactions protect the queue acknowledgement contract; immutable stored events determine live metadata so altered retries cannot rewrite positions. Pairing codes and tokens are not returned by dispatcher listing endpoints or stored in GitHub.

GPS history remains in the private app database until the dispatcher explicitly deletes the unlinked device. OpenStreetMap supplies the visible web basemap with attribution and browser caching. Tiles are requested only for the current map viewport; no tile prefetch or offline tile downloading. Map tile requests disclose the viewed map area to the tile provider. GPS recording and offline capture do not depend on those tiles.

## Signed Rider release
The Rider installer is a signed release APK with the owner-controlled certificate `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c`. Its release metadata is `/downloads/routeforge-rider-release.json`. Native source lives in `android-driver`; private signing material is excluded from source and public deployment. The old `/downloads/routeforge-driver.apk` debug pilot remains unchanged for compatibility. Rider supports Android 8+/API 26 and targets API 35; behaviour on actual fleet devices still requires field verification.

Automated Worker/D1 tests exercise owner isolation, single-use/expired/concurrent pairing, acknowledgement durability, duplicate uploads, immutable retries, dispatch privacy, arrival, delivery confirmation, cancellation, stale actions, revocation and explicit history removal. Android build/lint checks verify the installable project. The office integration checks additionally cover partner/settings isolation, idempotent requests, simultaneous assignment, duty/freshness checks, both collection/drop-off stages, mileage/rate snapshots and mocked geocoder contracts. The owner reports a successful real journey test; background behaviour, battery restrictions and offline-to-online recovery across devices still require field verification. This dashboard update was tested using synthetic fixtures, without inspecting live driver locations.

## Build
Web: pnpm install --frozen-lockfile; pnpm run typecheck; pnpm run lint; pnpm test; pnpm run build; pnpm run test:integration.
Android: JDK 17, Gradle 8.11.1, Android SDK 35/build-tools 35.0.0; from android-driver run `gradle :app:assembleDebug :app:assembleRelease :app:lintDebug :app:lintRelease :app:assembleDebugAndroidTest`. Release builds are aligned and signed privately with the retained owner key.
Read the published Android build workflow for reproducible CI. The SQLite instrumentation tests cover the offline acknowledgement contract; they require an emulator or test phone.

Current unchanged pilot APK SHA-256: `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.

Current signed Rider APK SHA-256 is recorded in `/downloads/routeforge-rider-release.json` and verified against the publicly served installer.
