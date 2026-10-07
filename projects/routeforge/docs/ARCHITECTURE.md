# Architecture and engineering decisions

## Request and storage boundary

The browser submits a scenario to `POST /api/optimize`. Sites injects the authenticated identity; the handler requires it, checks same-origin browser requests, validates a bounded JSON payload with Zod, computes the plan and persists an immutable run. A failed database write fails the request rather than pretending the run was saved.

`GET /api/plans` returns only the current owner's saved plans and latest 15 runs. `POST /api/plans` creates a saved scenario or updates an existing record with both its ID and owner in the predicate. `PATCH /api/plans` archives or restores with the same ownership predicate. No client-supplied owner ID is accepted. Responses containing private data use `Cache-Control: private, no-store`.

D1 indexes `(owner_id, updated_at)` and `(owner_id, created_at)` support the plan and history views. SQL is generated through Drizzle migrations, with no runtime schema creation. Archive is a timestamp, so restore does not recreate or lose a plan.

## Optimization

1. Consider high-priority stops before standard stops, then earlier deadlines and heavier loads.
2. Evaluate every insertion position in every active vehicle's current route.
3. Reject candidates exceeding payload, arrival windows or depot-return shift deadline.
4. Choose the least incremental distance with a small incremental-duration tie preference.
5. Improve each route with at most five 2-opt passes, rechecking every hard constraint.
6. Return every unassigned stop with a capacity or combined-feasibility reason.

Input objects remain unchanged. The distance baseline uses the same assigned stops and vehicles, in input order, which makes the distance comparison reproducible. This is a planning heuristic, not a proof of optimality.

## Product integrity

The first view is an explicitly labelled preview computed from synthetic data. Clicking Optimize makes a real authenticated server request and stores its snapshot. Editing an input clears the old result so stale metrics cannot be mistaken for a new plan. CSV imports validate all rows before replacing the draft. CSV manifests neutralize spreadsheet formulas in text fields.

## Next engineering milestones

- Add a road travel-time matrix provider and draw road-following geometry.
- Add persistent fleet profiles and shareable, read-only driver manifests.
- Add distance/cost objectives and regret insertion to improve difficult cases.
- Extend the Worker/D1 HTTP integration suite with browser accessibility tests in a supported QA environment.
- Add an operational import queue and audit log before handling live commerce orders.
