import { guardLegacyDelivery } from "./network-actions";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { dispatchInput, evaluateArrival, type Dispatch, type GPSPoint } from "./dispatch";
import { TrackingError } from "./tracking";
import { syncOfficeDispatch } from "./office-sync";
type Row = { device_id: string; owner_id: string; dispatch_json: string; revision: number; updated_at: number };
const db = () => env.DB as D1Database;
export async function reconcileDispatch(deviceId: string) {
  const row = await db().prepare("SELECT * FROM driver_dispatches WHERE device_id=?").bind(deviceId).first<Row>();
  if (!row) return;
  const current = JSON.parse(row.dispatch_json) as Dispatch;
  if (current.stops.every(s => s.deliveredAt) || current.stops.find(s => !s.deliveredAt)?.arrivedAt) return;
  const device = await db().prepare("SELECT last_seen_at FROM tracking_devices WHERE id=? AND revoked_at IS NULL").bind(deviceId).first<{last_seen_at: number | null}>();
  if (!device?.last_seen_at || device.last_seen_at <= current.checkedAt) return;
  const after = Math.max(current.assignedAt, ...current.stops.map(s => s.deliveredAt ?? 0));
  const rows = await db().prepare("SELECT payload_json FROM (SELECT payload_json,recorded_at FROM tracking_events WHERE device_id=? AND kind='point' AND recorded_at>=? ORDER BY recorded_at DESC LIMIT 5000) ORDER BY recorded_at ASC").bind(deviceId, after).all<{payload_json:string}>();
  const next = evaluateArrival(current, rows.results.map(r => JSON.parse(r.payload_json) as GPSPoint));
  await db().prepare("UPDATE driver_dispatches SET dispatch_json=?,revision=revision+1,updated_at=? WHERE device_id=? AND revision=? AND dispatch_json=?").bind(JSON.stringify({...next, checkedAt:device.last_seen_at, updatedAt:Date.now(), revision:row.revision+1}),Date.now(),deviceId,row.revision,row.dispatch_json).run();
  const fresh=await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(deviceId,row.owner_id).first<{dispatch_json:string}>();
  if(fresh)await syncOfficeDispatch(row.owner_id,JSON.parse(fresh.dispatch_json));
}
export async function listDispatches(owner: string, reconcile = true) {
  const rows = await db().prepare("SELECT * FROM driver_dispatches WHERE owner_id=?").bind(owner).all<Row>();
  // Offer and rider reads need only the durable reservation. GPS reconciliation
  // already runs on ingest and office refresh; never put it in the claim path.
  if (!reconcile) return rows.results.map(r=>JSON.parse(r.dispatch_json) as Dispatch);
  // Retry processing after a transient failure without making a phone re-upload.
  await Promise.all(rows.results.map(r => reconcileDispatch(r.device_id)));
  const latest = await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE owner_id=?").bind(owner).all<{dispatch_json:string}>();
  return latest.results.map(r=>JSON.parse(r.dispatch_json) as Dispatch);
}
export async function createDispatch(owner: string, payload: unknown) {
  const parsed = dispatchInput.safeParse(payload);
  if(!parsed.success) throw new TrackingError(422,"Choose a linked driver, a route, and valid stops.");
  const input=parsed.data;
  const device=await db().prepare("SELECT id FROM tracking_devices WHERE id=? AND owner_id=? AND paired_at IS NOT NULL AND revoked_at IS NULL").bind(input.deviceId,owner).first();
  if(!device)throw new TrackingError(404,"Pair a driver in your account before dispatching.");
  const existing=await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(input.deviceId,owner).first<{dispatch_json:string}>();
  if(existing && (JSON.parse(existing.dispatch_json) as Dispatch).stops.some(s=>!s.deliveredAt)) throw new TrackingError(409,"This driver has an active dispatch. Finish or cancel it before assigning another.");
  const now=Date.now();
  const dispatch:Dispatch={id:crypto.randomUUID(),deviceId:input.deviceId,name:input.name,vehicleId:input.vehicleId,vehicleName:input.vehicleName,radius:input.radius,stops:input.stops.map(s=>({...s,arrivedAt:null,deliveredAt:null})),assignedAt:now,updatedAt:now,revision:1,checkedAt:0};
  if(existing) await db().prepare("DELETE FROM driver_dispatches WHERE device_id=? AND owner_id=? AND dispatch_json=?").bind(input.deviceId,owner,existing.dispatch_json).run();
  const changed=await db().prepare("INSERT INTO driver_dispatches(device_id,owner_id,dispatch_json,revision,updated_at) SELECT id,?,?,1,? FROM tracking_devices WHERE id=? AND owner_id=? AND revoked_at IS NULL ON CONFLICT(device_id) DO NOTHING RETURNING device_id").bind(owner,JSON.stringify(dispatch),now,input.deviceId,owner).first();
  if(!changed)throw new TrackingError(409,"A dispatch was assigned at the same time. Refresh the driver.");
  return dispatch;
}
export async function changeDispatch(owner:string,payload:unknown){
  const parsed=z.object({deviceId:z.string().uuid(),id:z.string().uuid(),action:z.enum(["deliver","cancel"]),stopId:z.string().max(64).optional()}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Choose a dispatch action.");
  const {deviceId,id,action,stopId}=parsed.data;
  const row=await db().prepare("SELECT * FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(deviceId,owner).first<Row>();
  if(!row)throw new TrackingError(404,"Dispatch not found.");
  const current=JSON.parse(row.dispatch_json) as Dispatch;
  if(current.id!==id)throw new TrackingError(409,"This dispatch has changed. Refresh before continuing.");
  const network=await guardLegacyDelivery(owner,current,action);if(network)return network;
  if(action==="cancel"){
    const now=Date.now();
    const result=await db().batch([
      db().prepare("DELETE FROM driver_dispatches WHERE device_id=? AND owner_id=? AND revision=? AND dispatch_json=? RETURNING device_id").bind(deviceId,owner,row.revision,row.dispatch_json),
      db().prepare("UPDATE office_orders SET status='cancelled',payload_json=json_set(payload_json,'$.status','cancelled','$.updatedAt',?,'$.version',version+1),version=version+1,updated_at=? WHERE dispatch_id=? AND owner_id=? AND status NOT IN ('delivered','cancelled') AND NOT EXISTS(SELECT 1 FROM driver_dispatches WHERE device_id=? AND json_extract(dispatch_json,'$.id')=?)").bind(now,now,id,owner,deviceId,id),
      db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.lastReleasedAt',?),updated_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM office_orders WHERE dispatch_id=? AND owner_id=? AND status='cancelled')").bind(now,now,deviceId,owner,id,owner),
    ]);
    if(!result[0].results.length)throw new TrackingError(409,"The dispatch updated at the same time. Please retry.");
    return {ok:true};
  }
  const next=current.stops.find(s=>!s.deliveredAt);
  if(!next || next.id!==stopId || !next.arrivedAt)throw new TrackingError(409,"Confirm the next stop after GPS arrival is detected.");
  const now=Date.now();
  const updated={...current,stops:current.stops.map(s=>s.id===stopId?{...s,deliveredAt:now}:s),checkedAt:0,updatedAt:now,revision:row.revision+1};
  const changed=await db().prepare("UPDATE driver_dispatches SET dispatch_json=?,revision=revision+1,updated_at=? WHERE device_id=? AND owner_id=? AND revision=? AND dispatch_json=? RETURNING device_id").bind(JSON.stringify(updated),now,deviceId,owner,row.revision,row.dispatch_json).first();
  if(!changed)throw new TrackingError(409,"The driver updated at the same time. Please retry.");
  try { await syncOfficeDispatch(owner,updated); } catch { console.error("Office progress will retry on refresh"); }
  return {ok:true};
}
