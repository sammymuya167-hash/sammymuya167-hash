import { checkOrigin } from '../../../../lib/api';
import { registerMerchant } from '../../../../lib/network-store';
import { loginOffice,OFFICE_COOKIE } from '../../../../lib/accounts';
import { trackingPayload,trackingResponse } from '../../../../lib/tracking';
import { networkFailure } from '../../../../lib/network-api';
export async function POST(request:Request){const blocked=checkOrigin(request);if(blocked)return blocked;try{const body=await trackingPayload(request) as {username:string;password:string},merchant=await registerMerchant(request,body),login=await loginOffice(request,{username:body.username,password:body.password});const response=trackingResponse(merchant,201);response.headers.set('Set-Cookie',`${OFFICE_COOKIE}=${login.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);return response;}catch(e){return networkFailure(e);}}
