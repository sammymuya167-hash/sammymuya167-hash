import { officeMutation } from "../../../../lib/office-api";
import { updateSettings } from "../../../../lib/office-store";
export async function PATCH(request:Request){return officeMutation(request,updateSettings);}
