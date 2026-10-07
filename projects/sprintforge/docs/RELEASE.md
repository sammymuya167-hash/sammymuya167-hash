# Release 1.0.0

PDF project 33 · Jira Clone. Public release on 2026-10-08 (Africa/Nairobi).

| Check                                | Result                                 |
| ------------------------------------ | -------------------------------------- |
| Domain rules                         | 13 tests passed                        |
| Built Worker + disposable D1         | 15 integration checks passed           |
| TypeScript, ESLint, production build | Passed                                 |
| Browser automation                   | Unavailable; no interaction-test claim |

Integration covers public rendering, private storage, account isolation, Origin rejection, input validation, dependencies, comments, sprint completion, stale revisions and concurrent first saves.

The deployed archive is built from the exact pushed source commit. Public preview data is synthetic; saved boards are private per account. Source is also published in `projects/sprintforge` with a path-scoped GitHub Actions workflow.

## Deployment provenance

- Pushed Sites source: `3e60a9f005723a8fbb4448209ac9568c4478195a`.
- Saved version: `appgprj_6ac6ac71caa08191827e79dbd6b671c8~appgver_78efb6007a988191be6e9d088c58279d`.
- Successful deployment: `appgdep_6ac6b583bc40819188a895cbaf5a6854`.
- Live URL: [https://sprintforge-shadownet.sammymuya167.chatgpt.site](https://sprintforge-shadownet.sammymuya167.chatgpt.site).

This GitHub copy adds release provenance to the application source. Test fixture credentials are synthetic; runtime credentials and generated build output are excluded.
