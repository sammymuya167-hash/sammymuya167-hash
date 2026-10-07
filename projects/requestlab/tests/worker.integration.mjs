import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { mf, migrate, request } from "./runtime.mjs";
const require = createRequire(import.meta.url);
const { demoWorkspace } = require(
  path.resolve(".sites-runtime/test-build/demo.js"),
);
const { runRequest } = require(
  path.resolve(".sites-runtime/test-build/lab.js"),
);
let checks = 0;
const pass = (message) => {
  checks++;
  console.log("✓ " + message);
};
const clone = () => structuredClone(demoWorkspace);
try {
  await migrate();
  const home = await request("/", "GET", undefined, null);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /RequestLab/);
  pass("public SSR renders the request studio");
  assert.equal(
    (await request("/api/workspace", "GET", undefined, null)).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/workspace",
        "POST",
        { workspace: clone(), revision: 0 },
        null,
      )
    ).status,
    401,
  );
  pass("anonymous visitors cannot read or save private collections");
  assert.equal(
    (
      await request(
        "/api/workspace",
        "POST",
        { workspace: clone(), revision: 0 },
        "test-a",
        "https://other.test",
      )
    ).status,
    403,
  );
  pass("cross-origin collection writes are rejected");
  assert.equal((await request("/api/workspace", "POST", null)).status, 400);
  pass("malformed collection input returns a validation error");
  const workspace = clone();
  workspace.environments[1].variables[1].value = "fixture-secret";
  workspace.collections[0].requests[0].headers.push({
    id: "auth",
    key: "Authorization",
    value: "Bearer literal-secret",
    enabled: true,
  });
  const saved = await request("/api/workspace", "POST", {
    workspace,
    revision: 0,
  });
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).revision, 1);
  pass("a signed-in account saves collections in D1");
  const mine = await request("/api/workspace");
  assert.equal(mine.headers.get("cache-control"), "private, no-store");
  const data = await mine.json();
  assert.equal(data.workspace.environments[1].variables[1].value, "");
  assert.equal(
    data.workspace.collections[0].requests[0].headers.at(-1).value,
    "",
  );
  pass("server clears secret values and credential headers before persistence");
  assert.equal(
    (await (await request("/api/workspace", "GET", undefined, "test-b")).json())
      .workspace,
    null,
  );
  pass("another account cannot read the saved workspace");
  assert.equal(
    (
      await request("/api/workspace", "POST", {
        workspace: clone(),
        revision: 0,
      })
    ).status,
    409,
  );
  pass("stale revisions cannot overwrite saved collections");
  const products = await request(
    "/api/mock/products?limit=3",
    "GET",
    undefined,
    null,
  );
  assert.equal(products.status, 200);
  assert.equal((await products.json()).products.length, 3);
  pass("anonymous visitors can test the live products API");
  assert.equal(
    (await request("/api/mock/products?limit=999", "GET", undefined, null))
      .status,
    422,
  );
  assert.equal(
    (await request("/api/mock/products/99", "GET", undefined, null)).status,
    404,
  );
  pass("sandbox validates query limits and missing products");
  const order = await request(
    "/api/mock/orders",
    "POST",
    { productId: 1, quantity: 2, customer: "Fixture customer" },
    null,
  );
  assert.equal(order.status, 201);
  assert.equal((await order.json()).total, 17598);
  pass("synthetic orders calculate actual server totals");
  assert.equal(
    (
      await request(
        "/api/mock/orders",
        "POST",
        { productId: 1, quantity: -1 },
        null,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await request(
        "/api/mock/orders",
        "POST",
        { productId: 3, quantity: 1, customer: "Fixture" },
        null,
      )
    ).status,
    409,
  );
  pass("invalid and out-of-stock orders return the expected HTTP errors");
  const echo = await request(
    "/api/mock/echo",
    "PATCH",
    { message: "hello" },
    null,
  );
  assert.equal((await echo.json()).body.message, "hello");
  assert.equal(
    (await request("/api/mock/status/503", "GET", undefined, null)).status,
    503,
  );
  pass("echo and intentional error endpoints exercise HTTP contracts");
  const head = await request("/api/mock/products/1", "HEAD", undefined, null);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  pass("HEAD returns headers without a response body");
  const fetcher = (url, init) => mf.dispatchFetch(url, init);
  const results = [];
  for (const collection of demoWorkspace.collections)
    for (const draft of collection.requests) {
      const result = await runRequest(
        draft,
        demoWorkspace.environments[0],
        "https://app.test",
        undefined,
        fetcher,
      );
      assert.equal(result.error, undefined);
      assert.ok(
        result.checks.every((c) => c.passed),
        draft.name,
      );
      results.push({
        name: draft.name,
        method: draft.method,
        status: result.status,
        durationMs: result.durationMs,
        passed: result.checks.filter((c) => c.passed).length,
        total: result.checks.length,
        failed: false,
      });
    }
  assert.equal(results.length, 7);
  pass(
    "the real request runner executes all seven starter requests against the built Worker and passes every assertion",
  );
  assert.equal(
    (
      await request(
        "/api/runs",
        "POST",
        { name: "Fixture suite", summary: results },
        null,
      )
    ).status,
    401,
  );
  const run = await request("/api/runs", "POST", {
    name: "Fixture suite",
    summary: results,
  });
  assert.equal(run.status, 201);
  const stored = await (await request("/api/workspace")).json();
  assert.equal(stored.runs.length, 1);
  assert.equal(stored.runs[0].summary.length, 7);
  assert.equal(JSON.stringify(stored.runs).includes("fixture-secret"), false);
  pass("run summaries persist without response bodies or credentials");
  assert.deepEqual(
    (await (await request("/api/workspace", "GET", undefined, "test-b")).json())
      .runs,
    [],
  );
  pass("run history remains scoped to the account");
  const races = await Promise.all([
    request(
      "/api/workspace",
      "POST",
      { workspace: clone(), revision: 0 },
      "race",
    ),
    request(
      "/api/workspace",
      "POST",
      { workspace: clone(), revision: 0 },
      "race",
    ),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  pass("concurrent first saves cannot replace each other");
  console.log(`${checks} Worker/D1 integration checks passed.`);
} finally {
  await mf.dispose();
}
