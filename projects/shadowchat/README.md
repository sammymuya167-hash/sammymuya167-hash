# ShadowChat by SHADOWNET

An invite-only messenger for a small, approved circle. The web app and signed Android APK support the same one-to-one text conversations. The APK uses an Android Custom Tab for the live app, including its shared account and encrypted message service. It is an original implementation of catalogue idea **#12, WhatsApp Clone** and operates on its own network.

## What works

- Hosted ChatGPT sign-in, private Site access, and a separate owner-managed membership gate.
- Email-bound, single-use invitations with 48-hour expiry and revocation.
- Usernames, approved-member directory, one-to-one conversations, cursor-based history, unread counts, and delivery/read markers.
- NaCl public-key authenticated encryption in the browser; only ciphertext, nonces, routing metadata and public keys go to the application server.
- Passphrase-protected device keys, encrypted recovery-key export/restore, manual lock, and ten-minute inactivity lock.
- An encrypted browser outbox which retries while the app is open and reconnects. Queued text is encrypted before persistent storage.
- Optional browser alerts while the app remains open, with no message content in the notification.
- Responsive desktop/mobile layouts, a signed browser-backed Android APK, and an in-app Android release notice.

## Start using it

1. Open the private deployment and sign in as its owner. Create a name, username, and a long passphrase. Initialize this first owner before sharing the Site.
2. Download the encrypted recovery key. Keep the backup and its passphrase safe; the service cannot restore a lost private key.
3. In **Your people → Invite someone**, create an invitation bound to the friend's ChatGPT sign-in email.
4. Grant that same person viewer access using the hosting platform's private Share controls, then send the generated invitation link. These are two gates: platform access and ShadowChat membership. Private owner-only publication does not itself grant invited people platform access.
5. The invited person signs in, accepts the invitation, creates a device key/passphrase, and downloads their recovery key.
6. Open a conversation and compare safety numbers through a separate trusted channel. Mark comparison only after both numbers match.

No invitation emails are sent by the application. No other person's platform access is added automatically. The first published release remains owner-private until the owner explicitly shares it.

## Development

Node 22.13+ and pnpm 11.25 are used. Install with `pnpm install --frozen-lockfile`, run `pnpm test`, `pnpm typecheck`, and `pnpm build`. The supplied Sites helpers handle the production Worker package, source synchronization, deployment and D1 migration. The tracked `.openai/hosting.json` is the canonical Site identity. D1 is bound as `DB`; R2 is unused.

Migrations are in `drizzle/`. Do not modify an applied migration. Add a new migration using `pnpm db:generate` for later schema changes.

## Verification

The initial release passes 18 focused cryptographic and D1-backed API tests. They cover intended-recipient delivery, tamper/context substitution, wrong-key rejection, recovery passphrases, pinned implementation bytes, one-owner initialization, invitation expiry/revocation/replay, membership authorization, idempotent delivery, receipt handling, key replacement rejection, and multi-page history. Five additional production-Worker flow checks verify hosted identity handling, account/invitation routes, an encrypted message through the built Worker and D1, cross-device restored-key history, and install assets. TypeScript and production Worker builds also pass.

The managed environment has no supported interactive browser control. Real-browser IndexedDB persistence, Android installation, idle lock timing, notifications and two-person device operation require a device acceptance test. The tests use independent synthetic identities and a local D1 runtime; they do not claim a successful live conversation between real accounts.

## Scope and security

Read [the security model](docs/SECURITY.md) before relying on this early release. It is not independently audited and does not implement forward secrecy. It is not a replacement for an established, audited messenger for highly sensitive communication. Group messaging, attachments, voice notes, calls, background push, multiple independently revocable device keys are not included. The Android APK is a signed browser-backed client of this same live app; see [Android setup](docs/ANDROID.md).

## Attribution

The application is original, AI-assisted code authored for SHADOWNET. Encryption uses an unchanged, vendored TweetNaCl.js 1.0.3 implementation, with upstream types, license and provenance in `lib/vendor`. The library has a published independent audit; **that audit does not cover ShadowChat's application design or implementation**. Brand artwork and icons are original code-based assets; interface icons use Lucide.

## Android and web synchronization

Download the APK from ShadowChat Settings or `public/downloads/shadowchat-android-v0.2.0.apk`. The Android shell opens the same canonical HTTPS origin, uses the browser-backed account flow, and has no native messaging database, API relay or access to decrypted messages. It retains the selected browser package so future launches keep using that browser profile.

Use the same ChatGPT account on both screens. On a new browser/device, restore the encrypted recovery key using its original passphrase. This enables both endpoints to decrypt the same server-side conversation history; encrypted content synchronization by itself does not transfer the private key. Messages sent from either screen appear in that account's web history while online. The normal foreground polling interval is 2.5 seconds, plus network latency.

The APK opens an Android Custom Tab and may show browser controls. It is not a separately implemented native chat UI. Browser sign-in/profile changes may require sign-in or recovery-key restoration again. It does not add background push or independently revocable device keys.
