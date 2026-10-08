import { checkOrigin } from "../../../../lib/api";
import { driverIdentity,driverAction } from "../../../../lib/driver-store";
import { trackingPayload,trackingResponse,trackingFailure } from "../../../../lib/tracking";
export async function POST(request:Request){const origin=checkOrigin(request);if(origin)return origin;try{return trackingResponse(await driverAction(await driverIdentity(request),await trackingPayload(request)));}catch(e){return trackingFailure(e);}}
