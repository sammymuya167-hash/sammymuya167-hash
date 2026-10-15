# ShadowSocial by SHADOWNET

An original, AI-assisted photo-sharing community with an owner-controlled moderation office and a signed, browser-backed Android client. Catalogue project #7 (Instagram-style photo sharing); no upstream clone code is used. The Android launcher is adapted from SHADOWNET's existing ShadowChat client with its own package and signing identity.

- Community: https://shadowsocial-shadownet.sammymuya167.chatgpt.site
- Office: https://shadowsocial-shadownet.sammymuya167.chatgpt.site/office
- Android package: `ke.co.shadownet.shadowsocial`

## Owner and registration

The production owner email is configured privately as `SHADOWSOCIAL_OWNER_EMAIL`. No secret is included in source or the browser bundle. Sign in with that account, create your owner profile and open `/office`. The server assigns ownership only when the trusted hosted sign-in email matches that configuration. The first public visitor cannot claim the system.

Registration is open by default. People sign in with ChatGPT and then choose a ShadowSocial name and username, accept the community rules and confirm they are at least 16. No invitation or manual approval is required. Hosted identity is not an independent email/password login. Emails remain in the account/staff surfaces; public profiles omit them.

## Community features

- Photo and text posts; captions; discover and following feeds with keyset pagination.
- JPEG, PNG and WebP uploads, checked server-side against file signatures and a 6 MiB limit. SVG and arbitrary files are rejected. R2 objects have no public bucket URL.
- Profiles, bios and avatars; private accounts and accepted-follow visibility.
- Follow requests, follows/unfollows, likes, comments, saved posts and profile sharing.
- Account blocking that removes mutual follow relationships and excludes the blocked party from signed-in discovery, comments, posts and media.
- Reports on posts, comments and accounts; in-app activity notifications and account appeals.
- Account data export and deletion. Uploaded files are deleted; content is deactivated and personal profile fields are anonymized. Minimal moderation and audit records remain. Restrictions do not prevent export/deletion.

## Owner office

Overview uses real database counts. Staff can search members; inspect reported content and its author; review live, pending or removed posts; review reports and appeals; and inspect recent audit events. Every moderation decision requires a reason. Moderation actions and their audit entry are committed in one D1 batch.

| Role | Permissions |
|---|---|
| Owner | All moderation, staff role assignment, registration/publishing controls, rule and announcement changes |
| Admin | Member warnings, suspensions, bans/reinstatement, content/report/appeal review |
| Moderator | Member warnings and suspensions; content/report/appeal review |
| Member | Own profile/content and ordinary community interactions |

Owner and self-targeted staff restrictions are protected. Only the owner can manage existing staff. The owner can pause registration, pause member publishing/uploads/comments, require manual review of new member posts, configure the daily post limit and blocked text phrases, publish an announcement, and edit community rules. Manual image review is available; no automatic image classifier is claimed.

## Shared service and privacy

The React/Vinext web app and Android client use the same HTTPS origin, D1 records and R2 media. All authorization happens in the API; the Android APK has no separate feed database or sync bridge. Account bans are checked on every authenticated API request, and restricted authors are excluded from public feeds and media delivery. Staff have explicit access to private content for moderation. Public pages may be viewed while signed out; account blocks cannot prevent anonymous access to public content.

Source: `lib/social-api.ts`; schema: `db/schema.ts`; generated migrations: `drizzle/`; office: `app/office/`; consumer: `app/ui.tsx`. The API rejects cross-origin writes, bounds request bodies, parameterizes values, and uses server-enforced quotas. Uploaded media responses are not publicly cached, so removals and privacy changes are checked on subsequent requests. Security headers restrict scripts/resources and disable native browser camera/microphone/geolocation APIs; the file chooser remains available.

## Development and checks

The Sites starter's locked installation and build helpers are retained. Node 22.13+ is required.

```sh
npm run install:ci
npm run db:generate
npm run typecheck
npm test
npm run build
npm run test:worker
```

Tests use real local Miniflare D1/R2 bindings rather than a mock SQLite implementation. Production-Worker checks exercise rendered pages, routing, hosted identity headers, member/owner registration, phone/web shared writes and immediate ban enforcement. Test identity headers are supplied only by the local harness; production headers are injected by hosting dispatch. There is no production development-auth bypass.

## Android

The client is browser-backed using Custom Tabs and requires a modern Android browser and internet connection. Browser identity is retained in the selected browser profile. The signed APK opens the canonical production origin; incoming arbitrary URLs or tokens are not accepted. The app requests no native storage, contact, location, camera or microphone permissions. The web file input permits photo selection in the browser.

The CI recipe in `ci/shadowsocial-android.yml` is installed at repository `.github/workflows/shadowsocial-android.yml`. It uses Java 17, Gradle 8.11.1, Android SDK 35 and AGP 8.9.2, runs debug/release compilation, release lint, unit tests and API 35 emulator instrumentation tests, then produces an unsigned aligned release and source manifests. Release signing is performed outside the public repository. The private signing backup must never be committed or included in site archives.

## Release limits and field checks

This initial release does not include video reels, stories, direct messages, live calls, push notifications while closed, an offline feed, automated age verification or a separately implemented native social UI. In-app activity is fetched when opened. A production Android device still needs to confirm hosted sign-in, browser photo selection, actual two-account following and restricted-account behavior. Browser visual QA was unavailable in this managed environment; responsive styles, semantic form labels and reduced-motion support are included, but real browser/device inspection remains necessary. Do not describe emulator launch tests as verification of production sign-in or photo uploads.

The platform is an original SHADOWNET product and is not affiliated with Instagram or Meta. Before broader promotion, confirm operational moderation coverage, support contacts, recovery practices and production device testing.
