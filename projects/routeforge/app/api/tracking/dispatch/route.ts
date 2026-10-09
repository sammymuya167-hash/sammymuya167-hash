import { legacyMutationPermission } from "../../../../lib/network-access";
import { checkOrigin, currentOwner } from "../../../../lib/api";
import { trackingPayload, trackingResponse, trackingFailure, TrackingError } from "../../../../lib/tracking";
import { createDispatch, changeDispatch } from "../../../../lib/dispatch-store";
async function mutate(request:Request,change:boolean){
  const origin=checkOrigin(request);if(origin)return origin;
  try{
    const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to dispatch your drivers.");
    await legacyMutationPermission(request);
    const body=await trackingPayload(request);
    return trackingResponse(await (change?changeDispatch(owner,body):createDispatch(owner,body)),change?200:201);
  }catch(error){return trackingFailure(error);}
}
export async function POST(request:Request){return mutate(request,false);}
export async function PATCH(request:Request){return mutate(request,true);}
