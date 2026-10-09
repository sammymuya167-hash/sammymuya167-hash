import { checkDeliveryOtp,deliveryTenant } from "./network-actions";
import { claimNetworkOffer,declineNetworkOffer,networkRiderData,tickNetwork } from "./network-dispatch";
import { eventForOrder } from "./network-store";
import { audit } from "./network-security";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { authenticateDevice, unlinkDevice } from "./tracking-store";
import { TrackingError } from "./tracking";
import type { Dispatch } from "./dispatch";
import { syncOfficeDispatch } from "./office-sync";
import { claimOffer, reconcileOffers } from "./offer-store";
import { deferOffice } from "./office-context";
import { amountMinor, type OfficeOrder, type Payment } from "./office";
const db=()=>env.DB as D1Database;
export type DriverIdentity={id:string;hash:string;owner:string};
export async function driverIdentity(request:Request):Promise<DriverIdentity>{
  return authenticateDevice(request);
}
export async function logoutRider(device:DriverIdentity){
  const rows=await db().batch([
    db().prepare("UPDATE tracking_devices SET token_hash=NULL WHERE id=? AND owner_id=? AND token_hash=? AND NOT EXISTS(SELECT 1 FROM driver_dispatches d,json_each(d.dispatch_json,'$.stops') s WHERE d.device_id=tracking_devices.id AND d.owner_id=tracking_devices.owner_id AND json_extract(s.value,'$.deliveredAt') IS NULL) RETURNING id").bind(device.id,device.owner,device.hash),
    db().prepare("UPDATE driver_runtime SET on_duty=0,gps_enabled=0,heartbeat_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash IS NULL)").bind(Date.now(),device.id,device.owner,device.id,device.owner),
    db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.onDuty',json('false')),updated_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash IS NULL)").bind(Date.now(),device.id,device.owner,device.id,device.owner),
    db().prepare("DELETE FROM rider_logins WHERE device_id=? AND token_hash=? AND EXISTS(SELECT 1 FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash IS NULL)").bind(device.id,device.hash,device.id,device.owner),
  ]);
  if(!rows[0].results.length)throw new TrackingError(409,"Finish the current delivery before signing out. Privacy pause is always available.");
  return {ok:true};
}
export async function driverState(device:DriverIdentity,payload:unknown){
  const parsed=z.object({appVersion:z.number().int().min(2).max(10000),onDuty:z.boolean(),gpsEnabled:z.boolean()}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Send the rider app's duty and location state.");
  const now=Date.now(),input=parsed.data;
  // One device-scoped database round trip. Do not reconcile every company route
  // or mileage record before the phone can receive its 30-second offer.
  const rows=await db().batch<Record<string,unknown>>([
    db().prepare("INSERT INTO driver_runtime(device_id,owner_id,app_version,on_duty,gps_enabled,heartbeat_at) SELECT id,?,?,?,?,? FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash=? AND revoked_at IS NULL ON CONFLICT(device_id) DO UPDATE SET app_version=excluded.app_version,on_duty=excluded.on_duty,gps_enabled=excluded.gps_enabled,heartbeat_at=excluded.heartbeat_at WHERE driver_runtime.heartbeat_at<? OR driver_runtime.on_duty<>excluded.on_duty OR driver_runtime.gps_enabled<>excluded.gps_enabled OR driver_runtime.app_version<>excluded.app_version").bind(device.owner,input.appVersion,Number(input.onDuty),Number(input.gpsEnabled),now,device.id,device.owner,device.hash,now-10000),
    db().prepare("SELECT driver_name,vehicle_label,phone_label FROM tracking_devices WHERE id=? AND owner_id=? AND token_hash=? AND revoked_at IS NULL").bind(device.id,device.owner,device.hash),
    db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(device.id,device.owner),
    db().prepare("SELECT o.payload_json FROM office_orders o JOIN driver_dispatches d ON o.dispatch_id=json_extract(d.dispatch_json,'$.id') WHERE o.owner_id=? AND o.device_id=? AND d.owner_id=? AND d.device_id=? LIMIT 1").bind(device.owner,device.id,device.owner,device.id),
    db().prepare("SELECT payload_json FROM office_orders WHERE owner_id=? AND device_id=? ORDER BY updated_at DESC LIMIT 10").bind(device.owner,device.id),
    db().prepare("SELECT payload_json FROM office_payments WHERE owner_id=? AND device_id=? ORDER BY updated_at DESC LIMIT 10").bind(device.owner,device.id),
    db().prepare("SELECT o.payload_json FROM office_orders o JOIN order_offers f ON f.order_id=o.id WHERE f.owner_id=? AND o.status='offered' AND f.expires_at>? AND EXISTS(SELECT 1 FROM json_each(f.eligible_json) WHERE value=?) ORDER BY f.expires_at LIMIT 5").bind(device.owner,now,device.id),
    db().prepare("SELECT COALESCE(SUM(CASE WHEN status<>'void' THEN amount_minor ELSE 0 END),0) AS reportedMinor,COALESCE(SUM(CASE WHEN status='verified' THEN amount_minor ELSE 0 END),0) AS verifiedMinor,COALESCE(SUM(CASE WHEN status<>'void' AND json_extract(payload_json,'$.method')='cash' THEN amount_minor ELSE 0 END),0) AS cashMinor,COALESCE(SUM(CASE WHEN status<>'void' AND json_extract(payload_json,'$.method')='till' THEN amount_minor ELSE 0 END),0) AS tillMinor FROM office_payments WHERE owner_id=? AND device_id=?").bind(device.owner,device.id),
    db().prepare("SELECT vehicle_type FROM network_riders WHERE device_id=? AND owner_id=?").bind(device.id,device.owner),
  ]);
  const deviceRow=rows[1].results[0] as {driver_name:string;vehicle_label:string;phone_label:string}|undefined;
  if(!deviceRow)throw new TrackingError(401,"This device link is no longer active.");
  const fromJson=<T>(index:number,key="payload_json"):T[]=>rows[index].results.map(r=>JSON.parse(r[key] as string) as T);
  const assignment=fromJson<Dispatch>(2,"dispatch_json")[0]??null,pending=assignment?.stops.some(s=>!s.deliveredAt);
  // The durable deadline also has an office wakeup. This retry runs after the
  // snapshot, so fallback work cannot hold the rider's next update hostage.
  deferOffice(()=>reconcileOffers(device.owner));
  const network=await networkRiderData(device.owner,device.id),networkOrder=network.orders.find(n=>n.order.dispatchId===assignment?.id);
  const privateOrder=(o:OfficeOrder,contact=false)=>({...o,customer:contact&&pending&&o.dispatchId===assignment?.id&&o.status!=="delivered"&&o.status!=="cancelled"?o.customer??null:null});
  deferOffice(()=>tickNetwork());
  const legacyOrder=fromJson<OfficeOrder>(3)[0];
  return {routingProfile:rows[8].results[0]?.vehicle_type==="bicycle"?"cycling":"driving",network:network.orders,totals:rows[7].results[0],deviceId:device.id,driverName:deviceRow.driver_name,vehicleLabel:deviceRow.vehicle_label,phone:deviceRow.phone_label,assignment,order:networkOrder?{...networkOrder.order,customer:networkOrder.customer,requiresOtp:true}:legacyOrder?privateOrder(legacyOrder,true):null,recentOrders:[...new Map([...fromJson<OfficeOrder>(4),...network.orders.map(n=>n.order)].map(o=>[o.id,privateOrder(o)])).values()],payments:fromJson<Payment>(5),offers:pending||!input.onDuty||!input.gpsEnabled?[]:[...fromJson<OfficeOrder>(6).map(o=>privateOrder(o)),...network.offers],canStop:!pending,serverTime:Date.now()};
}
const actionInput=z.object({operationId:z.string().uuid(),action:z.enum(["start_duty","stop_duty","pause","accept","decline","collected","delivered","payment","unlink"]),orderId:z.string().uuid().optional(),dispatchId:z.string().uuid().optional(),stopId:z.string().trim().min(1).max(80).optional(),method:z.enum(["cash","till"]).optional(),amount:z.number().finite().min(0).max(10000000).refine(v=>Math.abs(v*100-Math.round(v*100))<0.000001).optional(),reference:z.string().trim().max(80).default(""),otp:z.string().regex(/^\d{6}$/).optional()}).strict();
export async function driverAction(device:DriverIdentity,payload:unknown){
  const parsed=actionInput.safeParse(payload);if(!parsed.success)throw new TrackingError(422,"Check the rider action and payment amount.");
  const input=parsed.data,{otp:receiptOtp,...receiptInput}=input;void receiptOtp;
  // OTPs authorize completion; they are never retained in durable replay receipts.
  const request=JSON.stringify(receiptInput),old=await db().prepare("SELECT request_json,response_json FROM driver_receipts WHERE device_id=? AND operation_id=? AND owner_id=?").bind(device.id,input.operationId,device.owner).first<{request_json:string;response_json:string}>();
  if(old){if(old.request_json!==request)throw new TrackingError(409,"This action ID was already used with different details.");return JSON.parse(old.response_json);}
  const now=Date.now();let result:unknown;
  if(input.action==="unlink"){await unlinkDevice(device.owner,device.id);result={ok:true,unlinked:true};}
  else if(["start_duty","stop_duty","pause"].includes(input.action)){
    const current=await db().prepare("SELECT dispatch_json FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(device.id,device.owner).first<{dispatch_json:string}>();
    const dispatch=current?JSON.parse(current.dispatch_json) as Dispatch:null;
    if(input.action==="stop_duty"&&dispatch?.stops.some(s=>!s.deliveredAt))throw new TrackingError(409,"Finish the current delivery before stopping duty. Emergency location withdrawal remains available.");
    const on=input.action==="start_duty";
    const dutyResult=await db().batch([
      db().prepare("UPDATE driver_runtime SET on_duty=?,gps_enabled=CASE WHEN ? IN ('pause','stop_duty') THEN 0 ELSE gps_enabled END,heartbeat_at=? WHERE device_id=? AND owner_id=? AND (?<>'stop_duty' OR NOT EXISTS(SELECT 1 FROM driver_dispatches d,json_each(d.dispatch_json,'$.stops') s WHERE d.device_id=driver_runtime.device_id AND d.owner_id=driver_runtime.owner_id AND json_extract(s.value,'$.deliveredAt') IS NULL)) RETURNING device_id").bind(Number(on),input.action,now,device.id,device.owner,input.action),
      db().prepare("UPDATE office_driver_profiles SET profile_json=json_set(profile_json,'$.onDuty',json(?)),updated_at=? WHERE device_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM driver_runtime r WHERE r.device_id=office_driver_profiles.device_id AND r.owner_id=office_driver_profiles.owner_id AND r.on_duty=? AND r.heartbeat_at=?)").bind(JSON.stringify(on),now,device.id,device.owner,Number(on),now),
      db().prepare("UPDATE office_orders SET payload_json=json_set(payload_json,'$.driverIssue',?,'$.updatedAt',?,'$.version',version+1),version=version+1,updated_at=? WHERE device_id=? AND (owner_id=? OR EXISTS(SELECT 1 FROM merchant_deliveries m WHERE m.order_id=office_orders.id AND m.merchant_id=office_orders.owner_id AND m.rider_owner=?)) AND status NOT IN ('delivered','cancelled')").bind(input.action==="pause"?"Rider stopped location sharing before completing delivery; office follow-up required":null,now,now,device.id,device.owner,device.owner),
    ]);if(!dutyResult[0].results.length)throw new TrackingError(409,"A delivery was assigned as duty changed. Refresh before ending duty.");result={ok:true,onDuty:on};
  }else if(input.action==="accept"){
    if(!input.orderId)throw new TrackingError(422,"Choose the offered order.");
    const isNetwork=await db().prepare("SELECT order_id FROM merchant_deliveries WHERE order_id=?").bind(input.orderId).first();
    const order=await (isNetwork?claimNetworkOffer(device.owner,device.id,input.orderId):claimOffer(device.owner,device.id,input.orderId));result={ok:true,order};
  }else if(input.action==="decline"){
    if(!input.orderId)throw new TrackingError(422,"Choose a delivery offer.");result=await declineNetworkOffer(device.id,input.orderId);
  }else if(input.action==="payment"){
    if(!input.orderId||input.amount==null||!input.method)throw new TrackingError(422,"Choose cash or company till and enter the amount actually received.");
    const row=await db().prepare("SELECT payload_json FROM office_orders WHERE id=? AND owner_id=? AND device_id=? AND status='delivered' AND NOT EXISTS(SELECT 1 FROM merchant_deliveries WHERE order_id=office_orders.id)").bind(input.orderId,device.owner,device.id).first<{payload_json:string}>();
    if(!row)throw new TrackingError(409,"Finish your assigned delivery before recording payment.");
    const order=JSON.parse(row.payload_json) as OfficeOrder,payment:Payment={orderId:order.id,deviceId:device.id,driverName:order.driverName??"Company rider",method:input.method,amountMinor:amountMinor(input.amount),reference:input.reference,reportedAt:now,status:"reported",verifiedAt:null,version:1};
    const added=await db().prepare("INSERT INTO office_payments(order_id,owner_id,device_id,status,amount_minor,payload_json,updated_at,version) VALUES(?,?,?,'reported',?,?,?,1) ON CONFLICT(order_id) DO NOTHING RETURNING order_id").bind(order.id,device.owner,device.id,payment.amountMinor,JSON.stringify(payment),now).first();
    if(!added){const existing=await db().prepare("SELECT payload_json FROM office_payments WHERE order_id=? AND owner_id=? AND device_id=?").bind(order.id,device.owner,device.id).first<{payload_json:string}>();const p=existing?JSON.parse(existing.payload_json) as Payment:null;if(!p||p.method!==payment.method||p.amountMinor!==payment.amountMinor||p.reference!==payment.reference||p.status==="void")throw new TrackingError(409,"Payment is already recorded. Ask the office to review it.");result={ok:true,payment:p};}else result={ok:true,payment};
  }else{
    const row=await db().prepare("SELECT dispatch_json,revision FROM driver_dispatches WHERE device_id=? AND owner_id=?").bind(device.id,device.owner).first<{dispatch_json:string;revision:number}>();
    if(!row)throw new TrackingError(404,"No assignment is active on this rider phone.");
    const dispatch=JSON.parse(row.dispatch_json) as Dispatch;
    if(input.dispatchId!==dispatch.id||input.orderId&&input.orderId!==dispatch.orderId)throw new TrackingError(409,"This assignment changed. Refresh your rider app.");
    const index=dispatch.stops.findIndex(s=>!s.deliveredAt),target=dispatch.orderId?(input.action==="collected"?0:dispatch.stops.length-1):dispatch.stops.findIndex(s=>s.id===input.stopId);
    if(target<0)throw new TrackingError(422,"Choose the stop from this assignment.");
    if(dispatch.stops[target]?.deliveredAt){result={ok:true,finished:input.action==="delivered"&&target===dispatch.stops.length-1};}
    else{
      if(index!==target)throw new TrackingError(409,input.action==="collected"?"Collection was already recorded.":"Confirm collection before finishing delivery.");
      const proof=dispatch.orderId&&input.action==="delivered"?await checkDeliveryOtp(dispatch.orderId,device.id,device.owner,input.otp):null;
      const next={...dispatch,stops:dispatch.stops.map((s,i)=>i===target?{...s,deliveredAt:now}:s),revision:row.revision+1,checkedAt:0,updatedAt:now};
      const updates=[db().prepare("UPDATE driver_dispatches SET dispatch_json=?,revision=revision+1,updated_at=? WHERE device_id=? AND owner_id=? AND revision=? AND dispatch_json=? RETURNING device_id").bind(JSON.stringify(next),now,device.id,device.owner,row.revision,row.dispatch_json)];
      if(proof)updates.push(db().prepare("UPDATE merchant_deliveries SET proof_json=? WHERE order_id=? AND rider_owner=? AND EXISTS(SELECT 1 FROM driver_dispatches WHERE device_id=? AND owner_id=? AND dispatch_json=?)").bind(proof,dispatch.orderId,device.owner,device.id,device.owner,JSON.stringify(next)));
      const changed=(await db().batch(updates))[0].results[0];
      if(!changed)throw new TrackingError(409,"The assignment changed while confirming. Refresh and retry.");
      await syncOfficeDispatch(device.owner,next);
      const orderOwner=dispatch.orderId?await deliveryTenant(dispatch.orderId,device.owner,dispatch.id):device.owner;
      if(dispatch.orderId)await db().prepare("UPDATE office_orders SET payload_json=json_set(payload_json,'$.completionSource','driver','$.driverIssue',null) WHERE id=? AND owner_id=? AND dispatch_id=?").bind(dispatch.orderId,orderOwner,dispatch.id).run();
      if(dispatch.orderId){await eventForOrder(dispatch.orderId);if(proof||orderOwner!==device.owner||await db().prepare('SELECT order_id FROM merchant_deliveries WHERE order_id=?').bind(dispatch.orderId).first())await audit(orderOwner,device.id,'delivery.'+input.action,dispatch.orderId);}
      result={ok:true,finished:input.action==="delivered"&&target===dispatch.stops.length-1};
    }
  }
  const response=JSON.stringify(result);
  await db().prepare("INSERT INTO driver_receipts(device_id,operation_id,owner_id,request_json,response_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(device_id,operation_id) DO NOTHING").bind(device.id,input.operationId,device.owner,request,response,now).run();
  return result;
}
export async function reviewPayment(owner:string,payload:unknown){
  const parsed=z.object({orderId:z.string().uuid(),version:z.number().int().positive(),status:z.enum(["verified","void"])}).strict().safeParse(payload);
  if(!parsed.success)throw new TrackingError(422,"Select the payment record to review.");
  const {orderId,version,status}=parsed.data,now=Date.now();
  const changed=await db().prepare("UPDATE office_payments SET status=?,payload_json=json_set(payload_json,'$.status',?,'$.verifiedAt',?,'$.version',version+1),version=version+1,updated_at=? WHERE order_id=? AND owner_id=? AND version=? AND status='reported' RETURNING order_id").bind(status,status,status==="verified"?now:null,now,orderId,owner,version).first();
  if(!changed)throw new TrackingError(409,"The payment was already reviewed or is not in your office.");return {ok:true};
}
