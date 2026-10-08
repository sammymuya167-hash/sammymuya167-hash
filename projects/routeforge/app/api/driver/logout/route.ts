import { checkOrigin } from "../../../../lib/api";
import { driverIdentity,logoutRider } from "../../../../lib/driver-store";
import { trackingFailure,trackingResponse } from "../../../../lib/tracking";
export async function POST(request:Request){const origin=checkOrigin(request);if(origin)return origin;try{return trackingResponse(await logoutRider(await driverIdentity(request)));}catch(e){return trackingFailure(e);}}
