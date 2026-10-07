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
    "lib/lab.ts",
    "lib/demo.ts",
  ],
  { stdio: "pipe" },
);
writeFileSync(path.join(output, "package.json"), '{"type":"commonjs"}');
const require = createRequire(import.meta.url),
  lab = require(path.join(output, "lab.js")),
  { demoWorkspace } = require(path.join(output, "demo.js"));
const origin = "https://requestlab.test",
  env = () => structuredClone(demoWorkspace.environments[0]),
  draft = () => structuredClone(demoWorkspace.collections[0].requests[0]);
test("nested environment references resolve and missing names fail before sending", () => {
  assert.equal(
    lab.interpolate("{{base_url}}/api/mock/products", env(), origin),
    origin + "/api/mock/products",
  );
  assert.throws(
    () => lab.interpolate("{{missing}}", env(), origin),
    /missing variable/,
  );
});
test("cyclic variables are rejected without recursion overflow", () => {
  const e = env();
  e.variables = [
    { id: "a", key: "a", value: "{{b}}", secret: false },
    { id: "b", key: "b", value: "{{a}}", secret: false },
  ];
  assert.throws(() => lab.interpolate("{{a}}", e, origin), /cycle/);
});
test("JSON paths support arrays and escaped pointer keys without prototype traversal", () => {
  assert.equal(lab.jsonPath({ products: [{ id: 1 }] }, "products.0.id"), 1);
  assert.equal(lab.jsonPath({ "a/b": { "~": 42 } }, "/a~1b/~0"), 42);
  assert.equal(lab.jsonPath({}, "__proto__.constructor"), undefined);
  assert.equal(lab.jsonPath({ zero: 0 }, "zero"), 0);
});
test("JSON equality compares structured data independently of object key ordering", () => {
  const result = {
    status: 200,
    statusText: "OK",
    durationMs: 40,
    sizeBytes: 2,
    headers: [["content-type", "application/json"]],
    body: '{"payload":{"b":2,"a":1},"ok":false}',
  };
  const checks = lab.evaluateAssertions(
    [
      { id: "one", kind: "json", path: "payload", expected: '{"a":1,"b":2}' },
      { id: "two", kind: "json", path: "ok", expected: "false" },
      { id: "three", kind: "exists", path: "missing", expected: "" },
    ],
    result,
  );
  assert.deepEqual(
    checks.map((c) => c.passed),
    [true, true, false],
  );
});
test("status, header, and time assertions report both failures and actual values", () => {
  const r = {
    status: 422,
    statusText: "",
    durationMs: 90,
    sizeBytes: 0,
    headers: [["Content-Type", "application/json; charset=utf-8"]],
    body: "",
  };
  const checks = lab.evaluateAssertions(
    [
      { id: "s", kind: "status", path: "", expected: "200" },
      {
        id: "h",
        kind: "header",
        path: "content-type",
        expected: "application/json",
      },
      { id: "t", kind: "time", path: "", expected: "80" },
    ],
    r,
  );
  assert.deepEqual(
    checks.map((c) => c.passed),
    [false, true, false],
  );
  assert.equal(checks[0].actual, "422");
});
test("no assertion passes when its network request failed", () => {
  assert.equal(
    lab.evaluateAssertions(
      [{ id: "s", kind: "status", path: "", expected: "0" }],
      {
        status: 0,
        statusText: "",
        durationMs: 0,
        sizeBytes: 0,
        headers: [],
        body: "",
        error: "failed",
      },
    )[0].passed,
    false,
  );
});
test("request URLs reject credentials, non-HTTPS external origins, and private Site routes", () => {
  const d = draft();
  assert.throws(
    () =>
      lab.resolveRequest(
        { ...d, url: "https://u:p@example.com" },
        env(),
        origin,
      ),
    /credentials/,
  );
  assert.throws(
    () =>
      lab.resolveRequest({ ...d, url: "http://example.com" }, env(), origin),
    /HTTPS/,
  );
  assert.throws(
    () => lab.resolveRequest({ ...d, url: "/api/workspace" }, env(), origin),
    /api\/mock/,
  );
});
test("browser-controlled and trusted gateway headers cannot be injected", () => {
  const d = draft();
  d.headers = [
    {
      id: "x",
      key: "oai-authenticated-user-id",
      value: "forged",
      enabled: true,
    },
  ];
  assert.throws(() => lab.resolveRequest(d, env(), origin), /browser controls/);
});
test("saving and exporting redact secrets without changing in-memory values", () => {
  const w = structuredClone(demoWorkspace);
  w.environments[1].variables[1].value = "session-secret";
  w.collections[0].requests[0].headers.push({
    id: "auth",
    key: "Authorization",
    value: "Bearer literal-token",
    enabled: true,
  });
  const safe = lab.sanitizeWorkspace(w);
  assert.equal(safe.environments[1].variables[1].value, "");
  assert.equal(safe.collections[0].requests[0].headers.at(-1).value, "");
  assert.equal(w.environments[1].variables[1].value, "session-secret");
});
test("generated cURL quotes shell metacharacters and replaces credential values", () => {
  const d = draft();
  d.headers.push({
    id: "auth",
    key: "Authorization",
    value: "Bearer secret",
    enabled: true,
  });
  d.method = "POST";
  d.body = '{"note":"a\'b $HOME"}';
  const command = lab.curlCommand(d, env(), origin);
  assert.ok(!command.includes("Bearer secret"));
  assert.ok(command.includes("<session-secret>"));
  assert.ok(command.includes("'\\''"));
  assert.ok(command.includes("$HOME"));
});
test("a real response is read, measured, and tested with cookies omitted", async () => {
  let options;
  const result = await lab.runRequest(
    draft(),
    env(),
    origin,
    undefined,
    async (url, init) => {
      options = init;
      assert.equal(url, origin + "/api/mock/products?limit=3");
      return new Response(
        JSON.stringify({ products: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "error");
  assert.equal(result.status, 200);
  assert.equal(result.checks.filter((c) => c.passed).length, 4);
  assert.ok(result.sizeBytes > 0);
});
test("responses above 1 MiB are cancelled and all checks fail", async () => {
  const result = await lab.runRequest(
    draft(),
    env(),
    origin,
    undefined,
    async () => new Response("x".repeat(1048577)),
  );
  assert.match(result.error, /1 MiB/);
  assert.ok(result.checks.every((c) => !c.passed));
});
test("network CORS failures produce a useful message and no fake status", async () => {
  const result = await lab.runRequest(
    draft(),
    env(),
    origin,
    undefined,
    async () => {
      throw new TypeError("Failed to fetch");
    },
  );
  assert.equal(result.status, 0);
  assert.match(result.error, /CORS/);
});
test("workspace imports reject duplicate request IDs and invalid methods", () => {
  const w = structuredClone(demoWorkspace);
  w.collections[0].requests[1].id = w.collections[0].requests[0].id;
  assert.equal(lab.workspaceSchema.safeParse(w).success, false);
  w.collections[0].requests[0].method = "TRACE";
  assert.equal(lab.workspaceSchema.safeParse(w).success, false);
});
