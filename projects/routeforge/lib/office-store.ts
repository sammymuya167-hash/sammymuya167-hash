import { env } from "cloudflare:workers";
import { z } from "zod";
import { TrackingError } from "./tracking";
import { listDevices } from "./tracking-store";
import { changeDispatch, listDispatches } from "./dispatch-store";
import { distanceMeters, type Dispatch } from "./dispatch";
import { driverChoices, driverProfileInput, orderInput, partnerInput, settingsInput, type OfficeData, type OfficeOrder, type OfficeSettings, type DriverProfile, type Partner, type Place } from "./office";
import { syncOfficeDispatch } from "./office-sync";

const db = () => env.DB as D1Database;
type OrderRow = { payload_json:string;input_json:string;version:number;dispatch_id:string|null };
const parse = <T>(row:{payload_json:string}) => JSON.parse(row.payload_json) as T;
export async function officeData(owner:string):Promise<OfficeData> {
  // A portal refresh also recovers a dispatch sync interrupted after durable GPS.
  const dispatches=await listDispatches(owner);
  await Promise.all(dispatches.map(d=>syncOfficeDispatch(owner,d)));
  const [orders,partners,profiles,settings]=await Promise.all([
    db().prepare("SELECT payload_json FROM office_orders WHERE owner_id=? ORDER BY CASE WHEN status IN ('delivered','cancelled') THEN 1 ELSE 0 END,updated_at DESC LIMIT 500").bind(owner).all<{payload_json:string}>(),
    db().prepare("SELECT payload_json FROM office_partners WHERE owner_id=? ORDER BY updated_at DESC LIMIT 250").bind(owner).all<{payload_json:string}>(),
    db().prepare("SELECT profile_json FROM office_driver_profiles WHERE owner_id=?").bind(owner).all<{profile_json:string}>(),
    db().prepare("SELECT payload_json FROM office_settings WHERE owner_id=?").bind(owner).first<{payload_json:string}>(),
  ]);
  return {orders:orders.results.map(r=>parse<OfficeOrder>(r)),partners:partners.results.map(r=>parse<Partner>(r)),profiles:profiles.results.map(r=>JSON.parse(r.profile_json) as DriverProfile),settings:settings?parse<OfficeSettings>(settings):{name:"SHADOWNET Office",location:null},serverTime:Date.now()};
}
async function resolvePlace(owner:string,place:Place) {
  if(!place.partnerId)return place;
  const row=await db().prepare("SELECT payload_json FROM office_partners WHERE id=? AND owner_id=?").bind(place.partnerId,owner).first<{payload_json:string}>();
  const partner=row?parse<Partner>(row):null;
  if(!partner?.active)throw new TrackingError(404,"Choose an active partner registered in your office.");
  return {...partner.location,name:partner.name,source:"partner" as const,partnerId:partner.id};
}
export async function createOrder(owner:string,payload:unknown) {
  const parsed=orderInput.safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Add a title and select valid pickup and delivery locations.");
  const input=parsed.data,existing=await db().prepare("SELECT payload_json,input_json FROM office_orders WHERE id=? AND owner_id=?").bind(input.id,owner).first<OrderRow>();
  if(existing){if(existing.input_json!==JSON.stringify(input))throw new TrackingError(409,"This request was already saved with different details.");return parse<OfficeOrder>(existing);}
  const [pickup,destination]=await Promise.all([resolvePlace(owner,input.pickup),resolvePlace(owner,input.destination)]);
  const now=Date.now(),order:OfficeOrder={...input,pickup,destination,status:"queued",deviceId:null,dispatchId:null,driverName:null,vehicleLabel:null,createdAt:now,assignedAt:null,pickedUpAt:null,arrivedAt:null,deliveredAt:null,updatedAt:now,version:1,estimatedKm:null,measuredKm:0,excludedSegments:0,ratePerKm:null,distanceCheckedAt:0};
  const inserted=await db().prepare("INSERT INTO office_orders(id,owner_id,status,input_json,payload_json,version,updated_at) SELECT ?,?,'queued',?,?,1,? WHERE (SELECT COUNT(*) FROM office_orders WHERE owner_id=? AND status NOT IN ('cancelled','delivered')) < 300 ON CONFLICT(id) DO NOTHING RETURNING id").bind(order.id,owner,JSON.stringify(input),JSON.stringify(order),now,owner).first();
  if(!inserted){const retry=await db().prepare("SELECT payload_json,input_json FROM office_orders WHERE id=? AND owner_id=?").bind(order.id,owner).first<OrderRow>();if(retry&&retry.input_json===JSON.stringify(input))return parse<OfficeOrder>(retry);throw new TrackingError(409,"Could not save this request. Check the active order limit or refresh.");}
  return order;
}
export async function createPartner(owner:string,payload:unknown) {
  const parsed=partnerInput.safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Enter the partner name and select its location.");
  const partner:Partner={...parsed.data,id:crypto.randomUUID(),active:true,createdAt:Date.now()};
  const inserted=await db().prepare("INSERT INTO office_partners(id,owner_id,payload_json,updated_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM office_partners WHERE owner_id=?)<250 RETURNING id").bind(partner.id,owner,JSON.stringify(partner),Date.now(),owner).first();
  if(!inserted)throw new TrackingError(409,"This office has reached its 250-partner limit.");
  return partner;
}
export async function updatePartner(owner:string,payload:unknown){
  const parsed=z.object({id:z.string().uuid(),active:z.boolean()}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Choose a partner and availability.");
  const changed=await db().prepare("UPDATE office_partners SET payload_json=json_set(payload_json,'$.active',json(?)),updated_at=? WHERE id=? AND owner_id=? RETURNING id").bind(JSON.stringify(parsed.data.active),Date.now(),parsed.data.id,owner).first();
  if(!changed)throw new TrackingError(404,"Partner not found in this office.");return {ok:true};
}
export async function updateProfile(owner:string,payload:unknown){
  const parsed=driverProfileInput.safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Check the driver phone, vehicle, duty status and kilometre rate.");
  const input=parsed.data,old=await db().prepare("SELECT profile_json FROM office_driver_profiles WHERE device_id=? AND owner_id=?").bind(input.deviceId,owner).first<{profile_json:string}>();
  const previous=old?JSON.parse(old.profile_json) as DriverProfile:null;
  const profile:DriverProfile={...input,lastAssignedAt:previous?.lastAssignedAt??null,lastReleasedAt:previous?.lastReleasedAt??null};
  const changed=await db().prepare("INSERT INTO office_driver_profiles(device_id,owner_id,profile_json,updated_at) SELECT id,?,?,? FROM tracking_devices WHERE id=? AND owner_id=? AND paired_at IS NOT NULL AND revoked_at IS NULL ON CONFLICT(device_id) DO UPDATE SET profile_json=json_set(excluded.profile_json,'$.lastAssignedAt',json_extract(office_driver_profiles.profile_json,'$.lastAssignedAt'),'$.lastReleasedAt',json_extract(office_driver_profiles.profile_json,'$.lastReleasedAt')),updated_at=excluded.updated_at WHERE office_driver_profiles.owner_id=excluded.owner_id RETURNING device_id").bind(owner,JSON.stringify(profile),Date.now(),input.deviceId,owner).first();
  if(!changed)throw new TrackingError(404,"Choose an onboarded, paired driver from your office.");
  await db().prepare("UPDATE tracking_devices SET vehicle_label=?,phone_label=? WHERE id=? AND owner_id=? AND revoked_at IS NULL").bind(input.vehicleLabel,input.phone,input.deviceId,owner).run();return {ok:true};
}
export async function updateSettings(owner:string,payload:unknown){
  const parsed=settingsInput.safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Choose the office name and a valid map location.");
  await db().prepare("INSERT INTO office_settings(owner_id,payload_json,updated_at) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at").bind(owner,JSON.stringify(parsed.data),Date.now()).run();return {ok:true};
}
async function assignOrder(owner:string,row:OrderRow,deviceId:string){
  const current=parse<OfficeOrder>(row);
  if(current.status!=="queued")throw new TrackingError(409,"This order is already assigned or closed.");
  const [devices,dispatches,profiles]=await Promise.all([listDevices(owner),listDispatches(owner),db().prepare("SELECT profile_json FROM office_driver_profiles WHERE owner_id=?").bind(owner).all<{profile_json:string}>()]);
  const choices=driverChoices(devices,profiles.results.map(r=>JSON.parse(r.profile_json)),dispatches,current.pickup);
  const candidates=deviceId==="auto"?choices.filter(c=>c.available):choices.filter(c=>c.device.id===deviceId&&c.available);
  if(!candidates.length)throw new TrackingError(409,"No selected driver is free, on duty and sending live GPS. The order stays queued.");
  for(const choice of candidates){
    const {device,profile}=choice,now=Date.now(),id=crypto.randomUUID();
    const dispatch:Dispatch={id,deviceId:device.id,orderId:current.id,name:current.title,vehicleId:device.id,vehicleName:device.vehicleLabel||"Linked driver vehicle",radius:100,assignedAt:now,updatedAt:now,revision:1,checkedAt:0,stops:[{...current.pickup,id:`pickup-${current.id}`,name:`Collect · ${current.pickup.name}`,arrivedAt:null,deliveredAt:null},{...current.destination,id:`delivery-${current.id}`,name:`Deliver · ${current.destination.name}`,arrivedAt:null,deliveredAt:null}]};
    const estimatedKm=(distanceMeters(current.pickup,current.destination)+(device.latestPoint?distanceMeters(device.latestPoint,current.pickup):0))/1000;
    const next:OfficeOrder={...current,status:"assigned",deviceId:device.id,dispatchId:id,driverName:device.driverName,vehicleLabel:device.vehicleLabel,assignedAt:now,estimatedKm:Math.round(estimatedKm*100)/100,ratePerKm:profile?.ratePerKm??null,updatedAt:now,version:row.version+1};
    const defaultProfile:DriverProfile={deviceId:device.id,vehicleLabel:device.vehicleLabel,phone:device.phoneLabel,onDuty:true,ratePerKm:null,lastAssignedAt:now,lastReleasedAt:null};
    const result=await db().batch([
      db().prepare("DELETE FROM driver_dispatches WHERE device_id=? AND owner_id=? AND NOT EXISTS(SELECT 1 FROM json_each(driver_dispatches.dispatch_json,'$.stops') WHERE json_extract(value,'$.deliveredAt') IS NULL) AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status='queued' AND version=?)").bind(device.id,owner,current.id,owner,row.version),
      db().prepare("INSERT INTO driver_dispatches(device_id,owner_id,dispatch_json,revision,updated_at) SELECT id,?,?,1,? FROM tracking_devices WHERE id=? AND owner_id=? AND paired_at IS NOT NULL AND revoked_at IS NULL AND last_event_kind='point' AND latest_point_at>? AND last_seen_at>? AND COALESCE((SELECT json_extract(profile_json,'$.onDuty') FROM office_driver_profiles WHERE device_id=?),1)=1 AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status='queued' AND version=?) ON CONFLICT(device_id) DO NOTHING RETURNING device_id").bind(owner,JSON.stringify(dispatch),now,device.id,owner,now-90000,now-90000,device.id,current.id,owner,row.version),
      db().prepare("UPDATE office_orders SET device_id=?,dispatch_id=?,status='assigned',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND status='queued' AND version=? AND EXISTS(SELECT 1 FROM driver_dispatches WHERE device_id=? AND owner_id=? AND json_extract(dispatch_json,'$.id')=?) RETURNING id").bind(device.id,id,JSON.stringify(next),now,current.id,owner,row.version,device.id,owner,id),
      db().prepare("INSERT INTO office_driver_profiles(device_id,owner_id,profile_json,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND dispatch_id=?) ON CONFLICT(device_id) DO UPDATE SET profile_json=json_set(office_driver_profiles.profile_json,'$.lastAssignedAt',?),updated_at=excluded.updated_at WHERE office_driver_profiles.owner_id=excluded.owner_id").bind(device.id,owner,JSON.stringify(defaultProfile),now,current.id,owner,id,now),
    ]);
    if(result[2].results.length)return next;
    if(deviceId!=="auto")break;
  }
  throw new TrackingError(409,"The driver or order changed while dispatching. Refresh and try another available driver.");
}
export async function changeOrder(owner:string,payload:unknown){
  const parsed=z.object({id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(["assign","confirm_pickup","confirm_delivery","cancel"]),deviceId:z.union([z.literal("auto"),z.string().uuid()]).optional()}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Choose the order and an available onboarded driver.");
  const {id,version,action,deviceId}=parsed.data;
  const row=await db().prepare("SELECT * FROM office_orders WHERE id=? AND owner_id=?").bind(id,owner).first<OrderRow>();
  if(!row)throw new TrackingError(404,"Order not found in your office.");
  if(action==="assign"&&row.version!==version)throw new TrackingError(409,"This order has updated. Refresh before continuing.");
  const current=parse<OfficeOrder>(row);
  if(action==="assign")return assignOrder(owner,row,deviceId??"auto");
  if(current.status==="delivered"||current.status==="cancelled")throw new TrackingError(409,"This order is already closed.");
  if(current.dispatchId&&current.deviceId){
    const active=await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=? AND json_extract(dispatch_json,'$.id')=?").bind(current.deviceId,owner,current.dispatchId).first<{dispatch_json:string}>();
    if(!active)throw new TrackingError(409,"This assignment has changed. Refresh the office.");
    const dispatch=JSON.parse(active.dispatch_json) as Dispatch;
    if(action==="cancel"){
      await changeDispatch(owner,{id:dispatch.id,deviceId:dispatch.deviceId,action:"cancel"});
      return {ok:true};
    }
    const stop=dispatch.stops[action==="confirm_pickup"?0:1];
    await changeDispatch(owner,{id:dispatch.id,deviceId:dispatch.deviceId,action:"deliver",stopId:stop.id});
    const updated=await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(current.deviceId,owner).first<{dispatch_json:string}>();
    if(updated)await syncOfficeDispatch(owner,JSON.parse(updated.dispatch_json));return {ok:true};
  }
  if(action!=="cancel")throw new TrackingError(409,"Assign a driver before confirming progress.");
  const next={...current,status:"cancelled",version:row.version+1,updatedAt:Date.now()};
  const changed=await db().prepare("UPDATE office_orders SET status='cancelled',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status='queued' RETURNING id").bind(JSON.stringify(next),next.updatedAt,id,owner,row.version).first();
  if(!changed)throw new TrackingError(409,"The order changed at the same time. Refresh.");return {ok:true};
}
