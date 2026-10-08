import { officeMutation } from "../../../../lib/office-api";
import { createOrder, changeOrder } from "../../../../lib/office-store";
export async function POST(request:Request){return officeMutation(request,createOrder,201);}
export async function PATCH(request:Request){return officeMutation(request,changeOrder);}
