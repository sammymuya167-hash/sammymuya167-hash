import { checkOrigin, currentOwner } from "./api";
import { trackingPayload, trackingResponse, trackingFailure, TrackingError } from "./tracking";
import { legacyMutationPermission } from "./network-access";
export async function officeMutation(request:Request,action:(owner:string,payload:unknown,actor?:string)=>Promise<unknown>,status=200){
  const origin=checkOrigin(request);if(origin)return origin;
  try{const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to manage your office.");const access=await legacyMutationPermission(request);return trackingResponse(await action(owner,await trackingPayload(request),access.actor),status);}catch(error){return trackingFailure(error);}
}
