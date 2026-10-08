import { env } from "cloudflare:workers";
import { z } from "zod";
import {
  type Device,
  type TrackingEvent,
  deviceInput,
  deviceStatus,
  hashSecret,
  randomSecret,
  normalizePairCode,
  TrackingError,
  sortEvents,
} from "./tracking";
function db() {
  return env.DB as D1Database;
}
type Row = {
  id: string;
  owner_id: string;
  driver_name: string;
  vehicle_label: string;
  phone_label: string;
  device_name: string | null;
  created_at: number;
  paired_at: number | null;
  pair_expires_at: number | null;
  revoked_at: number | null;
  last_seen_at: number | null;
  last_event_at: number | null;
  last_event_kind: string | null;
  latest_point_json: string | null;
  token_hash: string | null;
};
function view(row: Row): Device {
  const d = {
    id: row.id,
    driverName: row.driver_name,
    vehicleLabel: row.vehicle_label,
    phoneLabel: row.phone_label,
    deviceName: row.device_name,
    createdAt: row.created_at,
    pairedAt: row.paired_at,
    pairExpiresAt: row.pair_expires_at,
    revokedAt: row.revoked_at,
    lastSeenAt: row.last_seen_at,
    lastEventAt: row.last_event_at,
    lastEventKind: row.last_event_kind,
    latestPoint: row.latest_point_json
      ? JSON.parse(row.latest_point_json)
      : null,
  };
  return { ...d, status: deviceStatus(d) };
}
export async function listDevices(owner: string) {
  const rows = await db()
    .prepare(
      "SELECT * FROM tracking_devices WHERE owner_id=? ORDER BY created_at DESC",
    )
    .bind(owner)
    .all<Row>();
  return rows.results.map(view);
}
export async function createDevice(owner: string, payload: unknown) {
  const input = deviceInput.safeParse(payload);
  if (!input.success)
    throw new TrackingError(
      422,
      "Enter a driver name and valid device labels.",
    );
  const id = crypto.randomUUID(),
    code = randomSecret(10).toUpperCase(),
    now = Date.now(),
    expiresAt = now + 600000;
  const added = await db()
    .prepare(
      "INSERT INTO tracking_devices(id,owner_id,driver_name,vehicle_label,phone_label,created_at,pair_code_hash,pair_expires_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM tracking_devices WHERE owner_id=?) < 50 RETURNING id",
    )
    .bind(
      id,
      owner,
      input.data.driverName,
      input.data.vehicleLabel,
      input.data.phoneLabel,
      now,
      await hashSecret(code),
      expiresAt,
      owner,
    )
    .first();
  if (!added)
    throw new TrackingError(
      409,
      "You have 50 devices. Remove a revoked device before adding another.",
    );
  return { id, code: code.match(/.{1,5}/g)!.join("-"), expiresAt };
}
export async function changeDevice(owner: string, payload: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      action: z.enum(["revoke", "renew", "remove"]),
    })
    .strict()
    .safeParse(payload);
  if (!parsed.success)
    throw new TrackingError(422, "Choose a device and action.");
  const { id, action } = parsed.data;
  const row = await db()
    .prepare("SELECT * FROM tracking_devices WHERE id=? AND owner_id=?")
    .bind(id, owner)
    .first<Row>();
  if (!row) throw new TrackingError(404, "Device not found.");
  if (action === "remove") {
    if (!row.revoked_at)
      throw new TrackingError(
        409,
        "Unlink this device before deleting its history.",
      );
    await db().batch([
      db()
        .prepare(
          "DELETE FROM tracking_events WHERE device_id IN (SELECT id FROM tracking_devices WHERE id=? AND owner_id=? AND revoked_at IS NOT NULL)",
        )
        .bind(id, owner),
      db()
        .prepare(
          "DELETE FROM tracking_devices WHERE id=? AND owner_id=? AND revoked_at IS NOT NULL",
        )
        .bind(id, owner),
    ]);
    return { ok: true };
  }
  if (action === "renew") {
    if (row.paired_at || row.revoked_at)
      throw new TrackingError(
        409,
        "Create a new device link after unlinking a paired device.",
      );
    const code = randomSecret(10).toUpperCase(),
      expiresAt = Date.now() + 600000;
    const changed = await db()
      .prepare(
        "UPDATE tracking_devices SET pair_code_hash=?,pair_expires_at=? WHERE id=? AND owner_id=? AND paired_at IS NULL AND revoked_at IS NULL RETURNING id",
      )
      .bind(await hashSecret(code), expiresAt, id, owner)
      .first();
    if (!changed)
      throw new TrackingError(
        409,
        "This device was just paired. Refresh the list.",
      );
    return { id, code: code.match(/.{1,5}/g)!.join("-"), expiresAt };
  }
  await db()
    .prepare(
      "UPDATE tracking_devices SET revoked_at=?,token_hash=NULL,pair_code_hash=NULL,pair_expires_at=NULL WHERE id=? AND owner_id=?",
    )
    .bind(Date.now(), id, owner)
    .run();
  return { ok: true };
}
export async function pairDevice(payload: unknown) {
  const input = z
    .object({
      code: z.string().max(40),
      deviceName: z.string().trim().min(1).max(100),
    })
    .strict()
    .safeParse(payload);
  if (!input.success)
    throw new TrackingError(422, "Enter your one-time pairing code.");
  const code = normalizePairCode(input.data.code);
  if (!code)
    throw new TrackingError(401, "The pairing code is invalid or expired.");
  const token = randomSecret(),
    now = Date.now();
  const row = await db()
    .prepare(
      "UPDATE tracking_devices SET token_hash=?,paired_at=?,device_name=?,pair_code_hash=NULL,pair_expires_at=NULL WHERE pair_code_hash=? AND pair_expires_at>? AND paired_at IS NULL AND revoked_at IS NULL RETURNING *",
    )
    .bind(
      await hashSecret(token),
      now,
      input.data.deviceName,
      await hashSecret(code),
      now,
    )
    .first<Row>();
  if (!row)
    throw new TrackingError(
      401,
      "The pairing code is invalid, used or expired.",
    );
  return {
    deviceId: row.id,
    driverName: row.driver_name,
    vehicleLabel: row.vehicle_label,
    token,
  };
}
export async function authenticateDevice(request: Request) {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) throw new TrackingError(401, "Pair your device before syncing.");
  const hash = await hashSecret(match[1]);
  const row = await db()
    .prepare(
      "SELECT * FROM tracking_devices WHERE token_hash=? AND revoked_at IS NULL",
    )
    .bind(hash)
    .first<Row>();
  if (!row)
    throw new TrackingError(
      401,
      "This device link was revoked. Contact your dispatcher.",
    );
  return { id: row.id, hash };
}
export async function ingestEvents(
  device: { id: string; hash: string },
  events: TrackingEvent[],
) {
  const now = Date.now(),
    ordered = sortEvents(events);
  const statements = ordered.map((e) =>
    db()
      .prepare(
        "INSERT INTO tracking_events(device_id,event_id,trip_id,kind,recorded_at,received_at,payload_json) SELECT id,?,?,?,?,?,? FROM tracking_devices WHERE id=? AND token_hash=? AND revoked_at IS NULL ON CONFLICT(device_id,event_id) DO NOTHING",
      )
      .bind(
        e.eventId,
        e.tripId,
        e.kind,
        e.recordedAt,
        now,
        JSON.stringify(e),
        device.id,
        device.hash,
      ),
  );
  statements.push(
    db()
      .prepare(
        "UPDATE tracking_devices SET last_seen_at=?,last_event_at=(SELECT recorded_at FROM tracking_events WHERE device_id=? ORDER BY recorded_at DESC,CASE kind WHEN 'stop' THEN 2 WHEN 'point' THEN 1 ELSE 0 END DESC,event_id DESC LIMIT 1),last_event_kind=(SELECT kind FROM tracking_events WHERE device_id=? ORDER BY recorded_at DESC,CASE kind WHEN 'stop' THEN 2 WHEN 'point' THEN 1 ELSE 0 END DESC,event_id DESC LIMIT 1),latest_point_at=(SELECT recorded_at FROM tracking_events WHERE device_id=? AND kind='point' ORDER BY recorded_at DESC,event_id DESC LIMIT 1),latest_point_json=(SELECT json_set(payload_json,'$.receivedAt',received_at) FROM tracking_events WHERE device_id=? AND kind='point' ORDER BY recorded_at DESC,event_id DESC LIMIT 1) WHERE id=? AND token_hash=? AND revoked_at IS NULL RETURNING id",
      )
      .bind(
        now,
        device.id,
        device.id,
        device.id,
        device.id,
        device.id,
        device.hash,
      ),
  );
  const result = await db().batch(statements);
  if (!result[ordered.length]?.results.length)
    throw new TrackingError(
      401,
      "The device was unlinked. Uploads have stopped.",
    );
  return { acknowledged: ordered.map((e) => e.eventId), serverTime: now };
}
export async function history(owner: string, url: URL) {
  const id = url.searchParams.get("deviceId");
  if (!id || !z.string().uuid().safeParse(id).success)
    throw new TrackingError(422, "Choose a device.");
  const own = await db()
    .prepare("SELECT id FROM tracking_devices WHERE id=? AND owner_id=?")
    .bind(id, owner)
    .first();
  if (!own) throw new TrackingError(404, "Device not found.");
  const trip = url.searchParams.get("tripId");
  if (trip && !z.string().uuid().safeParse(trip).success)
    throw new TrackingError(422, "Choose a valid journey.");
  const mode = url.searchParams.get("mode");
  if (mode === "trips") {
    const rows = await db()
      .prepare(
        "SELECT trip_id AS id,MIN(recorded_at) AS startedAt,MAX(recorded_at) AS lastAt,SUM(CASE WHEN kind='point' THEN 1 ELSE 0 END) AS points,MAX(CASE WHEN kind='stop' THEN recorded_at END) AS stoppedAt FROM tracking_events WHERE device_id=? GROUP BY trip_id ORDER BY startedAt DESC LIMIT 100",
      )
      .bind(id)
      .all();
    return { trips: rows.results };
  }
  let afterTime = Number.MAX_SAFE_INTEGER,
    afterId = "~";
  const cursor = url.searchParams.get("cursor");
  if (cursor) {
    try {
      const c = JSON.parse(atob(cursor));
      if (
        !Number.isSafeInteger(c.t) ||
        typeof c.id !== "string" ||
        !z.string().uuid().safeParse(c.id).success
      )
        throw new Error();
      afterTime = c.t;
      afterId = c.id;
    } catch {
      throw new TrackingError(422, "Invalid history cursor.");
    }
  }
  const lower = trip ? 0 : Date.now() - 86400000;
  const rows = await db()
    .prepare(
      "SELECT event_id,recorded_at,received_at,payload_json FROM tracking_events WHERE device_id=? AND recorded_at>=? AND (? IS NULL OR trip_id=?) AND (recorded_at<? OR (recorded_at=? AND event_id<?)) ORDER BY recorded_at DESC,event_id DESC LIMIT 501",
    )
    .bind(id, lower, trip, trip, afterTime, afterTime, afterId)
    .all<{
      event_id: string;
      recorded_at: number;
      received_at: number;
      payload_json: string;
    }>();
  const page = rows.results.slice(0, 500),
    last = page.at(-1);
  return {
    events: [...page]
      .reverse()
      .map((r) => ({
        ...JSON.parse(r.payload_json),
        receivedAt: r.received_at,
      })),
    nextCursor:
      rows.results.length > 500 && last
        ? btoa(JSON.stringify({ t: last.recorded_at, id: last.event_id }))
        : null,
    serverTime: Date.now(),
  };
}
