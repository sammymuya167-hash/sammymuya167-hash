import { env } from "cloudflare:workers";
import { TrackingError } from "./tracking";
import { listDevices } from "./tracking-store";
import { listDispatches } from "./dispatch-store";
import { assignOrder, type OrderRow } from "./assignment-store";
import { driverChoices, type DriverProfile, type OfficeOrder } from "./office";
import { deferOffice } from "./office-context";
const db=()=>env.DB as D1Database;
export async function offerOrder(owner:string,id:string,version:number){
  const row=await db().prepare("SELECT * FROM office_orders WHERE id=? AND owner_id=?").bind(id,owner).first<OrderRow>();
  if(!row)throw new TrackingError(404,"Order not found in your office.");
  const order=JSON.parse(row.payload_json) as OfficeOrder;
  if(order.status!=="queued"||row.version!==version)throw new TrackingError(409,"Refresh this queued request before offering it.");
  const [devices,dispatches,profiles]=await Promise.all([listDevices(owner),listDispatches(owner),db().prepare("SELECT profile_json FROM office_driver_profiles WHERE owner_id=?").bind(owner).all<{profile_json:string}>()]);
  const eligible=driverChoices(devices,profiles.results.map(p=>JSON.parse(p.profile_json) as DriverProfile),dispatches).filter(c=>c.available).map(c=>c.device.id);
  if(!eligible.length)throw new TrackingError(409,"No free on-duty driver with live GPS. The request remains queued.");
  const now=Date.now(),expiresAt=now+5000,next={...order,status:"offered" as const,offerDeadline:expiresAt,version:row.version+1,updatedAt:now};
  const result=await db().batch([
    db().prepare("UPDATE office_orders SET status='offered',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND status='queued' AND version=? RETURNING id").bind(JSON.stringify(next),now,id,owner,row.version),
    db().prepare("INSERT INTO order_offers(order_id,owner_id,expires_at,eligible_json) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status='offered' AND version=? AND json_extract(payload_json,'$.offerDeadline')=?) ON CONFLICT(order_id) DO NOTHING").bind(id,owner,expiresAt,JSON.stringify(eligible),id,owner,next.version,expiresAt),
  ]);
  if(!result[0].results.length)throw new TrackingError(409,"This order changed while offering it.");
  // Durable deadline in D1; waitUntil is a prompt best-effort wakeup. Polls retry.
  deferOffice(async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiresAt-Date.now()+10)));await reconcileOffers(owner);});
  return next;
}
export async function reconcileOffers(owner:string){
  const rows=await db().prepare("SELECT o.* FROM office_orders o JOIN order_offers f ON f.order_id=o.id WHERE o.owner_id=? AND o.status='offered' AND f.expires_at<=? ORDER BY f.expires_at LIMIT 20").bind(owner,Date.now()).all<OrderRow>();
  for(const row of rows.results){
    const order=JSON.parse(row.payload_json) as OfficeOrder;
    try{await assignOrder(owner,row,"auto","fallback");}
    catch(error){
      if(!(error instanceof TrackingError)||error.status!==409)throw error;
      const now=Date.now(),next={...order,status:"queued",offerDeadline:null,version:row.version+1,updatedAt:now};
      await db().batch([
        db().prepare("UPDATE office_orders SET status='queued',payload_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND status='offered' AND version=?").bind(JSON.stringify(next),now,order.id,owner,row.version),
        db().prepare("DELETE FROM order_offers WHERE order_id=? AND owner_id=? AND EXISTS(SELECT 1 FROM office_orders WHERE id=? AND owner_id=? AND status<>'offered')").bind(order.id,owner,order.id,owner),
      ]);
    }
  }
}
export async function claimOffer(owner:string,deviceId:string,orderId:string){
  const row=await db().prepare("SELECT * FROM office_orders WHERE id=? AND owner_id=?").bind(orderId,owner).first<OrderRow>();
  if(!row)throw new TrackingError(404,"Offer not found.");
  const current=JSON.parse(row.payload_json) as OfficeOrder;
  if(current.deviceId===deviceId&&current.status!=="queued"&&current.status!=="offered"&&current.status!=="cancelled")return current;
  return assignOrder(owner,row,deviceId,"claim");
}
