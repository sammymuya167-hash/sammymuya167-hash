# ShadowChat 0.2 security model

This is an early, unaudited private messenger for a small approved circle. It must not be represented as Signal, WhatsApp, or equivalent in security assurance.

## Identities and gates

Hosted sign-in establishes a stable, Site-scoped account ID. Private hosting access is preserved. Application APIs additionally require an active membership and authorize the conversation pair for every operation. The first owner is initialized only while the Site is owner-private, using an atomic singleton reservation. Initialize the owner before granting any hosting access. Public or shared uninitialized deployment is unsupported.

Only the owner can create or revoke invitations and remove members. Invitations contain 256 random bits, expire in 48 hours, bind to the authenticated email, and are consumed atomically with account creation. Only a SHA-256 token digest is stored server-side. Invitation URLs put the token in the fragment to keep it out of HTTP paths and referrers; the client clears the fragment after reading it. Invitation emails are visible only to the owner. Removing a member stops new access but cannot erase received copies, screenshots, exported keys or backups.

## Content encryption

Browser-generated long-term X25519 keys are used with the unchanged TweetNaCl.js `box` construction: X25519, XSalsa20 and Poly1305. Each message has a random 24-byte nonce. The encrypted envelope includes its message ID, conversation ID, sender ID and recipient ID. The client verifies this context after authentication, rejecting copied ciphertext in another conversation or under another identity. The server assigns sender identity and a sequence cursor, stores ciphertext, and does not accept private message keys or plaintext message bodies.

The browser pins the peer public key on first conversation use. Comparing a SHA-256 safety number over both sorted public keys through a trusted channel is necessary to independently establish identity. First-use trust alone cannot prevent an actively malicious key directory. Public keys cannot be replaced through this release's account API; a device must restore its existing encrypted identity. Low-order public keys are rejected.

**There is no forward secrecy or post-compromise recovery.** Compromise of an identity key can reveal recorded conversations involving that key. This is a direct, long-term-key NaCl construction, not the Signal Protocol or a double ratchet. No custom cipher or ratchet is claimed. Conversation metadata, ordering, availability and message timing are not hidden from or guaranteed against the service.

## Device storage and recovery

Only a passphrase-encrypted private key is persisted in IndexedDB. Encrypted key records are scoped to both account and public key so concurrent initial setup in different tabs cannot overwrite the identity that wins registration. The wrapper uses PBKDF2-HMAC-SHA-256 with 600,000 iterations, a random 16-byte salt, and AES-256-GCM with a random 12-byte IV. Account ID and public key are authenticated as additional data. The minimum passphrase length is 12 characters; a longer, unpredictable passphrase is strongly preferable. Offline password guessing remains possible if a weak-passphrase backup is stolen.

An exported recovery file is the same encrypted key bundle. It can be used only with the matching signed-in account and passphrase. Losing all copies of the private key loses access to encrypted history. Unlocking keeps the private key in browser memory. Manual/idle lock clears rendered messages, drafts and the held key; JavaScript memory erasure and garbage collection are best-effort. Local ciphertext remains for an encrypted pending-message queue. The service worker does not cache chat pages, account responses or message content.

A restored browser uses the same identity key. This version cannot independently revoke one lost device while keeping another device with that same key active. The owner can revoke the entire member account. Hosted sign-in sessions should also be revoked through their account controls after a device is lost. The initial owner cannot remove themselves through the app.

## Other boundaries

HTTPS, strict same-origin JSON writes, bounded request bodies, parameterized SQL, ownership checks, basic per-user write limits and no-store responses provide application controls. Rate limiting is a basic abuse guard, not DDoS protection. Browser alerts contain no plaintext and work only while the web app remains open. Background delivery is not promised. The UI displays delivery/read state only after the recipient fetches and authenticates a selected conversation.

A compromised browser, malicious extension, stolen unlocked device, XSS, malicious app update or altered served JavaScript can expose plaintext or keys. The service controls delivered JavaScript, so content encryption alone is not a guarantee against an actively malicious application operator. The CSP permits framework inline scripts; it is not an XSS-proof boundary. No third-party analytics or external fonts are included. A dedicated security review, stronger device management and a mature forward-secret messaging protocol are prerequisites for higher-assurance use.

## Android browser-backed client

The Android APK opens the same production HTTPS origin in a regular browser-backed Custom Tab. It has no native message database, WebView, JavaScript bridge, credential relay or native network/storage permission. The browser owns sign-in, encrypted origin storage and message operations. A different browser profile or another device requires signing in to the same account and restoring its existing encrypted key. This does not silently transfer keys or add background delivery. Browser controls may remain visible.
