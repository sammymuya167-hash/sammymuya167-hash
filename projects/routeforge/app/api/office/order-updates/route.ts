import { env } from "cloudflare:workers";
import { currentOwner } from "../../../../lib/api";
import { deferOffice } from "../../../../lib/office-context";
import { reconcileOffers } from "../../../../lib/offer-store";
import { trackingResponse, trackingFailure, TrackingError } from "../../../../lib/tracking";
import type { OfficeOrder } from "../../../../lib/office";
export async function GET(){
  try{
    const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to view company offers.");
    const rows=await (env.DB as D1Database).prepare("SELECT payload_json FROM office_orders WHERE owner_id=? ORDER BY CASE WHEN status IN ('delivered','cancelled') THEN 1 ELSE 0 END,updated_at DESC LIMIT 500").bind(owner).all<{payload_json:string}>();
    deferOffice(()=>reconcileOffers(owner));
    return trackingResponse({orders:rows.results.map(r=>JSON.parse(r.payload_json) as OfficeOrder),serverTime:Date.now()});
  }catch(error){return trackingFailure(error);}
}
