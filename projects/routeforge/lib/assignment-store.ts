import { env } from "cloudflare:workers";
import { TrackingError } from "./tracking";
import { listDevices } from "./tracking-store";
import { listDispatches } from "./dispatch-store";
import { distanceMeters, type Dispatch } from "./dispatch";
import { driverChoices, type OfficeOrder, type DriverProfile } from "./office";
const db=()=>env.DB as D1Database;
export type OrderRow={payload_json:string;input_json:string;version:number;dispatch_id:string|null};
const parse=<T>(row:{payload_json:string})=>JSON.parse(row.payload_json) as T;
export async function assignOrder(owner:string,row:OrderRow,deviceId:string,offerMode?:"claim"|"fallback"){
  const current=parse<OfficeOrder>(row);
  if(await db().prepare("SELECT order_id FROM merchant_deliveries WHERE order_id=?").bind(current.id).first())throw new TrackingError(409,"Use merchant dispatch for this delivery.");
  if(current.status!=="queued"&&current.status!=="offered")throw new TrackingError(409,"This order is already assigned or closed.");
  if(offerMode&&current.status!=="offered")throw new TrackingError(409,"This order has no active offer window.");
  const offer=current.status==="offered"?await db().prepare("SELECT expires_at,eligible_json FROM order_offers WHERE order_id=? AND owner_id=?").bind(current.id,owner).first<{expires_at:number;eligible_json:string}>():null;
  const gateTime=Date.now();
  if(current.status==="offered"&&(!offer||(!offerMode)||offerMode==="claim"&&offer.expires_at<=gateTime||offerMode==="fallback"&&offer.expires_at>gateTime))throw new TrackingError(409,"The offer window has changed. Refresh the request.");
  if(offerMode==="claim"&&!JSON.parse(offer!.eligible_json).includes(deviceId))throw new TrackingError(404,"This offer is not addressed to this driver.");
  const [devices,dispatches,profiles]=await Promise.all([listDevices(owner),listDispatches(owner,false),db().prepare("SELECT profile_json FROM office_driver_profiles WHERE owner_id=?").bind(owner).all<{profile_json:string}>()]);
  const choices=driverChoices(devices,profiles.results.map(r=>JSON.parse(r.profile_json)),dispatches,current.pickup);
  const candidates=deviceId==="auto"?choices.filter(c=>c.available):choices.filter(c=>c.device.id===deviceId&&c.available);
  if(offerMode==="fallback")for(let i=candidates.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  if(!candidates.length)throw new TrackingError(409,"No selected driver is free, on duty and sending live GPS. The order stays queued.");
  for(const choice of candidates){
    const {device,profile}=choice,now=Date.now(),id=crypto.randomUUID();
    if(offerMode==="claim"&&now>=offer!.expires_at)throw new TrackingError(409,"The 30-second offer has expired.");
    const dispatch:Dispatch={id,deviceId:device.id,orderId:current.id,name:current.title,vehicleId:device.id,vehicleName:device.vehicleLabel||"Linked driver vehicle",radius:100,assignedAt:now,updatedAt:now,revision:1,checkedAt:0,stops:[{...current.pickup,id:`pickup-${current.id}`,name:`Collect · ${current.pickup.name}`,arrivedAt:null,deliveredAt:null},{...current.destination,id:`delivery-${current.id}`,name:`Deliver · ${current.destination.name}`,arrivedAt:null,deliveredAt:null}]};
    const estimatedKm=(distanceMeters(current.pickup,current.destination)+(device.latestPoint?distanceMeters(device.latestPoint,current.pickup):0))/1000;
    const next:OfficeOrder={...current,status:"assigned",deviceId:device.id,dispatchId:id,driverName:device.driverName,vehicleLabel:device.vehicleLabel,assignedAt:now,estimatedKm:Math.round(estimatedKm*100)/100,ratePerKm:profile?.ratePerKm??null,offerDeadline:null,driverIssue:null,updatedAt:now,version:row.version+1};
    const defaultProfile:DriverProfile={deviceId:device.id,vehicleLabel:device.vehicleLabel,phone:device.phoneLabel,onDuty:true,ratePerKm:null,lastAssignedAt:now,lastReleasedAt:null};
    const result=await db().batch([
      db().prepare("DELETE FROM driver_dispatches WHERE device_id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM json_each(driver_dispatches.dispatch_json,'$.stops') WHERE json_extract(value,'$.deliveredAt') IS NULL) AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status=? AND version=?)").bind(device.id,owner,current.id,owner,current.status,row.version),
      db().prepare("INSERT INTO driver_dispatches(device_id,owner_id,dispatch_json,revision,updated_at) SELECT id,?,?,1,? FROM tracking_devices WHERE id=? AND owner_id=? AND paired_at IS NOT NULL AND revoked_at IS NULL AND last_event_kind='point' AND latest_point_at>? AND last_seen_at>? AND COALESCE((SELECT json_extract(profile_json,'$.onDuty') FROM office_driver_profiles WHERE device_id=?),1)=1 AND COALESCE((SELECT on_duty=1 AND gps_enabled=1 AND heartbeat_at>? FROM driver_runtime WHERE device_id=tracking_devices.id),1)=1 AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status=? AND version=?) AND (?<>'claim' OR EXISTS(SELECT 1 FROM order_offers WHERE order_id=? AND owner_id=? AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND EXISTS(SELECT 1 FROM json_each(eligible_json) WHERE value=?))) ON CONFLICT(device_id) DO NOTHING RETURNING device_id").bind(owner,JSON.stringify(dispatch),now,device.id,owner,now-90000,now-90000,device.id,now-90000,current.id,owner,current.status,row.version,offerMode??"direct",current.id,owner,device.id),
      db().prepare("UPDATE office_orders SET device_id=?,dispatch_id=?,status='assigned',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND status=? AND version=? AND EXISTS(SELECT 1 FROM driver_dispatches WHERE device_id=? AND owner_id=? AND json_extract(dispatch_json,'$.id')=?) RETURNING id").bind(device.id,id,JSON.stringify(next),now,current.id,owner,current.status,row.version,device.id,owner,id),
      db().prepare("INSERT INTO office_driver_profiles(device_id,owner_id,profile_json,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND dispatch_id=?) ON CONFLICT(device_id) DO UPDATE SET profile_json=json_set(office_driver_profiles.profile_json,'$.lastAssignedAt',?),updated_at=excluded.updated_at WHERE office_driver_profiles.owner_id=excluded.owner_id").bind(device.id,owner,JSON.stringify(defaultProfile),now,current.id,owner,id,now),
    ]);
    if(result[2].results.length){await db().prepare("DELETE FROM order_offers WHERE order_id=? AND owner_id=?").bind(current.id,owner).run();return next;}
    if(deviceId!=="auto")break;
  }
  throw new TrackingError(409,"The driver or order changed while dispatching. Refresh and try another available driver.");
}
