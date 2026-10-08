import { z } from "zod";

export const usernameInput=z.string().trim().min(3).max(32).regex(/^[A-Za-z][A-Za-z0-9._-]*$/,"Use 3–32 letters, numbers, dots, dashes or underscores, starting with a letter.");
export function normalizePhone(value:string){
  let phone=value.trim().replace(/[\s()-]/g,"");
  if(/^0[17]\d{8}$/.test(phone))phone="+254"+phone.slice(1);
  else if(/^254[17]\d{8}$/.test(phone))phone="+"+phone;
  return phone;
}
export const requiredPhone=z.string().transform(normalizePhone).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/,"Enter a phone number, such as 0712345678 or +254712345678."));
export const newDriverInput=z.object({driverName:z.string().trim().min(2).max(80),vehicleLabel:z.string().trim().max(80).default(""),phone:requiredPhone,username:usernameInput.optional(),deviceId:z.string().uuid().optional()}).strict();
export const loginInput=z.object({username:usernameInput,password:z.string().min(1).max(72),deviceName:z.string().trim().min(1).max(100).optional(),appVersion:z.number().int().min(4).max(10000).optional(),previousDeviceId:z.string().uuid().optional()}).strict();
