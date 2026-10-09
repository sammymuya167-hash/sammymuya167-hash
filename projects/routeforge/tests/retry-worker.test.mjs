import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import '../scripts/sites-env.mjs';

const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { Miniflare } = require('miniflare');
const origin = 'https://routeforge-shadownet.sammymuya167.chatgpt.site';
const key = '81'.repeat(32); // Synthetic credential, never a production secret.
const calls = [];
let upstreamStatus = 200;
let upstreamBody = { ok: true, processed: 3 };
const mf = new Miniflare({
  modules: true,
  scriptPath: path.resolve('operations/retry-worker/worker.mjs'),
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  unsafeTriggerHandlers: true, // Miniflare's local-only scheduled event harness.
  bindings: { ROUTEFORGE_URL: origin, ROUTEFORGE_JOB_KEY: key },
  port: 0,
  outboundService: async request => {
    calls.push({ url: request.url, method: request.method, body: await request.text(), headers: request.headers });
    return Response.json(upstreamBody, { status: upstreamStatus, headers: upstreamStatus === 302 ? { Location: 'https://foreign.test/private' } : {} });
  },
});
test.after(() => mf.dispose());

function signed(body = JSON.stringify({ operation: 'tick' }), timestamp = String(Math.floor(Date.now() / 1000))) {
  return {
    method: 'POST', body,
    headers: {
      'Content-Type': 'application/json',
      'X-RouteForge-Job-Timestamp': timestamp,
      'X-RouteForge-Job-Signature': createHmac('sha256', key).update(timestamp + '.' + body).digest('hex'),
    },
  };
}

test('unauthorized requests cannot run maintenance or reveal credentials', async () => {
  const before = calls.length;
  assert.equal((await mf.dispatchFetch('https://retries.test', { method: 'POST', body: '{}' })).status, 401);
  const health = await (await mf.dispatchFetch('https://retries.test')).json();
  assert.deepEqual(health, { service: 'RouteForge scheduled retries', livePayments: false });
  assert.equal(calls.length, before);
});

test('timestamp and exact-body authorization reject stale or modified requests', async () => {
  const before = calls.length;
  assert.equal((await mf.dispatchFetch('https://retries.test', signed(undefined, String(Math.floor(Date.now() / 1000) - 301)))).status, 401);
  const changed = signed();
  changed.body = JSON.stringify({ operation: 'status' });
  assert.equal((await mf.dispatchFetch('https://retries.test', changed)).status, 401);
  assert.equal((await mf.dispatchFetch('https://retries.test', signed(JSON.stringify({ operation: 'tick', merchantId: 'foreign' })))).status, 422);
  assert.equal(calls.length, before);
});

test('authenticated recovery signs the verified RouteForge service request', async () => {
  const result = await mf.dispatchFetch('https://retries.test', signed());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true, processed: 3 });
  const sent = calls.at(-1);
  assert.equal(sent.url, origin + '/api/internal/network-tick');
  assert.equal(sent.method, 'POST');
  assert.equal(sent.body, JSON.stringify({ operation: 'tick' }));
  const timestamp = sent.headers.get('x-routeforge-job-timestamp');
  assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 5);
  assert.equal(sent.headers.get('x-routeforge-job-signature'), createHmac('sha256', key).update(timestamp + '.' + sent.body).digest('hex'));
});

test('actual scheduled handler invokes the same authenticated service', async () => {
  const before = calls.length;
  const result = await mf.dispatchFetch('https://retries.test/cdn-cgi/handler/scheduled?cron=*+*+*+*+*&time=' + Date.now());
  assert.equal(result.status, 200);
  assert.equal(await result.text(), 'ok');
  assert.equal(calls.length, before + 1);
  assert.equal(calls.at(-1).url, origin + '/api/internal/network-tick');
});

test('upstream failures, redirects and invalid responses fail without redirecting secrets', async () => {
  for (const status of [503, 302]) {
    upstreamStatus = status;
    const before = calls.length;
    assert.equal((await mf.dispatchFetch('https://retries.test', signed())).status, 503);
    assert.equal(calls.length, before + 1);
  }
  upstreamStatus = 200;
  upstreamBody = { ok: false };
  assert.equal((await mf.dispatchFetch('https://retries.test', signed())).status, 503);
  const scheduledFailure = await mf.dispatchFetch('https://retries.test/cdn-cgi/handler/scheduled?cron=*+*+*+*+*');
  assert.equal(scheduledFailure.status, 500);
  upstreamBody = { ok: true, processed: 3 };
});

test('configured target cannot redirect maintenance to an unrelated application', async () => {
  const foreign = new Miniflare({
    modules: true, scriptPath: path.resolve('operations/retry-worker/worker.mjs'),
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], port: 0,
    bindings: { ROUTEFORGE_URL: 'https://unrelated.test', ROUTEFORGE_JOB_KEY: key },
    outboundService: () => { assert.fail('An unrelated target must never receive a service request.'); },
  });
  try { assert.equal((await foreign.dispatchFetch('https://retries.test', signed())).status, 503); }
  finally { await foreign.dispose(); }
});
