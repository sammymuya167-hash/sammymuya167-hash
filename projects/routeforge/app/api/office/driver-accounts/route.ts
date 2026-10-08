import { currentOwner } from "../../../../lib/api";
import { createDriverAccount,listDriverAccounts,resetDriverPassword } from "../../../../lib/accounts";
import { officeMutation } from "../../../../lib/office-api";
import { TrackingError,trackingFailure,trackingResponse } from "../../../../lib/tracking";
export async function GET(){try{const owner=await currentOwner();if(!owner)throw new TrackingError(401,"Sign in to manage driver logins.");return trackingResponse(await listDriverAccounts(owner));}catch(e){return trackingFailure(e);}}
export async function POST(request:Request){return officeMutation(request,createDriverAccount,201);}
export async function PATCH(request:Request){return officeMutation(request,resetDriverPassword);}
