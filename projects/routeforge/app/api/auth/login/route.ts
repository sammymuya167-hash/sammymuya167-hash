import { loginOffice, OFFICE_COOKIE } from "../../../../lib/accounts";
import { checkOrigin } from "../../../../lib/api";
import { trackingPayload,trackingFailure,trackingResponse } from "../../../../lib/tracking";
export async function POST(request:Request){
  const origin=checkOrigin(request);if(origin)return origin;
  try{const login=await loginOffice(request,await trackingPayload(request));const response=trackingResponse({username:login.username,expiresAt:login.expiresAt});response.headers.set("Set-Cookie",`${OFFICE_COOKIE}=${login.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);return response;}catch(e){return trackingFailure(e);}
}
