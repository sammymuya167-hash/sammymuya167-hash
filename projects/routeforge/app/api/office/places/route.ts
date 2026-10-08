import { currentOwner } from "../../../../lib/api";
import { searchPlaces } from "../../../../lib/place-search";
import { trackingResponse, trackingFailure, TrackingError } from "../../../../lib/tracking";
export async function GET(request:Request){
  try{const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to search office locations.");return trackingResponse({places:await searchPlaces(owner,new URL(request.url).searchParams.get("q")??"")});}catch(error){return trackingFailure(error);}
}
