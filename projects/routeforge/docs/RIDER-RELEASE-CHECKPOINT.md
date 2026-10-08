# RouteForge Rider 1.2 release record

Status on 2026-10-08: **completed and published**, Sites version 8.

- Dashboard: https://routeforge-shadownet.sammymuya167.chatgpt.site
- Rider APK: https://routeforge-shadownet.sammymuya167.chatgpt.site/downloads/routeforge-rider.apk?v=4
- Sites source commit: `5b8d092a3c8515d8ff3286d306f298b9fed1d848`
- Saved version: `appgprj_6ac6a091041481919cdfd5d22ab08ff2~appgver_85645da4c7388191b8b7b850537d0443`
- Deployment: `appgdep_6ac7fcc57434819189b05b640b8ed7dc`, terminal status `succeeded`, runtime environment revision 1.

## Delivered behaviour

Office and rider login screens use role-scoped server authentication. Existing rider accounts point to the same driver records, preserving history, assignment and payment data. Initial credentials are configured privately as salted bcrypt cost 12 hashes. The office uses a Secure, HttpOnly, SameSite=Strict session cookie; the Android app keeps its token encrypted in Android Keystore. Public source contains no production passwords, password hashes, owner identifiers or phone records.

**Drivers & fleet → Driver logins** creates a driver account with a required phone number, optional custom username and generated password shown once. The office can generate a replacement password. Reset ends previous phone sessions and duty while preserving unfinished work. Office unlink disables access; the office can restore it with a replacement password. Native sign-out syncs reports, ends duty and revokes the session. Saved reports cannot move to another rider account.

New offers remain open for **30 seconds**. The first valid claim wins; after expiry the server chooses a currently free, on-duty eligible rider randomly, or returns the order to the queue. Busy riders cannot claim or receive another assignment. The office and app display the deadline-driven progress line. Existing notification, navigation, delivery completion, cash/till reporting, sales totals, planning, mapping, CSV and history features remain available after login.

## Verification

- 56 Node tests, 74 actual Worker/D1 checks, TypeScript, ESLint and the final packaged Worker build passed.
- [Actions run 37838156201](https://github.com/sammymuya167-hash/sammymuya167-hash/actions/runs/37838156201) passed Android debug/release compilation, lint and all 12 API 35 emulator checks, including the rendered offline login, native bridge, encrypted session and queue ownership.
- Native source commit: `78bbaf698fb83673426383db5ba4e1bcfbb10386`; build checkout: `90559115b7f486580fa9e1418672c6339068c599`.
- Artifact ID: `11575464938`; ZIP SHA-256: `bc598865f652d76ea829e32df147b6715f5d9508fb25bf6af1871970bb172cae`.
- All 15 main-source/build checksums match the released source.
- Rider package/version: `app.shadownet.routeforge.rider / 4 / 1.2-rider`; minimum/target API: `26 / 35`.
- Signed APK: 53,815 bytes; SHA-256 `6da02d5a7929174b43eb026580d190cf657466d039e8d13ee622953f2165e10b`.
- Owner certificate SHA-256: `e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c`; APK signature schemes v2/v3 verify.
- Original pilot SHA-256 remains `8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29`.
- Production account records were inspected through the hosting connection and all three requested passwords were verified against their stored hashes. The public login page was retrieved successfully.
- Browser gesture QA and a real-phone speaker/background check are not claimed; Android emulator and actual Worker checks provide the recorded test evidence.

## Install

Install Rider 1.2 over an existing Rider installation without uninstalling or clearing storage. Sign in with the office-issued rider username and password, then choose **Start duty**. In Account, play the delivery alert test and check both notification channels. For a pilot-only phone, sync and stop the pilot, install Rider alongside it and sign in to the account attached to the existing driver record.

## Backup

The working Rider 1.1 release, including project source and its signed APK, is retained at `backup/routeforge-rider-1.1-2026-10-08` under `projects/routeforge`. It points to repository commit `09aaa7372d51e6cf380a6cd2bbd20910b9c67edd`. Operational records remain in the private hosted database.

See [ACCOUNT_LOGINS.md](ACCOUNT_LOGINS.md), [RIDER_UPDATE.md](RIDER_UPDATE.md) and [TRACKING.md](TRACKING.md).
