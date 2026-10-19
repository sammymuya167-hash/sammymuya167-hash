# ShadowBot · SHADOWNET

**Catalogue #86 — Chatbot Platform.** Create assistants with custom instructions and a text/Markdown knowledge base, then share a focused chat experience with streaming answers and private saved history.

**[Live demo](https://shadowbot-shadownet.sammymuya167.chatgpt.site)** · **[Try Shadow Guide](https://shadowbot-shadownet.sammymuya167.chatgpt.site/chat/shadow-guide)** · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md) · [Attribution](THIRD_PARTY_NOTICES.md)

## What ships

- Responsive React/TypeScript workspace and public assistant chat pages.
- Email/password registration, login, server-side sessions, and logout.
- Multiple owner-managed assistants: name, description, system instructions, greeting, color, private/public access and deletion.
- Bounded UTF-8 `.txt`, `.md`, and `.markdown` uploads; overlapping chunks, deduplication, per-assistant keyword retrieval, and inspectable source excerpts.
- Incremental SSE responses, stop control, recent conversation memory, saved personal history, and conversation deletion.
- Worker-side ownership checks, same-origin mutation protection, persistent D1 quotas, request limits, concurrency leases, output caps and timeouts.
- A configurable OpenAI-compatible provider. The demo runs actual Llama inference on Cloudflare Workers AI through a secret-protected gateway; it does not return scripted answers.

## Try it

1. Open the live demo and choose **Open chat** on Shadow Guide.
2. Create an account using your email and a password of at least 12 characters. Keep the password safe: v1 has no recovery flow.
3. Ask “How does the knowledge base work?” Open the knowledge sources beneath the response.
4. Choose **Create assistant**, enter its role and instructions, and save.
5. In **Knowledge**, upload a short text or Markdown FAQ. Preview the assistant and ask about a specific fact in that file.
6. Enable public access in **Configuration**, save, and copy its link from **Share**. A recipient signs in to chat; their history belongs only to them.

There is no default admin password, global first-user administrator, or shared demo account. Each account owns its own bots. The built-in product guide is immutable sample content defined in source. There is no billing in v1; demo quotas apply.

## Local setup

Requirements: Node **22.13+** (Node 24 recommended), Corepack/pnpm **11.25.0**, and an OpenAI-compatible streaming API key. No Cloudflare account is required for local D1 or mocked tests.

```bash
# From this repository's root:
cd projects/shadowbot
corepack enable
corepack pnpm install --frozen-lockfile
cp .env.example .dev.vars
```

Set your local provider variables in the ignored `.dev.vars` file. `AI_BASE_URL` includes the API prefix, without `/chat/completions`; examples include `https://openrouter.ai/api/v1`, `https://api.openai.com/v1`, and `https://api.x.ai/v1`. Set an actual model offered by that provider rather than copying a stale example model ID. The provider key stays on the Worker.

```dotenv
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=your-private-provider-key
AI_MODEL=your-provider-model-id
AI_LABEL=OpenRouter
```

```bash
corepack pnpm db:migrate:local
corepack pnpm dev
```

Open **http://localhost:5173**. Use localhost for secure-cookie development, or configure HTTPS for other hostnames. Do not expose the dev server publicly. Local data lives in `.wrangler/state/` and is separate from the hosted database. The local migration runner maintains a migration ledger and can safely be run again. It is a development utility, never part of request handling.

The source retains the tested Sites/Vinext foundation. The checkout-local `.sites-runtime/` directory is ignored; a clean clone uses its portable configuration. To run the built app locally, build first, then use `pnpm start` and open the local URL Wrangler prints. Both commands use `.wrangler/state`.

## Verification commands

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:worker
corepack pnpm test:gateway
# Or run the full sequence:
corepack pnpm verify
```

The unit suite tests chunking, ranking, untrusted context boundaries, split UTF-8/SSE frames, memory budgets, password hashing, and request parsing. Integration tests use the **actual production Worker build and a real local D1 database**, mocking only the external AI HTTP response. They exercise accounts, ownership, upload validation and deduplication, source-backed prompt construction, saved memory, SSE, private history, public access revocation, failed/truncated providers, duplicate sends, leases, quotas, deletion, and logout. Gateway tests execute the real bridge in Workerd with a mocked AI binding and verify authentication, message bounds and streaming.

See [the release verification record](docs/VERIFICATION.md) for results and what has not been verified. No browser end-to-end or load-test result is claimed.

## Hosting

### Existing demo / Sites

`.openai/hosting.json` identifies this existing project and its logical `DB` binding. Reuse its identity when updating it. The supported Sites workflow builds and synchronizes source, packages `dist`, applies generated D1 migrations and publishes the Worker. Configure `AI_BASE_URL`, `AI_API_KEY` (secret), `AI_MODEL`, and `AI_LABEL` through the hosting environment tools before deploying. Never place credentials in the manifest or client code.

The demo app is public at the hosting layer. Bot management and history remain protected by application authentication. Changing the site's audience is separate from publishing an individual bot.

### Your own Cloudflare account

1. `pnpm build`, then authenticate Wrangler to your own Cloudflare account.
2. Create a D1 database: `pnpm exec wrangler d1 create shadowbot`.
3. Run `node scripts/prepare-cloudflare.mjs --database-id YOUR_DATABASE_ID`. It updates only the generated deployment config, not the app's Sites identity.
4. Apply migrations: `pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.json`.
5. Store `AI_API_KEY` with `pnpm exec wrangler secret put AI_API_KEY --config dist/server/wrangler.json`. Set `AI_BASE_URL`, `AI_MODEL`, and `AI_LABEL` as Worker environment variables or secrets too.
6. Deploy: `pnpm exec wrangler deploy --config dist/server/wrangler.json`.
7. Rebuild/prepare before subsequent standalone deployments. Never use the Sites placeholder database ID in production.

The published source includes all retained build helpers and a lockfile. Self-hosting assumes a Workers subscription/runtime that supports the generated modules and static asset configuration. Check the health endpoint and run the manual verification steps after configuring the real provider.

### Optional Workers AI bridge

`gateway/worker.mjs` uses a native `AI` binding and a `GATEWAY_KEY` secret. `gateway/wrangler.jsonc` is the standalone config. Deploy it with Wrangler, keep its secret private, then configure the main app with its `/v1` URL and the same secret as `AI_API_KEY`. A gateway key is not a Cloudflare account token. Rotate the app and gateway together. The gateway fixes its model to `@cf/meta/llama-3.1-8b-instruct-fast` and caps output at 768 tokens; direct compatible providers use the app's `AI_MODEL` variable. Real provider calls may incur usage charges; the service-wide application quota is 200 attempts/day in this demo.

## Architecture at a glance

Browser → Workers session/authorization API → D1 records and keyword retrieval → configured AI endpoint → validated SSE → persisted assistant message. The model receives the custom system prompt, up to four relevant excerpts, and up to 20 recent complete messages within a 16,000-character history budget. Older messages remain stored but may be outside the model context. Failed partial assistant messages are excluded from future memory.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for schema, request lifecycle, authorization rules, concurrency, limits, and operational responsibilities. `GET /api/health` checks database availability and reports whether provider configuration is present; it does not perform a billable inference or claim the provider is currently available.

## Honest limitations

- This is a solid, bounded **v1 demo**, not an audited or load-tested enterprise service. Browser/mobile visual QA remains unverified in the authoring environment.
- Email ownership is not verified. There is no password reset, account deletion UI, MFA, sessions/device management, team administration, or full abuse-protection service. Plan these before a wider production launch.
- Password hashing uses Worker-compatible PBKDF2-SHA-256 at 100,000 iterations. This is below current high-iteration hardening recommendations; adopt a managed identity provider or a benchmarked stronger scheme before higher-risk deployment.
- No semantic embeddings, vector index, PDF/image parsing, web crawling, tools, file attachments in chat, billing, or model selector in the UI. Corpus limits keep keyword retrieval practical; synonyms and indirect questions may miss relevant passages.
- AI can hallucinate, ignore instructions or misuse citations. Excerpts show what was retrieved, not verified proof of every answer. Prompt injection mitigations are best effort. Inspect sources for important decisions.
- Public assistants can reveal their uploaded knowledge through answers and excerpts. System prompts are hidden from the public API but cannot be guaranteed secret from model extraction. Do not place credentials or private business secrets in public bots.
- Chat content and relevant excerpts are sent to the configured provider and follow that provider's policies. D1 access is isolated per account, but chats are not end-to-end encrypted. Deleting a source does not retroactively remove excerpts already saved in messages; delete affected conversations too.
- History is limited to 100 chats per account and 200 messages per chat. Memory is bounded, so the model does not remember everything stored. Daily limits reset on UTC boundaries. Quotas count generation attempts, including upstream errors.
- Stop/disconnect cancellation is best effort and does not guarantee zero provider billing. Partial output is labeled; if a Worker terminates abruptly, the expired lease is recovered on the next request rather than by an autonomous job.
- No backups/restore drill, independent penetration test, concurrency benchmark, uptime SLO, email support operation, or provider failover is claimed.

## Source and attribution

The ShadowBot application, API, retrieval, UI and tests were written for SHADOWNET. The idea title comes from the user's _Full Stack Projects_ catalogue; no reference chatbot repository was copied. The platform retains the supplied Sites/Vinext starter and its MIT-licensed build adapter, plus documented open-source dependencies. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Original application code is MIT-licensed under [LICENSE](LICENSE); third-party licenses remain in force.
