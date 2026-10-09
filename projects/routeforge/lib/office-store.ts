import { env } from "cloudflare:workers";
import { z } from "zod";
import { TrackingError } from "./tracking";
import { changeDispatch, listDispatches } from "./dispatch-store";
import type { Dispatch } from "./dispatch";
import { driverProfileInput, orderInput, partnerInput, recipientInput, settingsInput, salesSummary, type Payment, type OfficeData, type OfficeOrder, type OfficeSettings, type DriverProfile, type Partner, type Place } from "./office";
import { syncOfficeDispatch } from "./office-sync";
import { assignOrder, type OrderRow } from "./assignment-store";
import { offerOrder, reconcileOffers } from "./offer-store";

const db = () => env.DB as D1Database;
const parse = <T>(row:{payload_json:string}) => JSON.parse(row.payload_json) as T;
export async function officeData(owner:string):Promise<OfficeData> {
  await reconcileOffers(owner);
  // A portal refresh also recovers a dispatch sync interrupted after durable GPS.
  const dispatches=await listDispatches(owner);
  await Promise.all(dispatches.map(d=>syncOfficeDispatch(owner,d)));
  const [orders,partners,profiles,settings]=await Promise.all([
    db().prepare("SELECT payload_json FROM office_orders WHERE owner_id=? ORDER BY CASE WHEN status IN ('delivered','cancelled') THEN 1 ELSE 0 END,updated_at DESC LIMIT 500").bind(owner).all<{payload_json:string}>(),
    db().prepare("SELECT payload_json FROM office_partners WHERE owner_id=? ORDER BY updated_at DESC LIMIT 250").bind(owner).all<{payload_json:string}>(),
    db().prepare("SELECT profile_json FROM office_driver_profiles WHERE owner_id=?").bind(owner).all<{profile_json:string}>(),
    db().prepare("SELECT payload_json FROM office_settings WHERE owner_id=?").bind(owner).first<{payload_json:string}>(),
  ]);
  const payments=await db().prepare("SELECT payload_json FROM office_payments WHERE owner_id=? ORDER BY updated_at DESC LIMIT 500").bind(owner).all<{payload_json:string}>();
  const orderList=orders.results.map(r=>parse<OfficeOrder>(r)),paymentList=payments.results.map(r=>parse<Payment>(r));
  const totals=await db().prepare("SELECT COALESCE(SUM(CASE WHEN status<>'void' THEN amount_minor ELSE 0 END),0) AS reportedMinor,COALESCE(SUM(CASE WHEN status='verified' THEN amount_minor ELSE 0 END),0) AS verifiedMinor,COALESCE(SUM(CASE WHEN status<>'void' AND json_extract(payload_json,'$.method')='cash' THEN amount_minor ELSE 0 END),0) AS cashMinor,COALESCE(SUM(CASE WHEN status<>'void' AND json_extract(payload_json,'$.method')='till' THEN amount_minor ELSE 0 END),0) AS tillMinor,COALESCE(SUM(CASE WHEN status='reported' THEN 1 ELSE 0 END),0) AS pendingReview FROM office_payments WHERE owner_id=?").bind(owner).first<Pick<ReturnType<typeof salesSummary>,"reportedMinor"|"verifiedMinor"|"cashMinor"|"tillMinor"|"pendingReview">>();
  const todayStart=Math.floor((Date.now()+10800000)/86400000)*86400000-10800000;
  const allOrders=await db().prepare("SELECT COALESCE(SUM(CASE WHEN o.status<>'cancelled' THEN ROUND(COALESCE(json_extract(o.payload_json,'$.amountDue'),0)*100) ELSE 0 END),0) AS expectedMinor,COALESCE(SUM(CASE WHEN o.status='delivered' THEN 1 ELSE 0 END),0) AS delivered,COALESCE(SUM(CASE WHEN o.status='delivered' AND NOT EXISTS(SELECT 1 FROM office_payments p WHERE p.order_id=o.id AND p.owner_id=o.owner_id AND p.status<>'void') THEN 1 ELSE 0 END),0) AS unpaidDelivered,COALESCE(SUM(json_extract(o.payload_json,'$.measuredKm')),0) AS measuredKm,COALESCE(SUM(ROUND(COALESCE(json_extract(o.payload_json,'$.measuredKm'),0)*COALESCE(json_extract(o.payload_json,'$.ratePerKm'),0)*100)),0) AS estimatedDriverCostMinor FROM office_orders o WHERE o.owner_id=?").bind(owner).first<Pick<ReturnType<typeof salesSummary>,"expectedMinor"|"delivered"|"unpaidDelivered"|"measuredKm"|"estimatedDriverCostMinor">>();
  const today=await db().prepare("SELECT COALESCE(SUM(amount_minor),0) AS todayMinor FROM office_payments WHERE owner_id=? AND status<>'void' AND json_extract(payload_json,'$.reportedAt')>=? AND json_extract(payload_json,'$.reportedAt')<?").bind(owner,todayStart,todayStart+86400000).first<{todayMinor:number}>();
  return {orders:orderList,partners:partners.results.map(r=>parse<Partner>(r)),profiles:profiles.results.map(r=>JSON.parse(r.profile_json) as DriverProfile),settings:settings?parse<OfficeSettings>(settings):{name:"SHADOWNET Office",location:null},payments:paymentList,sales:{...salesSummary(orderList,paymentList),...totals,...allOrders,...today},serverTime:Date.now()};
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
  if(existing){if(JSON.stringify(orderInput.parse(JSON.parse(existing.input_json)))!==JSON.stringify(input))throw new TrackingError(409,"This request was already saved with different details.");return parse<OfficeOrder>(existing);}
  const [pickup,destination]=await Promise.all([resolvePlace(owner,input.pickup),resolvePlace(owner,input.destination)]);
  const now=Date.now(),order:OfficeOrder={...input,pickup,destination,status:"queued",deviceId:null,dispatchId:null,driverName:null,vehicleLabel:null,createdAt:now,assignedAt:null,pickedUpAt:null,arrivedAt:null,deliveredAt:null,updatedAt:now,version:1,estimatedKm:null,measuredKm:0,excludedSegments:0,ratePerKm:null,distanceCheckedAt:0};
  const inserted=await db().prepare("INSERT INTO office_orders(id,owner_id,status,input_json,payload_json,version,updated_at) SELECT ?,?,'queued',?,?,1,? WHERE (SELECT COUNT(*) FROM office_orders WHERE owner_id=? AND status NOT IN ('cancelled','delivered')) < 300 ON CONFLICT(id) DO NOTHING RETURNING id").bind(order.id,owner,JSON.stringify(input),JSON.stringify(order),now,owner).first();
  if(!inserted){const retry=await db().prepare("SELECT payload_json,input_json FROM office_orders WHERE id=? AND owner_id=?").bind(order.id,owner).first<OrderRow>();if(retry&&JSON.stringify(orderInput.parse(JSON.parse(retry.input_json)))===JSON.stringify(input))return parse<OfficeOrder>(retry);throw new TrackingError(409,"Could not save this request. Check the active order limit or refresh.");}
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
export async function changeOrder(owner:string,payload:unknown,actor=owner){
  const parsed=z.object({id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(["assign","offer","confirm_pickup","confirm_delivery","cancel","update_customer"]),deviceId:z.union([z.literal("auto"),z.string().uuid()]).optional(),customer:recipientInput.nullable().optional()}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Choose the order and an available onboarded driver.");
  const {id,version,action,deviceId}=parsed.data;
  if(action==="update_customer"?parsed.data.customer===undefined:parsed.data.customer!==undefined)throw new TrackingError(422,"Send recipient details only when updating the recipient.");
  const row=await db().prepare("SELECT * FROM office_orders WHERE id=? AND owner_id=?").bind(id,owner).first<OrderRow>();
  if(!row)throw new TrackingError(404,"Order not found in your office.");
  if(action==="assign"&&row.version!==version)throw new TrackingError(409,"This order has updated. Refresh before continuing.");
  const current=parse<OfficeOrder>(row);
  if(await db().prepare("SELECT order_id FROM merchant_deliveries WHERE order_id=? AND merchant_id=?").bind(id,owner).first()){if(action==="cancel"){const {cancelNetworkDelivery}=await import("./network-actions");return cancelNetworkDelivery(owner,id,owner);}throw new TrackingError(409,"Use the merchant delivery desk and rider OTP flow for this request.");}
  if(action==="offer")return offerOrder(owner,id,version);
  if(action==="assign")return assignOrder(owner,row,deviceId??"auto");
  if(current.status==="delivered"||current.status==="cancelled")throw new TrackingError(409,"This order is already closed.");
  if(action==="update_customer"){
    const now=Date.now(),customer=JSON.stringify(parsed.data.customer),changed=await db().batch([
      db().prepare("UPDATE office_orders SET payload_json=json_set(payload_json,'$.customer',json(?),'$.version',version+1,'$.updatedAt',?),version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status NOT IN ('delivered','cancelled') RETURNING payload_json").bind(customer,now,now,id,owner,version),
      db().prepare("INSERT INTO network_audit(id,merchant_id,actor,action,subject_id,created_at) SELECT ?,?,?,'office.delivery.recipient_updated',?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND version=? AND updated_at=? AND json_extract(payload_json,'$.customer') IS json_extract(?,'$'))").bind(crypto.randomUUID(),owner,actor,id,now,id,owner,version+1,now,customer),
    ]);
    const row=changed[0].results[0] as {payload_json:string}|undefined;if(!row)throw new TrackingError(409,"This delivery changed. Refresh before updating its recipient.");return parse<OfficeOrder>(row);
  }
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
    if(updated)await syncOfficeDispatch(owner,JSON.parse(updated.dispatch_json));
    if(action==="confirm_delivery")await db().prepare("UPDATE office_orders SET payload_json=json_set(payload_json,'$.completionSource','office') WHERE id=? AND owner_id=? AND status='delivered'").bind(id,owner).run();
    return {ok:true};
  }
  if(action!=="cancel")throw new TrackingError(409,"Assign a driver before confirming progress.");
  const next={...current,status:"cancelled",version:row.version+1,updatedAt:Date.now()};
  const changed=await db().prepare("UPDATE office_orders SET status='cancelled',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status IN ('queued','offered') RETURNING id").bind(JSON.stringify(next),next.updatedAt,id,owner,row.version).first();
  if(!changed)throw new TrackingError(409,"The order changed at the same time. Refresh.");
  await db().prepare("DELETE FROM order_offers WHERE order_id=? AND owner_id=?").bind(id,owner).run();return {ok:true};
}
