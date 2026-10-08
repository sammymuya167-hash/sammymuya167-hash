import { officeMutation } from "../../../../lib/office-api";
import { reviewPayment } from "../../../../lib/driver-store";
export async function PATCH(request:Request){return officeMutation(request,reviewPayment);}
