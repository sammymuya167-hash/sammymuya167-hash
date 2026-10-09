# Office and rider accounts

Use the office username and password at the dashboard. Rider accounts sign in through Rider 1.4. Initial credentials are configured privately and do not appear in this repository.

## Create a driver login

1. Open **Drivers & fleet → Driver logins → Add driver login**.
2. Choose a new driver or an existing record that has no login. Existing records keep their uploaded history and assignments.
3. Enter the driver name and a required phone number. Kenyan local numbers are normalized to international format. Vehicle details are optional.
4. Enter a custom username, or leave it blank to generate one. Usernames are case-insensitive and unique; passwords are case-sensitive.
5. Save or copy the generated password when it is shown. Share it privately with that rider. The password cannot be retrieved later; **Reset password** generates a replacement.
6. The rider installs Rider 1.4 and signs in. Start duty with GPS enabled and check delivery alert settings before offering work.

Normal rider sign-out uploads saved reports, ends duty and revokes the phone token. It retains delivery and payment history. Finish delivery before ending duty or signing out. Privacy pause remains available during unfinished work. A password reset ends previous sessions and duty, while leaving any unfinished assignment visible for office follow-up.

New delivery offers remain open for 30 seconds. The first valid claim wins. Busy riders cannot claim or be selected for another order. If no eligible rider claims before the deadline, a free on-duty rider with fresh GPS is selected randomly; with none available, the request returns to the queue.

## Security and deployment

Passwords use salted bcrypt cost 12 hashes. Office sessions use random credentials stored by hash in D1, with a Secure, HttpOnly, SameSite=Strict cookie and a twelve-hour expiry. Native rider tokens are stored encrypted with Android Keystore; the WebView receives no token or password. Rate limits apply independently to username and trusted-edge IP. The public APK and login page stay downloadable; company records require the appropriate session.

`ROUTEFORGE_AUTH_BOOTSTRAP` is a secret runtime JSON configuration with `ownerId` and an `accounts` array. Each entry has `id`, `username`, `passwordHash`, `role`, and for riders the existing `deviceId` and `phone`. Generate hashes privately. Initial records are inserted as one transaction and never overwrite a later password reset or deleted rider. Never put production credentials, password hashes, account identifiers or phone data into source, build variables, release artifacts or this repository.

The previous working release is retained on the GitHub branch `backup/routeforge-rider-1.1-2026-10-08`, including `projects/routeforge` and its signed APK. That backup contains application code and the release installer. Operational records remain in the private hosted database.
