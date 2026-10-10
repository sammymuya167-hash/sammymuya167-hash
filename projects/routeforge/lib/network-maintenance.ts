import { z } from 'zod';
import { hashSecret, TrackingError, trackingResponse, trackingFailure } from './tracking';
import { networkDb, networkEnv, rateLimit, verifySignature } from './network-security';
import { tickNetwork } from './network-dispatch';

const heartbeatKey = () => hashSecret('network:maintenance-heartbeat');
const configured = () => /^[a-f0-9]{64}$/.test(networkEnv().ROUTEFORGE_JOB_KEY ?? '');

export async function maintenanceStatus() {
  const row = await networkDb().prepare('SELECT started_at,attempts FROM login_limits WHERE key=?')
    .bind(await heartbeatKey()).first<{ started_at: number; attempts: number }>();
  return {
    configured: configured(), lastSuccessAt: row?.started_at ?? null,
    lastProcessed: row?.attempts ?? 0, healthy: !!row && Date.now() - row.started_at < 180000,
  };
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new TrackingError(400, 'Send the service operation.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) { await reader.cancel(); throw new TrackingError(413, 'Service operation is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

export async function maintenanceRequest(request: Request) {
  try {
    if (!configured()) throw new TrackingError(503, 'The retry service is not configured.');
    const timestamp = request.headers.get('x-routeforge-job-timestamp') ?? '';
    const signature = request.headers.get('x-routeforge-job-signature') ?? '';
    if (!/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
      throw new TrackingError(401, 'Service authorization is required.');
    const raw = await boundedBody(request);
    if (!await verifySignature(networkEnv().ROUTEFORGE_JOB_KEY!, timestamp + '.' + raw, signature))
      throw new TrackingError(401, 'Service authorization is required.');
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new TrackingError(400, 'Send a valid service operation.'); }
    const { operation } = z.object({ operation: z.enum(['tick', 'status']) }).strict().parse(value);
    await rateLimit('maintenance-service', 120);
    if (operation === 'status') return trackingResponse({ ok: true, ...await maintenanceStatus() });
    // This capability can only resume previously authorized work. It cannot
    // create orders, select a tenant/rider, change prices, or initiate a payment.
    const result = await tickNetwork();
    await networkDb().prepare('INSERT INTO login_limits(key,started_at,attempts) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET started_at=excluded.started_at,attempts=excluded.attempts')
      .bind(await heartbeatKey(), Date.now(), result.processed).run();
    return trackingResponse({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return trackingResponse({ error: 'Invalid service operation.' }, 422);
    return trackingFailure(error);
  }
}
