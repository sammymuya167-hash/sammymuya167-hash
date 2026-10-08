import { z } from "zod";

export const deviceInput = z
  .object({
    driverName: z.string().trim().min(1).max(80),
    vehicleLabel: z.string().trim().max(80).default(""),
    phoneLabel: z
      .string()
      .trim()
      .max(32)
      .regex(/^[+\d ()-]*$/)
      .default(""),
  })
  .strict();
const base = {
  eventId: z.string().uuid(),
  tripId: z.string().uuid(),
  recordedAt: z.number().int().min(1577836800000),
};
export const trackingEvent = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("point"),
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
      accuracy: z.number().finite().min(0).max(100000),
      speed: z.number().finite().min(0).max(200).nullable().optional(),
      heading: z.number().finite().min(0).max(360).nullable().optional(),
      battery: z.number().int().min(0).max(100).nullable().optional(),
    })
    .strict(),
  z.object({ ...base, kind: z.literal("start") }).strict(),
  z.object({ ...base, kind: z.literal("stop") }).strict(),
]);
export const batchInput = z
  .object({ events: z.array(trackingEvent).min(1).max(50) })
  .strict();
export type TrackingEvent = z.infer<typeof trackingEvent>;
export type Device = {
  id: string;
  driverName: string;
  vehicleLabel: string;
  phoneLabel: string;
  deviceName: string | null;
  createdAt: number;
  pairedAt: number | null;
  pairExpiresAt: number | null;
  revokedAt: number | null;
  lastSeenAt: number | null;
  lastEventAt: number | null;
  lastEventKind: string | null;
  rider?:{onDuty:boolean;gpsEnabled:boolean;appVersion:number;heartbeatAt:number};
  latestPoint:
    | (Extract<TrackingEvent, { kind: "point" }> & { receivedAt: number })
    | null;
  status:
    | "pending"
    | "expired"
    | "ready"
    | "live"
    | "stale"
    | "stopped"
    | "revoked";
};
export function deviceStatus(
  d: Omit<Device, "status">,
  now = Date.now(),
): Device["status"] {
  if (d.revokedAt) return "revoked";
  if (!d.pairedAt) return (d.pairExpiresAt ?? 0) <= now ? "expired" : "pending";
  if (d.lastEventKind === "stop") return "stopped";
  if (!d.lastEventAt || d.lastEventKind === "start") return "ready";
  return d.latestPoint &&
    now - d.latestPoint.recordedAt < 90000 &&
    now - (d.lastSeenAt ?? 0) < 90000
    ? "live"
    : "stale";
}
export function normalizePairCode(value: string) {
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-F0-9]{20}$/.test(code) ? code : null;
}
export function randomSecret(bytes = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hashSecret(value: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function sortEvents(events: TrackingEvent[]) {
  const priority = { start: 0, point: 1, stop: 2 };
  return [...events].sort(
    (a, b) =>
      a.recordedAt - b.recordedAt ||
      priority[a.kind] - priority[b.kind] ||
      a.eventId.localeCompare(b.eventId),
  );
}
export function validateBatch(payload: unknown, now = Date.now()) {
  const parsed = batchInput.safeParse(payload);
  if (!parsed.success)
    throw new TrackingError(422, "Check the location batch format.");
  if (parsed.data.events.some((e) => e.recordedAt > now + 300000))
    throw new TrackingError(
      422,
      "The phone clock is ahead. Correct it before syncing.",
    );
  const ids = new Set(parsed.data.events.map((e) => e.eventId));
  if (ids.size !== parsed.data.events.length)
    throw new TrackingError(422, "A batch cannot repeat event IDs.");
  return sortEvents(parsed.data.events);
}
export class TrackingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function trackingPayload(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new TrackingError(415, "Send JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new TrackingError(400, "Send a request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 100000) {
        await reader.cancel();
        throw new TrackingError(413, "Send smaller batches.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new TrackingError(400, "Send valid JSON.");
  }
}
export function trackingResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function trackingFailure(error: unknown) {
  if (error instanceof TrackingError)
    return trackingResponse({ error: error.message }, error.status);
  console.error("Tracking request failed"); // Never log coordinates, codes, tokens or request payloads.
  return trackingResponse(
    {
      error:
        "Tracking is temporarily unavailable. Your phone will keep unsent points.",
    },
    503,
  );
}
