# SprintForge architecture

Public SSR supplies a synthetic board. A signed-in client loads its private board; guests apply the same pure planning rules locally.

`lib/board.ts` validates actions with Zod, clones the input, applies a bounded operation, validates dependencies, records remaining points and appends activity. Rejection leaves input unchanged. Closing a sprint captures delivered/total scope and returns unfinished issues to backlog without rewriting its summary.

`POST /api/board` accepts an action and base revision, not an arbitrary board snapshot or owner. Stable identity comes from the Sites gateway. D1 mutations use `UPDATE ... WHERE owner_id = ? AND revision = ? RETURNING`. First saves use `ON CONFLICT DO NOTHING`; competing saves receive 409. Board, activity, history and revision commit together in one row.

`GET /api/board` filters by authenticated owner and returns `private, no-store`. Writes reject a mismatched Origin. Browser code has no database credentials. Keep production behind the identity gateway.

| Boundary              | Behavior                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Client → API          | Bounded, validated action; authenticated identity and Origin check |
| API → domain          | Pure rules reject invalid transitions and dependency cycles        |
| API → D1              | Owner key and revision compare-and-swap                            |
| Guest → saved project | Guest edits stay in the tab; sign-in loads private data            |
| Completion → history  | Scope totals captured; incomplete work returns to backlog          |

Tests compile actual domain modules. Integration uses the built Worker, Miniflare, disposable D1 and gateway fixture headers, without touching production. Future work: verified collaborators, separate issue rows for larger projects and durable per-sprint events.
