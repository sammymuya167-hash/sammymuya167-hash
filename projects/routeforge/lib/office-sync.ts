import { deliveryTenant } from "./network-actions";
import { eventForOrder } from "./network-store";
import { env } from "cloudflare:workers";
import type { Dispatch, GPSPoint } from "./dispatch";
import { gpsMileage, statusFromDispatch, type OfficeOrder } from "./office";

const db = () => env.DB as D1Database;
export async function syncOfficeDispatch(owner: string, dispatch: Dispatch) {
  if (!dispatch.orderId) return;
  const riderOwner=owner;owner=await deliveryTenant(dispatch.orderId,riderOwner,dispatch.id);
  const row = await db().prepare("SELECT payload_json,version FROM office_orders WHERE id=? AND owner_id=? AND dispatch_id=? AND status<>'cancelled'").bind(dispatch.orderId,owner,dispatch.id).first<{payload_json:string;version:number}>();
  if (!row) return;
  const current = JSON.parse(row.payload_json) as OfficeOrder;
  const device=await db().prepare("SELECT last_seen_at,last_event_kind FROM tracking_devices WHERE id=? AND owner_id=?").bind(dispatch.deviceId,riderOwner).first<{last_seen_at:number|null;last_event_kind:string|null}>();
  const checkedAt=device?.last_seen_at??0;
  const status = statusFromDispatch(dispatch);
  const progress = { status, pickedUpAt:dispatch.stops[0]?.deliveredAt ?? null, arrivedAt:dispatch.stops[1]?.arrivedAt ?? null, deliveredAt:dispatch.stops[1]?.deliveredAt ?? null,driverIssue:status!=="delivered"&&device?.last_event_kind==="stop"?"GPS trip stopped before delivery completion; rider or office confirmation required":status==="delivered"?null:current.driverIssue==="GPS trip stopped before delivery completion; rider or office confirmation required"&&device?.last_event_kind==="point"?null:current.driverIssue??null };
  if(current.distanceCheckedAt>=checkedAt&&Object.entries(progress).every(([key,value])=>current[key as keyof OfficeOrder]===value))return;
  const end = dispatch.stops[1]?.arrivedAt ?? dispatch.stops[1]?.deliveredAt ?? Date.now() + 300000;
  const rows = await db().prepare("SELECT payload_json FROM tracking_events WHERE device_id=? AND kind='point' AND recorded_at>=? AND recorded_at<=? ORDER BY recorded_at DESC LIMIT 5001").bind(dispatch.deviceId,dispatch.assignedAt,end).all<{payload_json:string}>();
  const metrics = gpsMileage(rows.results.slice(0,5000).map(r=>JSON.parse(r.payload_json) as GPSPoint));
  if (rows.results.length > 5000) metrics.excludedSegments++;
  const fields = { ...progress, ...metrics, distanceCheckedAt:checkedAt };
  if (Object.entries(fields).every(([key,value]) => current[key as keyof OfficeOrder] === value)) return;
  const now = Date.now(), next = {...current,...fields,version:row.version+1,updatedAt:now};
  await db().batch([
    db().prepare("UPDATE office_orders SET status=?,payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND dispatch_id=? AND version=? AND status<>'cancelled' AND EXISTS(SELECT 1 FROM driver_dispatches WHERE device_id=? AND owner_id=? AND dispatch_json=?)").bind(status,JSON.stringify(next),now,current.id,owner,dispatch.id,row.version,dispatch.deviceId,riderOwner,JSON.stringify(dispatch)),
    db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.lastReleasedAt',?),updated_at=? WHERE device_id=? AND owner_id=? AND ?='delivered' AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND dispatch_id=? AND status='delivered')").bind(next.deliveredAt??now,now,dispatch.deviceId,riderOwner,status,current.id,owner,dispatch.id),
  ]);
  await eventForOrder(current.id);
}
