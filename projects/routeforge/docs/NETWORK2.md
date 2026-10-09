# RouteForge 2.0: hybrid delivery network

This release extends the existing RouteForge Sites project and its DB binding. It preserves the main office, saved planner, tracking devices and payment reports, and updates the signed Rider app to 1.4. It creates no replacement app or database. The network is approval-gated; it does not seed fictitious merchants, riders, orders, service areas or prices.

## Operating the rollout

1. Sign in with the existing platform office account and open `/admin/network`. Configure actual supported area circles, base/per-km estimated fees and commission. Pricing is in KES; integer minor amounts are cents. Area changes create a new version.
2. Register a business at `/register`, or adopt an existing office from `/merchant`. Adoption uses its current owner ID; it does not move or clone existing records. New businesses remain pending until administrator approval.
3. Create and check each branch entrance using the existing address picker and map pin. Branch edits affect future requests; created deliveries retain their pickup snapshot. Paused branches cannot receive new requests or accepted offers.
4. Create office-issued rider logins, enroll the actual device, vehicle type, capacity and area, and obtain the rider's consent to live GPS. Enroll platform-owned devices as shared riders from administration. Existing un-enrolled devices continue using the original office workflow.
5. Choose owned, shared or hybrid mode. Shared dispatch needs an explicit saved acceptance for the delivery's area and current rate version. Hybrid fallback also needs the fallback switch. Newly added areas are never covered by consent for another area with the same version number.
6. Create an integration, save its one-time key and signing secret on the merchant's server, and configure a public HTTPS status callback. Both credentials are shown only to an authorized manager/owner during creation. Ordinary API responses and client bundles contain neither credential.
7. Submit an order with `ready:false`. Mark it ready when collection is possible. An ordering system may submit `ready:true` when it already has that authoritative signal. Manual requests use the same backend, branch rules and dispatch engine.
8. Use the web rider portal `/rider` for network deliveries in this release. Keep it open while online. Send the privately supplied customer OTP to finish a network delivery. Customer links are `/track#<token>`; the fragment is not sent as a URL parameter.
9. Review delivery exceptions, callback failures, provisional earnings and audit records. Configure real rates and pilot with consenting riders before opening merchant approvals broadly.

The signed Android Rider 1.4 application supports merchant-owned and shared-fleet offers, declines, pickup/drop-off navigation, assigned-customer dialing and OTP delivery completion. Collection and completion reports retry durably after connection loss, with encrypted OTP storage and a correction control for rejected proofs. Legacy office deliveries retain their payment reports and multi-stop controls. APK and native Android verification results are recorded in the rider release metadata. Real-phone battery, background GPS and notification behavior still require field verification. Signing in on another client rotates the device token, so avoid switching clients while a phone has unsynchronized reports.

## Permissions

Every database access derives organization scope from the authenticated office account or verified integration credential. Caller-supplied merchant/owner IDs are rejected by the delivery schema. Shared riders keep their platform device owner; only their exact accepted assignment grants access to the merchant's customer details.

| Capability | Owner | Manager | Dispatcher | Rider | Platform administrator |
| --- | --- | --- | --- | --- | --- |
| Merchant deliveries and tracking | Own tenant | Own tenant | Own tenant | Assigned work | Operational overview |
| Create / ready / retry / cancel requests | Yes | Yes | Yes | No | Through authorized merchant scope |
| Profile, branches, vehicles and integrations | Yes | Yes | No | No | Shared fleet / area administration |
| Staff permissions and disablement | Yes | No | No | No | Merchant approval/suspension |
| Credential creation/revocation | Yes | Yes | No | No | No cross-tenant secret disclosure |
| Private financial reports | Yes | Yes | No | Own provisional earnings | Commission/earnings review |
| Accept, collect and finish a delivery | No | No | No | Exact assignment; OTP for completion | No proof bypass |

The platform administrator must have the owner role and the exact configured existing platform owner ID. Suspending a merchant blocks dashboard/API access and new dispatch. Staff disablement increments the account version, immediately invalidating current sessions; reenabling does not resurrect them. Legacy endpoints also enforce staff permissions, pending approval and suspension. Network deliveries cannot bypass OTP through old office confirmation or tracking controls.

## REST and webhook contract

The public guide is `/integrations`. The downloadable schema is `/openapi.json`.

