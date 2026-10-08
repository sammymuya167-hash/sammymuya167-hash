# RouteForge Rider 1.1 update

The office and rider app share one delivery reservation per phone. Rider 1.1 fixes delivery visibility and alerts while retaining the previous dashboard's planning and financial tools.

| Requested feature | Implemented behaviour | Verification |
| --- | --- | --- |
| New delivery sound and popup | Free, on-duty riders see a high-importance Android offer alert and an in-app banner on every tab. Account exposes sound/popup settings and a test alert. | Android channel/posting checks and packaged UI tests |
| Five-second claim line | The claim timer fills from left to right using the office deadline. The office displays the eligible-rider count and refreshes offer status every second. | UI deadline/expiry tests and Worker offer flows |
| Automatic assignment visible on phone | An assigned ride has a separate notification and persistent in-app banner, with collection, destination and finish controls. | Android assignment alert checks and Worker state tests |
| Busy rider cannot collect another order | Busy phones receive no claim controls. Native and server checks reject claims; the database reservation prevents concurrent double booking. | Stale-control, simultaneous claim and concurrent assignment tests |
| Random fallback | After the claim deadline, one currently free, on-duty rider with fresh GPS is selected randomly. With no eligible rider, the order returns to the office queue. | Worker deadline and fallback tests |
| Detect GPS on after enrollment | Enabled phone location is reported separately from the first fresh fix; current fixes and provider callbacks recover GPS updates. GPS-off or stale app contact blocks new assignments. | Runtime/GPS availability and scoped state tests |
| Unlink clears active office status | Unlink ends duty, revokes the phone link and cancels unfinished work when acknowledged. The active office fleet excludes the unlinked phone; uploaded history and payment records remain. Offline unlink retries securely. | Unlink, revocation and history-preservation tests |
| Finish rides before normal End duty | Riders confirm collection and finish delivery through working Android confirmation dialogs. Every legacy route stop must be completed before local normal End duty. Privacy pause remains available. | Worker completion and Android dialog/queue checks |
| Cash and company till after delivery | Riders enter the amount actually received and optional reference. Durable receipts prevent duplicate totals. Office review distinguishes reported and verified collections. | Payment replay, exact minor-unit, void and totals tests |
| Restore original dashboard tools | Routes & planning contains route maps, route/cost totals, delivery windows, weights, service times, capacity, shifts, rates, CSV import/export, manifests, optimization and saved scenarios. Office sales, partners, live tracking and history remain in shared navigation. | Company-scoped planner render and existing optimizer/CSV checks |
| Keep amounts and all-time totals | Sales & totals retains cash, till, verified receipts, expected order value, unpaid delivered orders, recorded kilometres and suggested driver pay. Totals include records older than the displayed history limit. | Worker totals across more than 500 records |

## Install and check

Install the published Rider 1.1 APK over the existing RouteForge Rider app on each rider phone. It uses the same package and signing certificate, so retain the current device link and local queue. No new pairing code is needed for an existing Rider installation.

In Account, use **Play delivery alert test**, then check both offer and assigned-delivery sound/popup settings. Start duty with GPS enabled and a fresh fix before offering work. A newly assigned order appears on Home and in the banner on every tab. Confirm collection, finish delivery, then enter cash or company till payment; review the report in office Sales & totals.

The five-second deadline is enforced by the server. Phones need a working connection and an active app service to receive offers promptly; Android volume, notification permission, channel settings, Do Not Disturb, scheduling and cooldown still govern sound and popups. Hardware sound and real-phone background delivery require a field check. Automated browser QA was unavailable in the managed build environment; no browser gesture result is claimed.

## Why the update was needed

Rider 1.0 used a three-second state read timeout. Its server state request reconciled company-wide GPS routes and mileage before returning the phone's own assignment. Rider 1.1 uses a device-scoped database batch and a longer read timeout, surfaces delivery-connection errors separately from GPS upload status, and retains cached work during outages. The current assignment is retrieved independently of the latest-ten-order history limit. Automatic and direct assignments now have their own native alert rather than relying on a still-open offer notification.

The full first dashboard's planning controls were retained in source but separated into another navigation shell. They now share the main office navigation. Planning drafts stay mounted when switching sections, and saved scenarios can be reopened for editing. Live customer collections remain clearly labelled separately from planning cost estimates.

Release checks and installer hashes are recorded in `/downloads/routeforge-rider-release.json` and the release checkpoint.
