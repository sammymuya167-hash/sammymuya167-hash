# RequestLab

**Know what your API is saying.** An API testing studio by SHADOWNET, based on project **98 · API Testing Tool (Postman Clone)** from the supplied _Full Stack Projects_ PDF.

[Public live demo](https://requestlab-shadownet.sammymuya167.chatgpt.site) · [Architecture](docs/ARCHITECTURE.md) · [Release checks](docs/RELEASE.md) · [MIT licence](LICENSE)

Send real requests without signing in. Sign in with ChatGPT to save private collections, nonsecret environment values and compact run summaries.

## What works

- Collections with GET, POST, PUT, PATCH, DELETE and HEAD; URLs, query parameters, headers and raw/JSON bodies.
- Named environments, nested variables, missing-name checks, cycle detection and session-only secrets.
- Live server sandbox: product catalogue/lookup, validated synthetic orders, JSON echo and intentional error statuses.
- Direct browser requests to external HTTPS APIs that permit CORS; cancellation, 15-second timeout and 1 MiB response limit.
- Highlighted JSON/text responses, headers, measured duration and byte size.
- Declarative status, JSON equality, field existence, header and timing assertions; dotted paths and JSON Pointer.
- Sequential collection runs with actual response checks and saved summaries; no arbitrary script execution.
- JSON workspace import/export and shell-quoted cURL with credential placeholders.
- Private D1 collections/history, revision conflict checks and account isolation. The server redacts secrets before persistence.

## Try it

1. Select **List products**, click **Send**, and inspect the JSON and **Tests** tabs.
2. Choose **Create an order**; the server calculates a synthetic order total.
3. Run **Commerce sandbox** to check all four contracts, including invalid input.
4. Add a request or environment using `{{base_url}}` and `{{api_token}}` variables.
5. Use **Code**, **Export** or **Import** to move requests between tools.
6. Sign in to save collections and run summaries. Re-enter secrets per tab.

## Stack and local setup

TypeScript · React 19 · Vinext · Cloudflare Workers · D1 · Drizzle · Zod · Lucide · Sites ChatGPT identity.

Node >=22.13 and pnpm 11.25 are required. Run from this directory:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run lint
pnpm run build
pnpm run test:integration
```

Integration uses the built Worker and disposable D1, without external API keys. For interactive local persistence after a build:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fast_dakota_north.sql
pnpm run dev
```

Portable clones use http://localhost:5173 and a local sign-in simulation. Production identity comes from the Sites gateway. Never trust manually supplied identity headers on an unrestricted production server. Provision a separate Site and D1 binding for a copy; the manifest identifies this deployment.

## Scope and privacy

Execution happens in the browser. External APIs need CORS and HTTPS; browser-controlled headers are rejected. Cookies are omitted and redirects return an error. There is no proxy, OAuth flow, websocket client, user script runner or Postman-format importer.

Orders are synthetic and stateless: no purchase, payment or inventory change occurs. JSON import accepts RequestLab's own exported format.

Secret variables and literal credential headers stay in memory and are cleared for save/export. Literal bodies, URLs and nonsecret values remain request content: use secret variables for credentials there. Recognised secrets are redacted from cURL. Response bodies are not stored in history. Summaries are browser-reported observations, not independently attested API results.

Limits: 15 collections × 40 requests, 10 environments × 24 variables, 24 headers and 20 assertions per request, 24 KB bodies, 220 KB save/import payload, 15-second requests and 1 MiB responses. The UI shows the latest 30 run summaries and up to 2,500 response lines; Copy body returns the full bounded response.

## Validation

**14 request/domain tests and 18 built-Worker/D1 checks pass.** Integration executes all seven starter requests with the real request runner against the built sandbox and evaluates every included assertion. It also verifies redaction, storage, account isolation, revision conflicts, concurrent creation, invalid orders and HEAD behavior.

TypeScript, ESLint and production builds are checked. Automated browser interaction tests were unavailable. External CORS behavior varies by API; universal external API support is not claimed.

## Origin and attribution

Reference: [hoppscotch/hoppscotch](https://github.com/hoppscotch/hoppscotch). Its current README and MIT licence were checked on 2026-10-07. The unmodified reference licence is retained in [docs/HOPPSCOTCH-LICENSE.txt](docs/HOPPSCOTCH-LICENSE.txt).

RequestLab's interface, assertion engine, request runner, sandbox and D1 APIs are original AI-assisted implementation. It is not a mirror or fork and does not embed Hoppscotch source. The hosting/authentication scaffold comes from the Sites Vinext starter; retained scaffold and dependencies keep their licences. Original code is MIT licensed.
