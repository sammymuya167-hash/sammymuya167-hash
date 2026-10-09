import { z } from "zod";
import { requiredPhone } from "./account-input";
import type { Device } from "./tracking";
import { distanceMeters, type Dispatch, type GPSPoint } from "./dispatch";

export const placeInput = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(250),
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  source: z.enum(["photon", "partner", "manual", "office", "previous"]).default("manual"),
  partnerId: z.string().uuid().optional(),
}).strict();
export type Place = z.infer<typeof placeInput>;
export const phoneInput = z.string().trim().max(32).regex(/^[+\d ()-]*$/).default("");
export const partnerInput = z.object({
  name: z.string().trim().min(1).max(100),
  contact: z.string().trim().max(100).default(""),
  phone: phoneInput,
  location: placeInput,
}).strict();
export type Partner = z.infer<typeof partnerInput> & { id: string; active: boolean; createdAt: number };
export const driverProfileInput = z.object({
  deviceId: z.string().uuid(),
  vehicleLabel: z.string().trim().max(80),
  phone: phoneInput,
  onDuty: z.boolean(),
  ratePerKm: z.number().finite().min(0).max(10000).nullable(),
}).strict();
export type DriverProfile = z.infer<typeof driverProfileInput> & { lastAssignedAt: number | null; lastReleasedAt: number | null };
export type OfficeSettings = { name: string; location: Place | null };
export const settingsInput = z.object({ name: z.string().trim().min(1).max(80), location: placeInput.nullable() }).strict();
export const recipientInput = z.object({name:z.string().trim().min(1).max(100),phone:requiredPhone}).strict();
export const orderInput = z.object({
  id: z.string().uuid(), title: z.string().trim().min(1).max(100),
  pickup: placeInput, destination: placeInput,
  notes: z.string().trim().max(1000).default(""),
  customer: recipientInput.nullable().optional(),
  amountDue: z.number().finite().min(0).max(10000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001,"Use at most two decimal places.").nullable().default(null),
}).strict();
export type OrderStatus = "queued" | "offered" | "assigned" | "pickup_arrived" | "en_route" | "arrived" | "delivered" | "cancelled";
export const orderStatusLabels: Record<OrderStatus, string> = {
  queued: "Awaiting driver", offered: "Offered to riders", assigned: "Heading to pickup", pickup_arrived: "At pickup",
  en_route: "On delivery", arrived: "At destination", delivered: "Delivered", cancelled: "Cancelled",
};
export type OfficeOrder = z.infer<typeof orderInput> & {
  network?: boolean;
  status: OrderStatus; deviceId: string | null; dispatchId: string | null;
  driverName: string | null; vehicleLabel: string | null; createdAt: number;
  assignedAt: number | null; pickedUpAt: number | null; arrivedAt: number | null;
  deliveredAt: number | null; updatedAt: number; version: number;
  estimatedKm: number | null; measuredKm: number; excludedSegments: number;
  ratePerKm: number | null; distanceCheckedAt: number;
  offerDeadline?: number | null; offerStartedAt?: number; offerRiders?: number; completionSource?: "office"|"driver"; driverIssue?: string | null;
};
export type Payment = {orderId:string;deviceId:string;driverName:string;method:"cash"|"till";amountMinor:number;reference:string;reportedAt:number;status:"reported"|"verified"|"void";verifiedAt:number|null;version:number};
export type SalesSummary = {reportedMinor:number;verifiedMinor:number;cashMinor:number;tillMinor:number;expectedMinor:number;pendingReview:number;unpaidDelivered:number;delivered:number;todayMinor:number;measuredKm:number;estimatedDriverCostMinor:number};
export type OfficeData = { orders: OfficeOrder[]; partners: Partner[]; profiles: DriverProfile[]; settings: OfficeSettings; serverTime: number; payments?:Payment[];sales?:SalesSummary };
export function amountMinor(value:number){return Math.round(value*100);}
export function moneyExact(minor:number){return `KSh ${(minor/100).toLocaleString("en-KE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
export function salesSummary(orders:OfficeOrder[],payments:Payment[],now=Date.now()):SalesSummary{
  const active=payments.filter(p=>p.status!=="void"),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi"}).format(now);
  return {reportedMinor:active.reduce((s,p)=>s+p.amountMinor,0),verifiedMinor:active.filter(p=>p.status==="verified").reduce((s,p)=>s+p.amountMinor,0),cashMinor:active.filter(p=>p.method==="cash").reduce((s,p)=>s+p.amountMinor,0),tillMinor:active.filter(p=>p.method==="till").reduce((s,p)=>s+p.amountMinor,0),expectedMinor:orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+amountMinor(o.amountDue??0),0),pendingReview:active.filter(p=>p.status==="reported").length,unpaidDelivered:orders.filter(o=>o.status==="delivered"&&!active.some(p=>p.orderId===o.id)).length,delivered:orders.filter(o=>o.status==="delivered").length,todayMinor:active.filter(p=>new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Nairobi"}).format(p.reportedAt)===today).reduce((s,p)=>s+p.amountMinor,0),measuredKm:orders.reduce((s,o)=>s+o.measuredKm,0),estimatedDriverCostMinor:orders.reduce((s,o)=>s+amountMinor(o.measuredKm*(o.ratePerKm??0)),0)};
}
export function isOpenOrder(order: OfficeOrder) { return order.status !== "delivered" && order.status !== "cancelled"; }
export function phoneLink(phone: string) {
  const normalized = phone.replace(/[ ()-]/g, "");
  return /^\+?\d{7,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
export function driverChoices(devices: Device[], profiles: DriverProfile[], dispatches: Dispatch[], pickup?: Place | null) {
  return devices.filter(d => d.pairedAt && !d.revokedAt).map(device => {
    const profile = profiles.find(p => p.deviceId === device.id);
    const busy = dispatches.some(d => d.deviceId === device.id && d.stops.some(s => !s.deliveredAt));
    const reason = busy ? "On an active order" : profile?.onDuty === false || device.rider?.onDuty===false ? "Off duty" : device.rider?.gpsEnabled===false ? "Phone GPS is off" : device.rider && Date.now()-device.rider.heartbeatAt>90000 ? "Rider app disconnected" : device.status !== "live" ? "Waiting for live GPS" : "Available";
    return {
      device, profile, available: reason === "Available", reason,
      lastAssignedAt: Math.max(profile?.lastAssignedAt ?? 0, profile?.lastReleasedAt ?? 0),
      pickupMeters: pickup && device.latestPoint ? distanceMeters(pickup, device.latestPoint) : null,
    };
  }).sort((a,b) => Number(b.available) - Number(a.available) || a.lastAssignedAt - b.lastAssignedAt || (a.pickupMeters ?? Infinity) - (b.pickupMeters ?? Infinity) || a.device.id.localeCompare(b.device.id));
}
// Sampled GPS mileage is an estimate. Do not bill through gaps, trip boundaries,
// poor accuracy, impossible jumps or stationary GPS jitter.
export function gpsMileage(points: GPSPoint[]) {
  const sorted = [...new Map(points.map(p => [p.eventId,p])).values()].sort((a,b) => a.recordedAt-b.recordedAt);
  let meters = 0, excludedSegments = 0;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i-1], b = sorted[i], seconds = (b.recordedAt-a.recordedAt)/1000;
    const distance = distanceMeters(a,b);
    if (a.tripId !== b.tripId || seconds <= 0 || seconds > 120 || a.accuracy > 50 || b.accuracy > 50 || distance / seconds > 45) { excludedSegments++; continue; }
    if (distance >= Math.max(5,(a.accuracy+b.accuracy)/2)) meters += distance;
  }
  return { measuredKm: Math.round(meters)/1000, excludedSegments };
}
export function statusFromDispatch(dispatch: Dispatch): OrderStatus {
  const [pickup,destination] = dispatch.stops;
  if (destination?.deliveredAt) return "delivered";
  if (destination?.arrivedAt) return "arrived";
  if (pickup?.deliveredAt) return "en_route";
  if (pickup?.arrivedAt) return "pickup_arrived";
  return "assigned";
}
export function photonPlaces(payload: unknown): Place[] {
  const parsed = z.object({ features: z.array(z.object({
    geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number(),z.number()]) }),
    properties: z.record(z.unknown()),
  })) }).safeParse(payload);
  if (!parsed.success) return [];
  const result: Place[] = [];
  for (const feature of parsed.data.features.slice(0,8)) {
    const p = feature.properties;
    const parts = [...new Set([p.name,p.housenumber,p.street,p.district,p.city,p.county,p.state,p.country].filter(v => typeof v === "string" && v) as string[])];
    const address = parts.join(", ").slice(0,250);
    const place = placeInput.safeParse({ name: String(p.name ?? p.street ?? p.city ?? address).slice(0,100), address, lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1], source: "photon" });
    if (place.success) result.push(place.data);
  }
  return result;
}
