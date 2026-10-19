import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
test("private AI gateway authenticates and streams through the AI binding", async (t) => {
  const mf = new Miniflare({
    workers: [
      {
        name: "gateway",
        modules: true,
        script: readFileSync("gateway/worker.mjs", "utf8"),
        compatibilityDate: "2026-05-15",
        bindings: { GATEWAY_KEY: "test-gateway-key" },
        serviceBindings: { AI: { name: "ai-mock", entrypoint: "MockAI" } },
      },
      {
        name: "ai-mock",
        modules: true,
        compatibilityDate: "2026-05-15",
        script: `import {WorkerEntrypoint} from 'cloudflare:workers'; export class MockAI extends WorkerEntrypoint {async run(model,body){if(model!=='@cf/meta/llama-3.1-8b-instruct-fast'||body.max_tokens!==768)throw new Error('Invalid config');return new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data: {"response":"Real streaming protocol"}\\n\\ndata: [DONE]\\n\\n'));c.close();}});}}; export default {fetch(){return new Response('not public',{status:404})}};`,
      },
    ],
  });
  t.after(() => mf.dispose());
  const call = (
    key,
    body = { messages: [{ role: "user", content: "Hello" }] },
  ) =>
    mf.dispatchFetch("https://gateway.test/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal((await call("wrong")).status, 401);
  assert.equal((await mf.dispatchFetch("https://gateway.test/")).status, 404);
  assert.equal((await call("test-gateway-key", { messages: [] })).status, 400);
  const r = await call("test-gateway-key");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type"), /event-stream/);
  assert.match(await r.text(), /Real streaming protocol/);
  assert.equal(
    (
      await call("test-gateway-key", {
        messages: [{ role: "admin", content: "bad" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("test-gateway-key", {
        messages: [{ role: "user", content: "x".repeat(51000) }],
      })
    ).status,
    413,
  );
});
