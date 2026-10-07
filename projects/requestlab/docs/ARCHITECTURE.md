# RequestLab architecture

SSR supplies synthetic collections to a public studio. Optional sign-in loads private D1 data. Tested HTTP requests originate in the browser; no API provides an arbitrary server-side proxy.

`lib/lab.ts` validates drafts, resolves nested variables with cycle checks, constructs Headers, rejects browser-controlled/gateway header injection, and requires HTTPS externally. Fetch omits cookies, rejects redirects, disables cache, supports cancellation and times out after 15 seconds. Streaming reads stop above 1 MiB.

Declarative assertions check actual status, timing, exposed headers or parsed JSON. Structural equality ignores object key ordering. JSON paths check own properties and block prototype traversal. Response bodies render as text, without HTML injection or eval.

Collection execution is sequential and continues after failed assertions. Status/timing/count summaries are browser-reported observations, not server-attested external measurements.

| API                   | Behavior                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `GET /api/workspace`  | Signed-in owner: collections, revision and latest 30 summaries              |
| `POST /api/workspace` | Signed-in owner: validated/redacted snapshot with revision compare-and-swap |
| `POST /api/runs`      | Signed-in owner: bounded summary metadata; no response body or credentials  |
| `/api/mock/*`         | Public synthetic REST sandbox with bounded input and validated orders       |

Workspace saves use one owner-keyed row and a revision predicate; initial creation rejects conflicts. Run reads use an owner/date index. Ownership comes from the trusted gateway, never payload fields. Private JSON is `private, no-store`; mismatched Origin writes fail.

The server re-applies redaction rather than trusting the client. Recognised secret variable values and literal credential headers are cleared. Literal bodies/URLs remain content; use secret variables there. Dirty state and manual saves make persistence explicit. Reload replaces edits with saved data. Guest changes and secret values live only in the current tab.

Tests compile actual TypeScript. Built-Worker integration uses disposable D1 and the real request runner against the built sandbox, covering all starter requests/assertions. It does not access production or external secrets. Destination APIs control availability and CORS; failures are reported without simulated success.

Future work: more collection formats, JSON schema assertions, environment deletion, verified collaborators and history retention controls.
