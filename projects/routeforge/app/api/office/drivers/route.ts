import { officeMutation } from "../../../../lib/office-api";
import { updateProfile } from "../../../../lib/office-store";
export async function PATCH(request:Request){return officeMutation(request,updateProfile);}
