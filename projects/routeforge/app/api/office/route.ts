import { currentOwner } from "../../../lib/api";
import { officeData } from "../../../lib/office-store";
import { trackingResponse, trackingFailure, TrackingError } from "../../../lib/tracking";
export async function GET(){
  try{const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to open your private office.");return trackingResponse(await officeData(owner));}catch(error){return trackingFailure(error);}
}
