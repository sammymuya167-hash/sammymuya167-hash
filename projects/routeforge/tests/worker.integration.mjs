import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Run the built production Worker against a disposable D1 database. Fixture
// identity headers emulate the trusted hosting gateway only inside this test.
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
const serverRoot = path.resolve("dist/server");
function moduleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? moduleFiles(path.join(directory, entry.name))
      : /\.m?js$/.test(entry.name)
        ? [path.join(directory, entry.name)]
        : [],
  );
}
const main = path.join(serverRoot, "index.js");
const mf = new Miniflare({
  modules: [
    main,
    ...moduleFiles(serverRoot).filter((file) => file !== main),
  ].map((file) => ({ type: "ESModule", path: file })),
  modulesRoot: path.resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  assets: {
    directory: path.resolve("dist/client"),
    binding: "ASSETS",
    routerConfig: {
      has_user_worker: true,
      invoke_user_worker_ahead_of_assets: true,
    },
  },
  port: 0,
});
const scenario = {
  name: "Integration fixture",
  depot: { name: "Test depot", lat: -1.27, lng: 36.8 },
  deliveries: [
    {
      id: "test-1",
      name: "Synthetic stop",
      address: "Fixture area",
      lat: -1.275,
      lng: 36.805,
      weight: 5,
      serviceMinutes: 6,
      windowStart: 540,
      windowEnd: 1020,
      priority: "normal",
    },
  ],
  vehicles: [
    {
      id: "test-van",
      name: "Test van",
      driver: "Fixture driver",
      capacity: 30,
      costPerKm: 20,
      shiftStart: 540,
      shiftEnd: 1080,
      active: true,
      color: "#5078ed",
    },
  ],
  speedKph: 28,
  roadFactor: 1.3,
};
let checked = 0;
async function request(
  endpoint,
  method = "GET",
  body,
  owner = "test-a",
  origin = "https://routeforge.test",
) {
  const headers = { Origin: origin };
  if (owner) {
    headers["oai-authenticated-user-id"] = owner;
    headers["oai-authenticated-user-email"] = `${owner}@example.test`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return mf.dispatchFetch(`https://routeforge.test${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function passed(message) {
  checked++;
  console.log(`✓ ${message}`);
}
try {
  const db = await mf.getD1Database("DB");
  const migration = readFileSync("drizzle/0000_open_king_bedlam.sql", "utf8");
  for (const sql of migration.split("--> statement-breakpoint"))
    if (sql.trim()) await db.prepare(sql).run();
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Make every mile count/);
  passed("built Worker renders the dispatch workspace");
  assert.equal(
    (await request("/api/plans", "GET", undefined, null)).status,
    401,
  );
  passed("anonymous requests cannot read private plans");
  assert.equal(
    (await request("/api/optimize", "POST", scenario, null)).status,
    401,
  );
  passed("anonymous requests cannot optimize or store runs");
  assert.equal(
    (
      await request(
        "/api/plans",
        "POST",
        { scenario },
        "test-a",
        "https://other.test",
      )
    ).status,
    403,
  );
  passed("cross-origin writes are rejected");
  const created = await request("/api/plans", "POST", { scenario });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.ok(id);
  passed("a signed-in account saves a plan in D1");
  const other = await request("/api/plans", "GET", undefined, "test-b");
  const otherData = await other.json();
  assert.deepEqual(otherData.plans, []);
  assert.deepEqual(otherData.runs, []);
  passed("another account cannot see the saved plan");
  assert.equal(
    (
      await request(
        "/api/plans",
        "POST",
        { id, scenario: { ...scenario, name: "Unauthorized edit" } },
        "test-b",
      )
    ).status,
    404,
  );
  passed("another account cannot update a known plan ID");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: true }, "test-b"))
      .status,
    404,
  );
  passed("another account cannot archive a known plan ID");
  const mine = await request("/api/plans");
  assert.equal(mine.headers.get("cache-control"), "private, no-store");
  assert.equal((await mine.json()).plans[0].name, scenario.name);
  passed("owner can reload the unchanged plan with private cache headers");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: true })).status,
    200,
  );
  const archived = await (await request("/api/plans")).json();
  assert.ok(archived.plans[0].archivedAt);
  passed("archiving preserves the plan and sets its timestamp");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: false })).status,
    200,
  );
  const restored = await (await request("/api/plans")).json();
  assert.equal(restored.plans[0].archivedAt, null);
  passed("restore returns the same plan without data loss");
  const optimized = await request("/api/optimize", "POST", scenario);
  assert.equal(optimized.status, 200);
  const optimization = await optimized.json();
  assert.equal(optimization.result.assigned, 1);
  assert.equal(optimization.result.unassigned.length, 0);
  const history = await (await request("/api/plans")).json();
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0].id, optimization.runId);
  passed("server optimization persists an immutable run snapshot");
  assert.equal((await request("/api/optimize", "POST", {})).status, 400);
  passed("invalid optimization inputs return a validation error");
  assert.equal((await request("/api/plans", "POST", null)).status, 400);
  passed("invalid plan payloads return a validation error");
  console.log(`${checked} Worker/D1 integration checks passed.`);
} finally {
  await mf.dispose();
}
