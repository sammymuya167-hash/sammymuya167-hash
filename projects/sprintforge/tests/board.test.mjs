import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const output = path.resolve(".sites-runtime/test-build");
mkdirSync(output, { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    "--outDir",
    output,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "es2022",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck",
    "lib/board.ts",
    "lib/demo.ts",
  ],
  { stdio: "pipe" },
);
writeFileSync(path.join(output, "package.json"), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const {
  applyAction,
  activeSprint,
  sprintStats,
  exportCsv,
  actionSchema,
} = require(path.join(output, "board.js"));
const { demoBoard } = require(path.join(output, "demo.js"));
const at = Date.parse("2026-10-07T12:00:00Z");
const demo = () => demoBoard(at);
const fields = (i) => ({
  title: i.title,
  description: i.description,
  kind: i.kind,
  priority: i.priority,
  points: i.points,
  assignee: i.assignee,
  labels: i.labels,
  dependsOn: i.dependsOn,
  sprintId: i.sprintId,
});
test("blocked work cannot start, and a rejected action leaves the input intact", () => {
  const b = demo(),
    before = JSON.stringify(b);
  assert.throws(
    () =>
      applyAction(b, { type: "issue.move", id: "demo-4", status: "doing" }, at),
    /blocked/,
  );
  assert.equal(JSON.stringify(b), before);
});
test("completing a dependency unlocks work and records the changed remaining points", () => {
  const b = applyAction(
    demo(),
    { type: "issue.move", id: "demo-5", status: "done" },
    at,
  );
  const next = applyAction(
    b,
    { type: "issue.move", id: "demo-4", status: "doing" },
    at + 1,
  );
  assert.equal(next.issues.find((i) => i.id === "demo-4").status, "doing");
  assert.equal(
    activeSprint(next).history.at(-1).remaining,
    sprintStats(next).remaining,
  );
  assert.ok(next.activity[0].message.includes("In progress"));
});
test("dependency cycles and self-links are rejected before persistence", () => {
  const b = demo(),
    i = b.issues.find((i) => i.id === "demo-5");
  assert.throws(
    () =>
      applyAction(
        b,
        {
          type: "issue.update",
          id: i.id,
          fields: { ...fields(i), dependsOn: ["demo-4"] },
        },
        at,
      ),
    /cycle/,
  );
  assert.throws(
    () =>
      applyAction(
        b,
        {
          type: "issue.update",
          id: i.id,
          fields: { ...fields(i), dependsOn: [i.id] },
        },
        at,
      ),
    /cycle/,
  );
});
test("a completed dependency cannot reopen while dependants are in progress", () => {
  let b = applyAction(
    demo(),
    { type: "issue.move", id: "demo-5", status: "done" },
    at,
  );
  b = applyAction(b, { type: "issue.move", id: "demo-4", status: "doing" }, at);
  assert.throws(
    () =>
      applyAction(b, { type: "issue.move", id: "demo-5", status: "ready" }, at),
    /dependants/,
  );
});
test("sprint completion retains completed scope and returns unfinished work to backlog", () => {
  const b = demo(),
    stats = sprintStats(b),
    closed = applyAction(b, { type: "sprint.complete" }, at);
  assert.equal(activeSprint(closed), undefined);
  assert.equal(closed.sprints[0].completedPoints, stats.done);
  assert.equal(closed.sprints[0].completedTotal, stats.total);
  assert.ok(
    closed.issues
      .filter((i) => i.status !== "done")
      .every((i) => i.sprintId === null && i.status === "backlog"),
  );
  assert.ok(
    closed.issues
      .filter((i) => i.status === "done")
      .every((i) => i.sprintId === "sprint-7"),
  );
});
test("closed sprint totals stay accurate after scope is added during a sprint", () => {
  let b = demo();
  const item = b.issues.find((i) => i.id === "demo-13");
  b = applyAction(
    b,
    {
      type: "issue.update",
      id: item.id,
      fields: { ...fields(item), sprintId: "sprint-7" },
    },
    at,
  );
  const stats = sprintStats(b);
  b = applyAction(b, { type: "sprint.complete" }, at);
  assert.equal(b.sprints[0].completedTotal, stats.total);
  assert.notEqual(b.sprints[0].completedTotal, b.sprints[0].baseline);
});
test("only one sprint can run and dates must be ordered", () => {
  const action = {
    type: "sprint.start",
    name: "Sprint 08",
    goal: "Test",
    startDate: "2026-10-08",
    endDate: "2026-10-21",
    issueIds: ["demo-13"],
  };
  assert.throws(() => applyAction(demo(), action, at), /active sprint/);
  const b = applyAction(demo(), { type: "sprint.complete" }, at);
  assert.throws(
    () => applyAction(b, { ...action, endDate: "2026-10-01" }, at),
    /end date/,
  );
});
test("a new sprint includes selected backlog work without rewriting the prior sprint", () => {
  const b = applyAction(demo(), { type: "sprint.complete" }, at),
    old = JSON.stringify(b.sprints[0]);
  const next = applyAction(
    b,
    {
      type: "sprint.start",
      name: "Sprint 08",
      goal: "Ship",
      startDate: "2026-10-08",
      endDate: "2026-10-21",
      issueIds: ["demo-13", "demo-14"],
    },
    at + 1,
  );
  assert.equal(activeSprint(next).baseline, 8);
  assert.equal(sprintStats(next).items.length, 2);
  assert.equal(JSON.stringify(next.sprints[0]), old);
});
test("archiving referenced work is rejected and unrelated work can be restored", () => {
  const b = demo();
  assert.throws(
    () =>
      applyAction(
        b,
        { type: "issue.archive", id: "demo-5", archived: true },
        at,
      ),
    /links/,
  );
  let next = applyAction(
    b,
    { type: "issue.archive", id: "demo-13", archived: true },
    at,
  );
  next = applyAction(
    next,
    { type: "issue.archive", id: "demo-13", archived: false },
    at,
  );
  assert.equal(next.issues.find((i) => i.id === "demo-13").archived, false);
});
test("comments are appended without erasing the issue or prior activity", () => {
  const b = demo(),
    next = applyAction(
      b,
      {
        type: "issue.comment",
        id: "demo-1",
        body: "Acceptance criteria approved.",
      },
      at,
    );
  assert.equal(
    next.issues[0].comments[0].body,
    "Acceptance criteria approved.",
  );
  assert.equal(b.issues[0].comments.length, 0);
  assert.equal(next.activity.length, b.activity.length + 1);
});
test("new issues receive unique IDs and monotonically increasing project keys", () => {
  const b = demo(),
    f = {
      ...fields(b.issues[0]),
      title: "A new issue",
      dependsOn: [],
      sprintId: null,
    };
  let next = applyAction(b, { type: "issue.create", fields: f }, at);
  next = applyAction(next, { type: "issue.create", fields: f }, at);
  assert.equal(next.issues.at(-1).number, 118);
  assert.notEqual(next.issues.at(-1).id, next.issues.at(-2).id);
  assert.equal(next.issues.at(-1).status, "backlog");
});
test("CSV protects spreadsheet formulas and preserves quoted titles", () => {
  const b = demo();
  b.issues[0].title = '=SUM(1,2) "sample"';
  const csv = exportCsv(b);
  assert.ok(csv.includes('"\'=SUM(1,2) ""sample"""'));
  assert.equal(csv.split("\r\n").length, b.issues.length + 1);
});
test("validation rejects unreasonable estimates and malformed actions", () => {
  const b = demo();
  assert.equal(
    actionSchema.safeParse({
      type: "issue.create",
      fields: { ...fields(b.issues[0]), points: 999 },
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "issue.move",
      id: "demo-1",
      status: "unknown",
    }).success,
    false,
  );
});
