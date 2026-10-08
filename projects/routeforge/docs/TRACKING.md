# Driver tracking
RouteForge pairs consenting Android drivers using a one-time code. A phone number or IMEI alone cannot locate a phone. Phone and vehicle fields are labels; no IMEI lookup, SMS lookup, contact access or hidden recording is implemented.

## Dispatcher setup
1. Sign in at /tracking and choose **Link a driver**.
2. Enter a driver name, vehicle label and optional phone label.
3. Share the 20-character code privately with that driver. It expires after ten minutes and can be used once.
4. On the driver's Android 8+ phone, download the pilot APK from the portal, install it and enter the code.
5. The driver reads the sharing disclosure, agrees, grants precise location and notification permissions, and taps **Start trip**.
6. See the driver's GPS map and timeline. Choose a past journey or the last 24 hours. Load earlier points when the page reports more history.
7. **Unlink device** revokes upload credentials immediately. Existing uploaded history remains private to its dispatcher. An explicit delete action is available after unlinking.

## Live dispatch and map controls
The main **Dispatch** and **Fleet** views show actual linked phones alongside the planner. Planned vehicles remain a separate count. Select a driver to centre on their latest fix. The full tracker adds capture-time journey history.

Drag to pan, use arrow keys with the map focused, scroll at a location to zoom there, or pinch with two fingers. Plus/minus zoom around the followed driver. **Follow driver** recentres and follows new fixes; manual pan or wheel zoom pauses follow. **Fit journey** includes fixes, linked driver markers and destinations. Zoom reaches level 19, and fullscreen expands the map. Street detail depends on available map tiles and the phone's accuracy; extra zoom cannot improve GPS accuracy.

Assign an optimized route from the current planner or saved plans, or enter a destination name and coordinates. The assignment is stored privately against the paired device. Only one current dispatch exists per phone. Canceling an assignment leaves recording and GPS history intact; completing/replacing it does not retain a separate dispatch audit archive.

GPS arrival requires two distinct fixes at least 15 seconds apart in the same trip, with at most a two-minute gap. Both must have accuracy no worse than 50 m (or half the radius) and their position plus uncertainty must fit inside the arrival radius, normally 100 m. Fixes before assignment or the previous delivery confirmation do not count. Leaving the radius resets the candidate. Offline arrivals retain their capture timestamp when the stored queue returns. The server reads immutable stored GPS events, never an altered upload retry.

**GPS arrived** and **delivery confirmed** are separate states. The dispatcher confirms the arrived next stop before monitoring the following destination. Battery, speed, heading and accuracy come from existing GPS uploads. Stationary/walking/moving/vehicle-speed labels are estimates; a cyclist or runner can overlap another category. Old, imprecise or missing speed becomes unknown. Movement-change alerts need two distinct observed speed readings. Low battery, delayed location, stopped trips and arrival also appear in the dashboard. Optional browser alerts work while that dashboard is open; there is no always-on push service.

The Street View link opens available historical surroundings imagery on Google Maps. It is not a live camera and may have no coverage at the selected location. Opening the link shares that location with Google Maps.

## Updating an active fleet
This release changes the web dashboard and server only. The APK, pairing credentials and upload/acknowledgement protocol are unchanged. Refresh the dispatcher's browser once for the new interface; the installed phone continues recording and syncing without reinstalling or pairing again. This is not a silent updater for native Android code. New phone-side permissions, activity recognition, phone-usage collection or camera features would require a separately signed app update and driver approval.

## Recording and offline operation
The Android app runs a location foreground service started by the driver. Its ongoing notification is visible and silent: no repeated popup, sound or vibration. It includes a Stop trip action. Stop controls also appear in the app. No boot receiver restarts GPS recording, and no background-location permission is requested.

GPS fixes are requested every 15 seconds with a 5 metre displacement filter, and uploads are attempted about every 10 seconds. The first fix can take longer. Android controls actual sampling and scheduling. A foreground connectivity callback attempts upload when network access returns. GPS capture continues without internet while the running service has location permission and a usable GPS signal.

Each start, fix and stop is written to local SQLite with a UUID and its original capture timestamp. Uploads contain up to 50 events. Only acknowledged UUIDs are deleted; retries are idempotent. Network failures leave the queue intact. Persisted JobScheduler jobs retry the queue after a trip ends, including after reboot, without starting GPS. Android decides when those jobs run.

Offline capture needs a powered-on phone, enabled location and an active recorder. Powering off, force-stopping, rebooting, permission removal, exhausted storage, battery restrictions or an OS stop can leave gaps. Open the app and tap Start trip again after an OS stop. Clearing the device link, clearing app storage or uninstalling deletes unsent local data after an explicit in-app clear warning. Do not clear or uninstall before the queue is uploaded. Unlinking stops uploads and recording when the phone next contacts the portal.

The portal separates GPS capture time from phone contact time. A received backlog cannot move the latest location backwards or turn an old GPS fix into a live one. “Location delayed” is a last-known position, not proof the phone is connected. “Live” means a GPS fix and a phone contact within 90 seconds; it is not an accuracy guarantee.

## Privacy and security
Dispatcher endpoints use Sites' trusted ChatGPT identity and filter all devices and histories by owner. Device upload tokens only authorize their own device. Pairing uses 80-bit random, expiring, single-use secrets consumed by an atomic database update. Device tokens use 256 bits of randomness. Only SHA-256 hashes are stored on the server. On the phone, credentials are encrypted with Android Keystore; backup and device transfer are disabled. No location or token is logged.

Device uploads use HTTPS with redirects disabled. Input validation bounds coordinates, accuracy, timestamp drift, payload bytes and batch size. SQLite event IDs are unique per device. Batch transactions protect the queue acknowledgement contract; immutable stored events determine live metadata so altered retries cannot rewrite positions. Pairing codes and tokens are not returned by dispatcher listing endpoints or stored in GitHub.

GPS history remains in the private app database until the dispatcher explicitly deletes the unlinked device. OpenStreetMap supplies the visible web basemap with attribution and browser caching. Tiles are requested only for the current map viewport; no tile prefetch or offline tile downloading. Map tile requests disclose the viewed map area to the tile provider. GPS recording and offline capture do not depend on those tiles.

## Pilot release
The downloadable APK is an internally signed **debug pilot**, not a Google Play release. Native source lives in android-driver. For a managed fleet release, use an owner-controlled signing key and configure upgrade continuity before distributing updates. A differently signed APK requires uninstalling the old app: sync every queued event first. Android 8–15/API 26–35 is the build target range; newer versions must be verified on the actual driver phone.

Automated Worker/D1 tests exercise owner isolation, single-use/expired/concurrent pairing, acknowledgement durability, duplicate uploads, immutable retries, dispatch privacy, arrival, delivery confirmation, cancellation, stale actions, revocation and explicit history removal. Android build/lint checks verify the installable project. The owner reports a successful real journey test; background behaviour, battery restrictions and offline-to-online recovery across devices still require field verification. This dashboard update was tested using synthetic fixtures, without inspecting live driver locations.

## Build
Web: pnpm install --frozen-lockfile; pnpm run typecheck; pnpm run lint; pnpm test; pnpm run build; pnpm run test:integration.
Android: JDK 17, Gradle 8.11.1, Android SDK 35/build-tools 35.0.0; from android-driver run gradle :app:assembleDebug :app:lintDebug.
Read the published Android build workflow for reproducible CI. The SQLite instrumentation tests cover the offline acknowledgement contract; they require an emulator or test phone.

Current unchanged pilot APK SHA-256: `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.
