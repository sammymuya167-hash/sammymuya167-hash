import { networkActor } from "../../../lib/network-access";
import { currentOwner } from "../../../lib/api";
import { officeData } from "../../../lib/office-store";
import { trackingResponse, trackingFailure, TrackingError } from "../../../lib/tracking";
export async function GET(){
  try{const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to open your private office.");const a=await networkActor();const data=await officeData(owner);if(a.role==='dispatcher'){delete data.payments;delete data.sales;}return trackingResponse(data);}catch(error){return trackingFailure(error);}
}
