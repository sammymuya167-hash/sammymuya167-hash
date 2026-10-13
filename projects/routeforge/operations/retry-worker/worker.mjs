const encoder = new TextEncoder();
const origin = 'https://routeforge-shadownet.sammymuya167.chatgpt.site';

/** @param {string} secret */
async function signingKey(secret) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Retry service credential is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
/** @param {ArrayBuffer} value */
const hex = value => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join('');
/** @param {ReadableStream<Uint8Array> | null} body */
async function boundedBody(body) {
  if (!body) throw new Error('Missing body.');
  const reader = body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) { await reader.cancel(); throw new Error('Body limit exceeded.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
/** @param {RetryWorkerEnv} env */
export async function invokeRouteForge(env) {
  if (env.ROUTEFORGE_URL !== origin) throw new Error('Retry service must target the verified RouteForge origin.');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ operation: 'tick' });
  const signature = hex(await crypto.subtle.sign('HMAC', await signingKey(env.ROUTEFORGE_JOB_KEY), encoder.encode(timestamp + '.' + body)));
  const response = await fetch(origin + '/api/internal/network-tick', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(50000),
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'RouteForge-scheduled-retries', 'X-RouteForge-Job-Timestamp': timestamp, 'X-RouteForge-Job-Signature': signature }, body,
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Retry service returned HTTP ' + response.status); }
  const value = JSON.parse(await boundedBody(response.body));
  if (value?.ok !== true || !Number.isInteger(value.processed)) throw new Error('Unexpected retry service response.');
  return Number(value.processed);
}
/** @satisfies {ExportedHandler<RetryWorkerEnv>} */
const worker = {
  scheduled(controller, env, ctx) {
    ctx.waitUntil(invokeRouteForge(env).then(processed => {
      console.log(JSON.stringify({ service: 'RouteForge retries', event: 'tick.completed', scheduledAt: controller.scheduledTime, processed }));
    }).catch(() => {
      console.error(JSON.stringify({ service: 'RouteForge retries', event: 'tick.failed', scheduledAt: controller.scheduledTime }));
      throw new Error('Scheduled retry failed; inspect the protected service health.');
    }));
  },
  async fetch(request, env) {
    if (request.method === 'GET') return Response.json({ service: 'RouteForge scheduled retries', livePayments: false });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    try {
      const timestamp = request.headers.get('x-routeforge-job-timestamp') ?? '';
      const signature = request.headers.get('x-routeforge-job-signature') ?? '';
      if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature))
        return new Response('Unauthorized', { status: 401 });
      const raw = await boundedBody(request.body);
      const bytes = Uint8Array.from(signature.match(/.{2}/g) ?? [], b => parseInt(b, 16));
      if (!await crypto.subtle.verify('HMAC', await signingKey(env.ROUTEFORGE_JOB_KEY), bytes, encoder.encode(timestamp + '.' + raw)))
        return new Response('Unauthorized', { status: 401 });
      const value = JSON.parse(raw);
      if (value?.operation !== 'tick' || Object.keys(value).length !== 1) return new Response('Invalid service operation', { status: 422 });
      const processed = await invokeRouteForge(env);
      return Response.json({ ok: true, processed }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch {
      return new Response('Retry service unavailable', { status: 503 });
    }
  },
};
export default worker;
