import assert from "node:assert/strict";
import { mf, migrate, request } from "./runtime.mjs";
let checks = 0;
const pass = (message) => {
  checks++;
  console.log("✓ " + message);
};
const action = (type, fields = {}) => ({ type, ...fields });
const write = (a, revision = 0, owner = "test-a") =>
  request("/api/board", "POST", { action: a, revision }, owner);
try {
  await migrate();
  const home = await request("/", "GET", undefined, null);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Build with momentum/);
  pass("public SSR renders a usable synthetic workspace");
  assert.equal(
    (await request("/api/board", "GET", undefined, null)).status,
    401,
  );
  pass("anonymous visitors cannot read private boards");
  assert.equal(
    (
      await write(
        action("project.update", {
          name: "My store",
          key: "MS",
          description: "Fixture",
        }),
        0,
        null,
      )
    ).status,
    401,
  );
  pass("anonymous visitors cannot persist changes");
  assert.equal(
    (
      await request(
        "/api/board",
        "POST",
        {
          revision: 0,
          action: action("project.update", {
            name: "My store",
            key: "MS",
            description: "Fixture",
          }),
        },
        "test-a",
        "https://other.test",
      )
    ).status,
    403,
  );
  pass("cross-origin writes are rejected");
  assert.equal((await request("/api/board", "POST", null)).status, 400);
  pass("malformed payloads return validation errors");
  const created = await write(
    action("project.update", {
      name: "My store",
      key: "MS",
      description: "Fixture",
    }),
  );
  assert.equal(created.status, 201);
  const first = await created.json();
  assert.equal(first.revision, 1);
  assert.equal(first.board.name, "My store");
  pass("signed-in account initializes a durable board");
  const other = await request("/api/board", "GET", undefined, "test-b");
  assert.equal((await other.json()).board, null);
  pass("another account cannot see the owner board");
  const invalid = await write(
    action("issue.move", { id: "demo-4", status: "doing" }),
    1,
  );
  assert.equal(invalid.status, 400);
  const saved = await (await request("/api/board")).json();
  assert.equal(saved.revision, 1);
  pass("blocked changes fail without mutating saved data");
  const dep = await write(
    action("issue.move", { id: "demo-5", status: "done" }),
    1,
  );
  assert.equal(dep.status, 200);
  pass("server validates dependency completion");
  assert.equal(
    (await write(action("issue.move", { id: "demo-4", status: "doing" }), 1))
      .status,
    409,
  );
  pass("stale revisions cannot overwrite newer work");
  const move = await write(
    action("issue.move", { id: "demo-4", status: "doing" }),
    2,
  );
  assert.equal(move.status, 200);
  assert.equal(
    (await move.json()).board.issues.find((i) => i.id === "demo-4").status,
    "doing",
  );
  pass("completed dependencies unlock a persisted issue transition");
  const createdOther = await write(
    action("project.update", {
      name: "Other store",
      key: "OT",
      description: "Other",
    }),
    0,
    "test-b",
  );
  assert.equal(createdOther.status, 201);
  assert.equal(
    (await (await request("/api/board")).json()).board.name,
    "My store",
  );
  pass("account-owned updates do not affect another workspace");
  const comment = await write(
    action("issue.comment", { id: "demo-1", body: "A persisted comment" }),
    3,
  );
  assert.equal(comment.status, 200);
  const reloaded = await request("/api/board");
  assert.equal(reloaded.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (await reloaded.json()).board.issues[0].comments[0].body,
    "A persisted comment",
  );
  pass("comments reload from D1 with private cache headers");
  const completed = await write(action("sprint.complete"), 4);
  assert.equal(completed.status, 200);
  const closed = await completed.json();
  assert.equal(closed.board.sprints[0].state, "closed");
  assert.ok(
    closed.board.issues
      .filter((i) => i.status !== "done")
      .every((i) => i.sprintId === null),
  );
  pass(
    "completing a sprint preserves history and returns unfinished work to backlog",
  );
  const races = await Promise.all([
    write(
      action("project.update", {
        name: "Concurrent one",
        key: "CO",
        description: "",
      }),
      0,
      "race-user",
    ),
    write(
      action("project.update", {
        name: "Concurrent two",
        key: "CT",
        description: "",
      }),
      0,
      "race-user",
    ),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  pass("concurrent first saves create one board without lost updates");
  console.log(`${checks} Worker/D1 integration checks passed.`);
} finally {
  await mf.dispose();
}
