import { z } from "zod";
import { placeInput } from "./office";
import { requiredPhone,usernameInput } from "./account-input";
import { distanceMeters } from "./dispatch";
export const registrationInput=z.object({name:z.string().trim().min(2).max(80),email:z.string().email().max(254),phone:requiredPhone,username:usernameInput,password:z.string().min(12).max(72)}).strict();
export const fleetInput=z.object({fleetMode:z.enum(["shared","owned","hybrid"]),fallbackEnabled:z.boolean(),acceptedPricingVersion:z.number().int().positive().nullable().optional(),pricingAcceptances:z.array(z.object({areaId:z.string().uuid(),version:z.number().int().positive()}).strict()).max(50).optional()}).strict();
export const branchInput=z.object({name:z.string().trim().min(2).max(80),location:placeInput}).strict();
export const areaInput=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(2).max(80),lat:z.number().min(-85).max(85),lng:z.number().min(-180).max(180),radiusKm:z.number().positive().max(200),baseMinor:z.number().int().min(0).max(10000000),perKmMinor:z.number().int().min(0).max(1000000),roadFactor:z.number().min(1).max(3).default(1.3),commissionBps:z.number().int().min(0).max(5000).default(1000),active:z.boolean().default(true)}).strict();
export type AreaConfig=z.infer<typeof areaInput>;
export type Area={id:string;name:string;config:AreaConfig;active:number;version:number};
export const deliveryInput=z.object({externalId:z.string().trim().min(1).max(100),branchId:z.string().uuid(),title:z.string().trim().min(1).max(100),destination:placeInput,customer:z.object({name:z.string().trim().min(1).max(80),phone:requiredPhone}).strict(),notes:z.string().trim().max(1000).default(""),weightKg:z.number().positive().max(1000),vehicleType:z.enum(["any","bicycle","motorcycle","car","van"]).default("any"),priority:z.enum(["normal","urgent"]).default("normal"),windowEnd:z.number().int().positive().nullable().default(null),ready:z.boolean().default(false),trackingToken:z.string().regex(/^[a-f0-9]{64}$/),deliveryOtp:z.string().regex(/^\d{6}$/)}).strict();
export type DeliveryInput=z.infer<typeof deliveryInput>;
export type Merchant={id:string;name:string;email:string;phone:string;status:string;fleet_mode:"shared"|"owned"|"hybrid";fallback_enabled:number;accepted_pricing_version:number|null;subscription:string};
export function quote(area:Area,pickup:{lat:number;lng:number},destination:{lat:number;lng:number}){
  if(!area.active||distanceMeters(area.config,pickup)>area.config.radiusKm*1000||distanceMeters(area.config,destination)>area.config.radiusKm*1000)throw new Error("OUTSIDE_SERVICE_AREA");
  const km=distanceMeters(pickup,destination)/1000*area.config.roadFactor;
  return {feeMinor:area.config.baseMinor+Math.ceil(km*area.config.perKmMinor),estimatedKm:Math.round(km*100)/100,currency:"KES",pricingVersion:area.version,areaId:area.id};
}
export function publicWebhookUrl(value:string){
  const u=new URL(value);const host=u.hostname.toLowerCase();
  if(u.protocol!=="https:"||u.port&&u.port!=="443"||u.username||u.password||host.length>253||!host.includes(".")||!/[a-z]/.test(host)||host.includes(":")||/^\d+\./.test(host)||/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal"))throw new Error("Use a public HTTPS callback without credentials or a custom port.");
  return u.href;
}