Use server-to-server JSON and `Authorization: Bearer <API key>`. Keys are tenant-scoped, revocable and rate limited. Branch IDs are UUIDs returned by `GET /api/v1/branches`.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/v1/branches` | Authorized registered pickup branches |
| POST | `/api/v1/quote` | Area validation and estimated KES fee |
| POST | `/api/v1/deliveries` | Create/replay one external delivery |
| GET | `/api/v1/deliveries/{id}` | Tenant-scoped status, fee, exception and proof method |
| POST | `/api/v1/deliveries/{id}/ready` | Start dispatch for a queued request |
| POST | `/api/webhooks/{integrationId}` | HMAC-authenticated universal delivery intake |

A place includes `name`, `address`, numeric `lat`, numeric `lng` and optional `source`. `windowEnd` is a UTC epoch timestamp in milliseconds, not a date string. Fees are straight-line distance × the area road factor; traffic and routed road distance are not included.

Before the first submission, the ordering system must persist an external ID, a cryptographically random 32-byte lower-case hexadecimal tracking token, and a six-digit delivery OTP. It sends the exact same payload on retry, with `Idempotency-Key` equal to `externalId` if that header is supplied. RouteForge stores hashes of the tracking token and salted OTP; it never returns them from status/list APIs or retains an OTP in successful action replay receipts. The merchant provides the link and OTP through its own customer channel; automatic SMS is not implemented.

A unique `(merchant_id, external_id)` database index and an atomic D1 batch protect concurrent intake. Same payload returns the same delivery ID. Changed details return 409; readiness changes use the ready endpoint. A request cannot override its branch pickup. An invalid branch returns 404; invalid/out-of-area input returns 422. Invalid/revoked keys return 401, pending/suspended merchants 403, and rate limits 429.

For signed intake, send Unix seconds in `X-RouteForge-Timestamp` and lower-case hexadecimal HMAC-SHA256 of `timestamp + "." + exact raw JSON body` in `X-RouteForge-Signature`, using the integration signing secret. Timestamp tolerance is five minutes. Signed retries still use the same external ID/payload; valid signature replay cannot create another delivery.

Callbacks carry the same timestamp/body signature plus `X-RouteForge-Event-Id`. The event ID remains stable across retries. Verify the raw-body signature, durably save the ID, ignore repeats, apply only a newer `version`, and acknowledge with 2xx. Events can arrive out of order. Payloads include IDs, status, version, fee/currency and occurrence time, and exclude customer phones and API secrets. A revoked integration stops outgoing callbacks. URLs must be public HTTPS without credentials or custom ports; redirects are not followed.

Native Shopify and WooCommerce connectors are planned. Each needs its native signature verifier, verified store credentials, address geocoding, branch mapping, explicit collection-readiness mapping and safe fulfillment/tracking writeback. Their native webhook bodies/signatures are not compatible with the universal endpoint. Custom ordering systems can use the universal contract now.

## Dispatch and recovery

Only fresh (within 90 seconds), accurate GPS, current duty/heartbeat, enabled enrollment, area membership, appropriate vehicle and sufficient declared package capacity qualify. One unfinished assignment occupies a device's existing dispatch slot. Owned mode uses merchant riders. Hybrid considers eligible own riders before shared riders and requires fallback consent for shared candidates. Priority and delivery deadlines order due work; pickup distance and a vehicle speed estimate rank candidates. This is an ETA estimate, not traffic-aware optimization. Busy riders are excluded; multi-job batching is not enabled.

A D1 lease and partial unique pending-offer index protect offer generation. Offers last 30 seconds. Acceptance rechecks live eligibility, branch, capacity, fleet/consent and expiry, then atomically reserves the device slot and order with version checks. Declined/expired riders are excluded for that request. After 20 offers, an explicit dispatcher retry is required. A retry archives declined/expired attempts; cancelled or completed work cannot be reassigned. Privacy pause remains available during a delivery. Unlinking a shared rider cancels the correct merchant order and clears only its exact assignment.

The web rider uses stable operation UUIDs and device-scoped durable browser queues. It removes actions/GPS only after server acknowledgement. Transient failures retry on reconnect/polling. Rejected commands remain visible for review and dismissal without blocking subsequent GPS synchronization. Acceptance/decline are online-only because offers expire. Geolocation depends on browser/OS behavior and requires an open page; the existing native recorder remains the background GPS option for legacy work.

Status events and the outbox are persistent and deduplicated. Callback leases prevent concurrent consumers from taking the same pending row. Retry delay grows exponentially, up to one hour; at eight failures, administration must explicitly retry. Missing current-version events are recovered from persisted order state. Proof completion accrues exactly one earnings record per order.

Due work runs after rider heartbeats and merchant/admin dashboard requests, plus a best-effort offer deadline wakeup. The scheduled retry worker in `operations/retry-worker` invokes the same engine every minute even when every client is closed. It runs as a small component in the connected owner's Cloudflare account and keeps the existing RouteForge Site and DB authoritative. The managed Site connection does not expose direct service bindings to that account, so the component calls the verified HTTPS origin with a separate timestamped HMAC secret; it rejects redirects and arbitrary targets. It cannot create a delivery, choose a rider/tenant, change prices or send money.

The protected `/api/internal/network-tick` service accepts only `tick` or `status`, verifies exact-body signatures and a five-minute timestamp window, rate limits authorized service calls, and records a persisted successful heartbeat. Merchant API keys and office cookies do not grant this capability. Administration shows the last successful check; a gap over three minutes means the service needs investigation. Worker logs contain outcome/time/count, not secrets or customer data. Cron is one minute in UTC, while active rider requests handle short offer deadlines more promptly. Native background push/OTP still needs a signed release and field verification.

## Commercial and payment architecture

Delivery fees and commission rates are snapshotted at intake. OTP-completed shared deliveries accrue fee less snapshotted commission as provisional rider earnings. Owned deliveries use an agreed per-km rate and measured GPS mileage when configured, otherwise earnings remain unconfigured. Amounts use integer KES minor units. A unique order ledger prevents duplicate accrual; review changes only `pending_review` to `reviewed` and never transfers funds.

Administrators assign standard/business/enterprise plan labels. No subscription charging, recurring invoices, M-Pesa transaction, rider payout or settlement transfer is enabled. The original cash/till reporting and office verification flow remains available for legacy deliveries.

A future M-Pesa adapter must introduce separate payment/settlement intents with unique business idempotency keys, server-only credentials, provider callback validation, reconciliation and balanced ledger entries. Provider timeout is an unknown outcome requiring reconciliation, never an immediate duplicate payment. Amount/currency/recipient approval and a tested sandbox flow are prerequisites for enabling live transfers. Existing delivery status and provisional earnings are not payment authorization.

## Database and release controls

New migrations `0006`–`0009` add merchant, branch/staff, integration, enrollment, delivery sidecar, offer/event/outbox, audit, earnings and per-area pricing-consent records. They do not rewrite existing office/planner/tracking/payment data. Applied migration history stays immutable. Preserve the existing DB binding and `ROUTEFORGE_AUTH_BOOTSTRAP` secret.

Server-only runtime settings:

- `ROUTEFORGE_PLATFORM_OWNER`: verified existing office owner ID; never select an unrelated deployment/account.
- `ROUTEFORGE_INTEGRATION_KEY`: random 32-byte hex AES-256-GCM master key, configured as a hosted secret. Do not rotate it without migrating encrypted signing secrets.
- `ROUTEFORGE_JOB_KEY`: separate random 32-byte hex HMAC secret, stored as a hosted secret in RouteForge and the retry worker. Rotate both together; disabling its Cron leaves durable work available to active clients.
- `ROUTEFORGE_NETWORK_ENABLED`: `true` enables onboarding, intake and new dispatch; pending approval, enrollment, area configuration and per-area rate consent remain independent gates. `false` pauses new network activity while keeping tenant/role protections and already assigned completion paths.

Publish from the exact pushed source commit after typecheck, lint, unit/migration tests, production build and actual built-Worker/D1 integration checks. The deployer applies additive migrations before uploading code; an unsuccessful code deployment can still leave the new schema applied. Inspect the actual deployment and migration state before retrying.

Recovery prefers a forward fix or redeploy of the current secure version with the network flag disabled. Retain all data. Do not drop new tables or roll back to the pre-network Worker after staff accounts exist: the old Worker lacks the new staff permission checks. A reversible feature pause is safer than destructive schema rollback. D1 point-in-time backup/restore is an operator hosting capability, not a feature exposed by the current Sites tool connection; no production restore or fabricated backup is claimed.

## Verification and remaining work

`pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, then `pnpm run test:integration` cover the existing workflows plus tenant isolation, approval/roles/session revocation, concurrent intake, all fleet modes, exclusive claims, changed consent/branch eligibility, decline/expiry fallback, capacity, OTP, replay receipts, tracking privacy, shared unlink, accrued earnings, HMAC intake/outgoing callbacks, retries/recovery, service authentication and scheduled handler, suspension and credential revocation. Migration tests populate representative old rows before applying new schema and check preservation and foreign keys. Outgoing callback/provider fixtures are synthetic in the disposable database.

Release testing does not claim browser gestures, actual Android notifications/GPS, customer SMS, real merchant integrations or live payments. Authenticated production smoke tests require a valid existing office/rider login; the runtime bootstrap secret is redacted by the hosting API and must not be replaced to obtain access. Public production routes and unauthorized API boundaries can be checked without creating fake production merchants or orders.
