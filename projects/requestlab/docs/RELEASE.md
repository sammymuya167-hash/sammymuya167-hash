# Release 1.0.0

PDF project 98 · API Testing Tool. Public release on 2026-10-08 (Africa/Nairobi).

| Check                                     | Result                                 |
| ----------------------------------------- | -------------------------------------- |
| Request/domain behavior                   | 14 tests passed                        |
| Built Worker + disposable D1              | 18 integration checks passed           |
| Seven starter requests and all assertions | Passed against built sandbox           |
| TypeScript, ESLint, production build      | Passed                                 |
| Browser automation                        | Unavailable; no interaction-test claim |

Checks cover variables/cycles, safe paths, structured assertions, request boundaries, redaction, response limits, private storage, isolation, revision conflicts, concurrent creation, invalid orders and HEAD.

The deployed archive is built from the exact pushed source. Source is also in `projects/requestlab` with path-scoped GitHub Actions. Public data is synthetic; saved collections/history are account-private.

## Deployment provenance

- Pushed Sites source: `8c1c14ada620f46a164186c4d0aa03fe50925600`.
- Saved version: `appgprj_6ac6ac8ee8a481919f75ed2d1f4989f8~appgver_b168733cc6108191af10539dbdd63e3c`.
- Successful deployment: `appgdep_6ac6b5a935008191bbd61c6ca5d9ecc5`.
- Live URL: [https://requestlab-shadownet.sammymuya167.chatgpt.site](https://requestlab-shadownet.sammymuya167.chatgpt.site).

This GitHub copy adds release provenance to the application source. Test fixture credentials are synthetic; runtime credentials and generated build output are excluded.
