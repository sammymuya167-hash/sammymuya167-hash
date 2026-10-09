import { officeIdentity } from "./accounts";
import { TrackingError } from "./tracking";
import { networkEnv,networkDb } from "./network-security";
import type { Merchant } from "./network-model";
export type Permission="read"|"dispatch"|"manage"|"owner"|"admin";
export async function networkActor(permission:Permission="read"){
  const a=await officeIdentity();if(!a)throw new TrackingError(401,"Sign in to your RouteForge dashboard.");
  if(a.merchantStatus==="suspended")throw new TrackingError(403,"This merchant is suspended.");
  if(permission==="admin"){if(a.role!=="owner"||a.owner!==networkEnv().ROUTEFORGE_PLATFORM_OWNER)throw new TrackingError(403,"Platform administrator access is required.");}
  else if(permission==="owner"&&a.role!=="owner"||permission==="manage"&&!['owner','manager'].includes(a.role)||permission==="dispatch"&&!['owner','manager','dispatcher'].includes(a.role))throw new TrackingError(403,"Your staff role cannot perform this action.");
  return {...a,actor:a.accountId??a.owner,isAdmin:a.role==="owner"&&a.owner===networkEnv().ROUTEFORGE_PLATFORM_OWNER};
}
export async function activeMerchant(id:string){const m=await networkDb().prepare("SELECT * FROM merchants WHERE id=?").bind(id).first<Merchant>();if(!m)throw new TrackingError(404,"Complete your merchant profile first.");if(m.status!=="active")throw new TrackingError(403,"Merchant approval is required before deliveries can be dispatched.");return m;}
export async function legacyMutationPermission(request:Request){
  const path=new URL(request.url).pathname;
  const a=await networkActor(/\/(settings|drivers|devices|partners|payments|driver-accounts)$/.test(path)?"manage":"dispatch");
  if(a.merchantStatus==="pending"&&/\/(orders|order-updates|dispatch)$/.test(path))throw new TrackingError(403,"Merchant approval is required before delivery operations.");
}
