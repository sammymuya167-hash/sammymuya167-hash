# CanvasRoom

CanvasRoom is an original, full-stack visual collaboration studio built from catalogue idea **#77 — Design Collaboration Tool (Figma Clone)**. It provides a polished SVG canvas for product-flow mapping with draggable shapes, connectors, review pins, undo/redo, JSON export, private cloud saves, optimistic revision checks, and named snapshots.

## What works

- Create, move, edit, recolour, connect, and delete canvas objects.
- Add positional and board-level review comments; resolve and reopen feedback.
- Undo/redo up to 30 local edits, zoom the workspace, and export portable JSON.
- Sign in with ChatGPT to save one account-private board and up to 20 visible snapshots.
- Server-side Zod validation, payload limits, same-origin write checks, D1 ownership filtering, no-store responses, and compare-and-swap revisions.
- Responsive desktop/tablet/mobile layout and a synthetic checkout-flow demo.

## Architecture

```text
Browser (React/SVG canvas)
       │ GET/POST /api/board
       ▼
Vinext Worker route ── ChatGPT identity header
       │              └─ owner-scoped authorization
       ▼
Cloudflare D1 ── boards + snapshots
```

The public URL is visible to anyone, but persistence is identity-scoped: anonymous visitors receive the synthetic demo and cannot read or write saved board data.

## Local setup

Requirements: Node 22.13+ and pnpm 11.

```bash
pnpm install
pnpm db:generate
pnpm verify
pnpm dev
```

The hosted runtime provisions D1 from `.openai/hosting.json`.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Honest limitations

- This release uses account-private persistence and synthetic collaborator presence; it does not claim live multi-user cursors or WebSocket co-editing.
- One current board is stored per signed-in account; snapshots are version checkpoints, not branches.
- The canvas supports core product-flow primitives rather than vector paths, image upload, typography systems, or production design handoff.
- JSON export is implemented; JSON import and image/PDF export are future work.

## Originality, AI assistance, and attribution

The implementation is original and AI-assisted. No source, package, asset, or UI code was copied from the catalogue reference. The reference repository, `tldraw/tldraw`, currently uses a custom licence that prohibits production deployment without an applicable separate licence, so CanvasRoom deliberately does **not** depend on or redistribute tldraw. See [ATTRIBUTION.md](ATTRIBUTION.md).

## Licence

MIT — see [LICENSE](LICENSE).
