# RouteForge Rider 1.4 and recipient contact release

This extends the original RouteForge Site and D1 database. No database replacement, new application ID, account reset or pricing change is involved. The existing database schema is unchanged: recipient details use the existing office-order JSON. Previously saved requests remain valid without those optional fields.

## Changes

- Office New delivery now captures the parcel recipient's name and phone. Open office requests can add, edit or remove the contact with optimistic version checks and a tenant-scoped audit record. This is distinct from the merchant/company registration phone.
- Ordinary office and merchant assignments provide their current rider a scoped dialer control. Offers, completed/cancelled contacts and rider history redact recipient details. Phone numbers normalize through the existing validation rules.
- The Rider Map uses BRouter 1.7.10 on the phone, with actual road geometry, road distance and an estimated driving/cycling time. Road data is downloaded by region after rider approval and cached; private route geometry is encrypted and removed at sign-out. Road work is independent of offer polling and completion retries, and can be paused.
- Rider Account opens the current portal update page. The login page and tracking/rider portals link to the new original-certificate installer. Older 1.2/1.3 installers and the pilot are retained.

## Verification

TypeScript and lint pass. 81 unit checks pass, including the actual packaged rider JavaScript, malformed/stale geometry, leg changes, contacts and download/update controls. 91 production Worker/D1 integration checks pass, including simultaneous recipient edits, normalization, tenant isolation, contact redaction, audit records, idempotent creation, nullable removal and all existing delivery, merchant, fleet, webhook, account and financial-review workflows.

The original GitHub CI compiled/linted debug and release Android builds and ran 20 tests on an Android 15/API 35 emulator. They include the actual packaged WebView, real Nairobi driving/cycling routes, repeat routing without network access, encrypted account-scoped route storage, contact controls and logout. The real 34 MB road graph is downloaded only into instrumentation assets; it is not bundled in the public APK. All 125 native source checksums match the compiled artifact, including the pinned vendor sources and profiles. All 101 upstream Java files match their recorded SHA256 values and retain the MIT licence.

| Release evidence | Value |
| --- | --- |
| Application ID | `app.shadownet.routeforge.rider` |
| Version | `1.4-rider`, code `6` |
| Minimum Android | API 26 / Android 8 |
| Signed APK bytes | `218145` |
| Signed APK SHA256 | `ce04f204b72e5a499bde14ce2bc26f2951f6d2892ac42fa1ede0270daacc4fbf` |
| Original certificate SHA256 | `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c` |
| Native source commit | `f73fb06e1cf6fddb34183c2753824c03d1630d47` |
| CI merge checkout | `9419cd512da9ed2399f6cd1ce44bd85831e6a229` |
| CI workflow run | [37963347826](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37963347826) |
| Unsigned artifact | `11632887517` |
| Artifact SHA256 | `65c12a0388bf553e03f9f726621c791ac4b3f1eae816da3bd2228f695148e8a2` |
| Test road data SHA256 | `4cad8afcb16a50781196f23255cbe0f96234fe360e5a189ea59161c4211c83c0` |
| BRouter upstream commit | `4d2639af77ea5ed9c30d3e400764eb6f9e8522da` |

The signed APK verifies with v2, v3 and the separate v4 signature, using the original rider certificate. Install it over 1.2 or 1.3 without uninstalling/clearing storage. Android installation approval is required for this native update. Server delivery/status/dashboard updates and subsequent regional road refreshes do not require reinstalling the app.

## Operational limits

Travel time excludes live traffic. Driving profiles do not model motorcycle-specific exceptions. An entrance needs a nearby mapped road. Regional files are limited to 128 MiB each, routes to six regions and 20 seconds of calculation; unsupported or inaccessible routes show a real error and retain external navigation, never a straight-line distance masquerading as a road route. First Nairobi download is about 34 MB; public regional data updates after 30 days when requested, retaining older cached data if refresh fails offline. Map tiles still need internet.

No paid routing infrastructure was provisioned. Railway's free-plan provision limit and the Cloudflare Containers paid-plan requirement prevented server hosting; the tested local routing engine avoids those blockers. Live M-Pesa transactions, charges and payouts remain disabled. Physical rider-phone GPS, background operation, actual calling and navigation during a real delivery still need a field check. Automated desktop browser gesture QA was unavailable in this environment; no such result is claimed.

Publication uses the original Site repository and build pipeline, preserving the current public audience and rollback versions. Exact current metadata is served at `/downloads/routeforge-rider-release.json`. Production verification compares the live installer bytes/certificate and portal links, checks the existing pages and verifies anonymous requests cannot access private endpoints.
