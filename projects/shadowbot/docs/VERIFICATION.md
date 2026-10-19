# ShadowBot v1 verification

Release date: 19 October 2026 (Africa/Nairobi). Verification is explicit about the boundary between automated checks and manual field testing.

## Automated release gates

| Check                     | Outcome                     | What it establishes                                                                                                                                                                                                                                                              |
| ------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript `tsc --noEmit` | Passed                      | Application and framework integration type-check                                                                                                                                                                                                                                 |
| Unit suite                | 8 passed                    | Chunk overlap and bounds, ranking/no-match, untrusted-context prompt boundaries, Unicode/SSE framing, frame limits, memory, salted password verification, bounded request parsing                                                                                                |
| Built Worker + D1 suite   | 17 scenarios passed         | Production build and actual local D1 work together across registration, sessions, ownership, uploads, deduplication, prompt/RAG composition, streaming/persistence, memory, private histories, access revocation, provider failures/truncation, leases, quotas, deletion, logout |
| Gateway suite             | 1 passed                    | Real gateway code runs in Workerd; authorization, input limits, fixed model/token ceiling and streaming operate with a mocked AI binding                                                                                                                                         |
| Production build          | Passed                      | Vinext RSC/client/SSR bundle and Worker assets are produced                                                                                                                                                                                                                      |
| Local migration runner    | Passed; repeated run passed | Schema applies to local D1 and is idempotent through its ledger                                                                                                                                                                                                                  |
| Real Workers AI request   | Passed                      | Connected Cloudflare account and chosen model can return actual generated text                                                                                                                                                                                                   |

The test runner reports the parent integration test as an additional test entry. There are 26 focused tests/scenarios (8 + 17 + 1), or 27 entries including that parent. The integration suite mocks only outbound AI HTTP responses; the gateway suite mocks only the native AI binding. Mocked generated text is not represented as a live LLM answer.

## Production verification

The publishing result is recorded separately from browser QA. `GET /api/health` checks D1 and presence of provider configuration. It does not call the model. The deployed app passed a live API smoke check: public shell and D1 health, email/password registration and secure session, temporary assistant creation, Markdown upload/indexing, real streaming generation of the unique uploaded fact (ORBIT-86), saved-history readback, anonymous and second-account history denial, and omission of the private system prompt from the public bot API. The check also exercises unpublishing and cleanup. Live requests used the deployed Worker, its real D1 database, and the configured model gateway; they did not mock the provider.

See the release handoff for the actual live smoke-check outcome. No passing browser, mobile device, email delivery, failover, load, backup restoration, or independent security audit result is claimed.

## Manual browser acceptance checklist

1. Open the public workspace and Shadow Guide page without an app session. Both load; submitting a message requests sign-in.
2. Register, sign out, then sign in again. The password must be at least 12 characters at registration.
3. Create two different assistants. Confirm that a private assistant URL cannot be opened by another account.
4. Upload `refunds.md` containing a unique, non-sensitive fact. Ask about it. Inspect the excerpts and compare the answer with the actual source.
5. Send a follow-up question, reload/open the saved conversation, and check both turns are present.
6. Publicly share one assistant; use another browser/account to chat. Confirm neither account can open the other's history, including the assistant owner.
7. Stop an in-progress answer and check its partial status. Simulate an unavailable provider and confirm the failure is visible rather than shown as a complete answer.
8. Delete a document, conversation, and assistant. Refresh and confirm those records remain removed. Saved source excerpts are removed with their conversations, not when the original file is deleted.
9. At phone width, check navigation, keyboard interaction, forms, the source disclosures, and the chat composer. Test keyboard focus, Escape, Tab/Shift-Tab and reduced motion.

## Repeatable commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:worker
pnpm test:gateway
```

Browser automation was unavailable in the authoring environment, so no screenshots or visual pass are claimed. The CSS includes responsive layouts and reduced-motion support, but that is an implementation statement, not a device-test result.
