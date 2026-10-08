import { z } from "zod";
import type { Device, TrackingEvent } from "./tracking";
export type GPSPoint = Extract<TrackingEvent, { kind: "point" }>;
export const statusLabels: Record<Device["status"], string> = { pending: "Awaiting pairing", expired: "Code expired", ready: "Awaiting GPS", live: "Live", stale: "Location delayed", stopped: "Trip stopped", revoked: "Unlinked" };
export type Motion = "unknown" | "stationary" | "walking" | "moving" | "vehicle";
export const motionLabels: Record<Motion, string> = { unknown: "Movement unknown", stationary: "Stationary", walking: "Likely walking", moving: "Moving", vehicle: "Vehicle-speed movement" };
export function motionOf(point: GPSPoint | null, now = Date.now()): Motion {
  if (!point || now - point.recordedAt > 90000 || point.accuracy > 50 || point.speed == null) return "unknown";
  if (point.speed < .65) return "stationary";
  if (point.speed < 2.5) return "walking";
  if (point.speed < 5) return "moving";
  return "vehicle";
}
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const sinLat = Math.sin((b.lat - a.lat) * rad / 2), sinLng = Math.sin((b.lng - a.lng) * rad / 2);
  const n = sinLat ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * sinLng ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(Math.max(0, 1 - n)));
}
const stopInput = z.object({ id: z.string().min(1).max(64), name: z.string().trim().min(1).max(100), address: z.string().max(180), lat: z.number().finite().min(-85).max(85), lng: z.number().finite().min(-180).max(180) }).strict();
export const dispatchInput = z.object({ deviceId: z.string().uuid(), name: z.string().trim().min(1).max(100), vehicleId: z.string().min(1).max(64), vehicleName: z.string().min(1).max(80), stops: z.array(stopInput).min(1).max(60), radius: z.number().int().min(50).max(300).default(100) }).strict().refine(input => new Set(input.stops.map(s => s.id)).size === input.stops.length, "Stop IDs must be unique.");
export type DispatchStop = z.infer<typeof stopInput> & { arrivedAt: number | null; deliveredAt: number | null };
export type Dispatch = { id: string; deviceId: string; name: string; vehicleId: string; vehicleName: string; stops: DispatchStop[]; radius: number; assignedAt: number; updatedAt: number; revision: number; checkedAt: number };
// GPS arrival is deliberately different from a confirmed delivery.
// Require two precise fixes, at least 15 seconds apart, in one trip inside
// the arrival radius. Duplicates, old pre-dispatch fixes and wide uncertainty do not count.
export function evaluateArrival(dispatch: Dispatch, points: GPSPoint[]): Dispatch {
  const next = dispatch.stops.find(s => !s.deliveredAt);
  if (!next || next.arrivedAt) return dispatch;
  const threshold = Math.max(dispatch.assignedAt, ...dispatch.stops.map(s => s.deliveredAt ?? 0));
  let candidate: GPSPoint | null = null;
  const unique = [...new Map(points.map(p => [p.eventId, p])).values()].sort((a,b) => a.recordedAt - b.recordedAt);
  for (const p of unique) {
    if (p.recordedAt < threshold) continue;
    if (p.accuracy > Math.min(50, dispatch.radius / 2) || distanceMeters(next, p) + p.accuracy > dispatch.radius) { candidate = null; continue; }
    if (!candidate || candidate.tripId !== p.tripId || p.recordedAt - candidate.recordedAt > 120000) { candidate = p; continue; }
    if (p.recordedAt - candidate.recordedAt >= 15000) return { ...dispatch, stops: dispatch.stops.map(s => s.id === next.id ? { ...s, arrivedAt: p.recordedAt } : s) };
  }
  return dispatch;
}
export type FleetAlert = { id: string; deviceId: string; title: string; detail: string; at: number; kind: "arrival" | "battery" | "connection" | "movement" | "trip" };
export function fleetAlerts(devices: Device[], dispatches: Dispatch[], now = Date.now()): FleetAlert[] {
  const alerts: FleetAlert[] = [];
  for (const d of devices) {
    if (d.revokedAt || !d.pairedAt) continue;
    const p = d.latestPoint;
    if (p?.battery != null && p.battery <= 20 && now - p.recordedAt < 90000) alerts.push({ id: `battery-${d.id}`, deviceId: d.id, title: `${d.driverName}: low battery`, detail: `${p.battery}% at the latest GPS fix`, at: p.recordedAt, kind: "battery" });
    if (d.status === "stale") alerts.push({ id: `stale-${d.id}`, deviceId: d.id, title: `${d.driverName}: location delayed`, detail: "Last known location; connection or recording may have stopped.", at: p?.recordedAt ?? d.lastSeenAt ?? now, kind: "connection" });
    if (d.status === "stopped") alerts.push({ id: `stop-${d.id}-${d.lastEventAt}`, deviceId: d.id, title: `${d.driverName}: trip stopped`, detail: "The driver ended recording.", at: d.lastEventAt ?? now, kind: "trip" });
    for (const stop of dispatches.find(a => a.deviceId === d.id)?.stops ?? []) if (stop.arrivedAt) alerts.push({ id: `arrival-${d.id}-${stop.id}-${stop.arrivedAt}`, deviceId: d.id, title: `${d.driverName}: arrived at ${stop.name}`, detail: stop.deliveredAt ? "Delivery confirmed by dispatcher." : "GPS arrival detected. Confirm the delivery separately.", at: stop.arrivedAt, kind: "arrival" });
  }
  return alerts.sort((a,b) => b.at - a.at).slice(0,50);
}
