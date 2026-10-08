import { loginRider } from "../../../../lib/accounts";
import { checkOrigin } from "../../../../lib/api";
import { trackingPayload,trackingFailure,trackingResponse } from "../../../../lib/tracking";
export async function POST(request:Request){const origin=checkOrigin(request);if(origin)return origin;try{return trackingResponse(await loginRider(request,await trackingPayload(request)));}catch(e){return trackingFailure(e);}}
