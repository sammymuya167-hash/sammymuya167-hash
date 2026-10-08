import { logoutOffice,OFFICE_COOKIE } from "../../../../lib/accounts";
import { checkOrigin } from "../../../../lib/api";
import { trackingFailure,trackingResponse } from "../../../../lib/tracking";
export async function POST(request:Request){const origin=checkOrigin(request);if(origin)return origin;try{await logoutOffice(request);const response=trackingResponse({ok:true});response.headers.set("Set-Cookie",`${OFFICE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);return response;}catch(e){return trackingFailure(e);}}
