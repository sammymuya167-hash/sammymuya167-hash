# SprintForge

**Build with momentum.** A sprint planning workspace by SHADOWNET, based on project **33 · Jira Clone** from the supplied _Full Stack Projects_ PDF.

[Public live demo](https://sprintforge-shadownet.sammymuya167.chatgpt.site) · [Architecture](docs/ARCHITECTURE.md) · [Release checks](docs/RELEASE.md) · [MIT licence](LICENSE)

Guests can use an interactive synthetic project. Sign in with ChatGPT for a private saved workspace; each account's board is isolated.

## What works

- Responsive Kanban with drag-and-drop, keyboard status menus, search and assignee filters.
- Create/edit stories, tasks and bugs with priorities, points, labels, dependencies, comments and reversible archiving.
- Server-validated dependency graphs: cycles are rejected; blocked work cannot enter progress, review or done.
- Backlog selection, sprint goals/dates, sprint completion and return of unfinished work to the backlog.
- Burndown after changes, scope-aware completion totals, closed-sprint summaries and activity.
- Private D1 autosave with revision checks against stale tabs and concurrent first saves.
- CSV issue export with spreadsheet formula protection.

## Try it

1. Inspect **Sprint 07** in the public demo.
2. Move **ST-104** into progress. Its dependency blocks the transition.
3. Complete **ST-105**, then move ST-104 again: it is unblocked.
4. Open an issue to change estimates, links or comments. Open **Insights** for progress.
5. Complete the sprint, select backlog issues and start the next sprint.
6. Sign in for a persistent private project. Guest edits remain in their current tab.

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

Integration supplies disposable D1 and fixture identity without production credentials. For interactive local persistence, apply the migration after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fat_argent.sql
pnpm run dev
```

Portable clones use http://localhost:5173 and a local sign-in simulation. Production identity is verified by the Sites gateway. Never trust manually supplied identity headers on an unrestricted production server. The manifest identifies this deployment; provision a separate Site and D1 binding for a copy.

## Scope and verification

This is a single-account planning workspace. Assignees are sample labels, not invited collaborators. Team invitations, realtime collaboration, notifications, attachments and Jira integrations are future work. Limits: 300 issues, 30 sprints, 80 comments per issue, 200 retained activity events and 400 change points per sprint. Preview history is synthetic.

**13 domain tests and 15 built-Worker/D1 checks pass**, covering dependency rules, sprint lifecycle and changing scope, archive/restore, comments, CSV, authentication, account isolation, stale revisions and concurrent creation. TypeScript, lint and production builds are checked. Automated browser interaction tests were unavailable and are not claimed.

## Origin and attribution

Reference: [oldboyxx/jira_clone](https://github.com/oldboyxx/jira_clone), an MIT-licensed React/Node showcase. Its current README and licence were checked on 2026-10-07; the unmodified reference licence is in [docs/JIRA-CLONE-LICENSE.txt](docs/JIRA-CLONE-LICENSE.txt).

SprintForge's interface, planning rules, API and data model are original AI-assisted implementation. It is not a mirror or fork and does not embed upstream source. The hosting/authentication scaffold comes from the Sites Vinext starter. Retained scaffold and dependencies keep their licences. Original code is MIT licensed.
