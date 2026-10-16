# Running your ShadowSocial office

1. For Android owner access, open `/account-access` in the verified owner session, create the owner profile if prompted, choose your app password and save the recovery code. Sign into the APK with your owner email and that password. Open `/office` and sign in with the configured owner account. Create a profile once. The server recognizes the owner; you do not need an invitation.
2. Open **Rules & settings**. Choose whether new posts publish immediately or wait for review. You can pause registration or member publishing at any time. Staff can continue their moderation work while publishing is paused.
3. Members create accounts on the public app. After someone joins, find them under **People & permissions** to assign moderator or admin access. Only you can grant or remove staff roles.
4. Review **Reports**. Inspect the reported post/comment/user and author before deciding. Remove content or restrict the author when appropriate, then resolve or dismiss the report. Resolution itself does not automatically remove content or ban an author.
5. Use warnings for minor concerns, timed suspensions for temporary restrictions and bans for serious/repeated abuse. The current office offers a seven-day suspension; the API supports 1–30 days. Every decision requires a clear reason.
6. Review **Appeals**. Record the decision, and separately restore access from **People & permissions** if accepted. Preserve a useful explanation for the member.
7. Use **Content studio** to approve pending posts, remove live content or restore a staff-removed post. Author-deleted posts cannot be restored.
8. Check **Audit trail** to see the latest actions and reasons. Audit records are not editable through the app.

Community rules are displayed at signup and inside the app. Age is self-confirmed at 16+. Photo safety review is manual. This office is an initial operating system; staff still need to review reports and respond to appeals.


## Calls and live broadcasts (0.3.0)

Open Calls & live in either office. Staff can stop a session with an audited reason; only the owner can pause voice/video calls or live broadcasts across the platform. Pausing ends active sessions. Calls require mutual accepted follows. Private broadcasts require accepted followers, blocks and restrictions revoke access. Lives support 30 viewers and a maximum hour. No recording is saved. Native incoming invitations work while the app is open; background incoming push is not configured. Sessions end when the app is backgrounded. Media service secrets stay in backend runtime configuration.
