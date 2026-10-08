import { officeMutation } from "../../../../lib/office-api";
import { createPartner, updatePartner } from "../../../../lib/office-store";
export async function POST(request:Request){return officeMutation(request,createPartner,201);}
export async function PATCH(request:Request){return officeMutation(request,updatePartner);}
