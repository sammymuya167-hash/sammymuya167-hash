import { z } from "zod";
const point = {
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
};
const identifier = z.string().trim().min(1).max(64);
export const deliverySchema = z
  .object({
    ...point,
    id: identifier,
    name: z.string().trim().min(1).max(100),
    address: z.string().trim().max(180),
    weight: z.number().finite().positive().max(100000),
    serviceMinutes: z.number().finite().min(0).max(180),
    windowStart: z.number().int().min(0).max(1439),
    windowEnd: z.number().int().min(1).max(1440),
    priority: z.enum(["normal", "high"]),
  })
  .refine((d) => d.windowEnd >= d.windowStart, {
    message: "Delivery window ends before it starts",
  });
export const vehicleSchema = z
  .object({
    id: identifier,
    name: z.string().trim().min(1).max(80),
    driver: z.string().trim().max(80),
    capacity: z.number().finite().positive().max(100000),
    costPerKm: z.number().finite().min(0).max(5000),
    shiftStart: z.number().int().min(0).max(1439),
    shiftEnd: z.number().int().min(1).max(1440),
    active: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })
  .refine((v) => v.shiftEnd > v.shiftStart, {
    message: "Vehicle shift ends before it starts",
  });
export const scenarioSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    depot: z.object({ ...point, name: z.string().trim().min(1).max(100) }),
    deliveries: z.array(deliverySchema).min(1).max(60),
    vehicles: z.array(vehicleSchema).min(1).max(8),
    speedKph: z.number().finite().min(5).max(100),
    roadFactor: z.number().finite().min(1).max(3),
  })
  .superRefine((s, ctx) => {
    for (const values of [s.deliveries, s.vehicles])
      if (new Set(values.map((v) => v.id)).size !== values.length)
        ctx.addIssue({
          code: "custom",
          message: "Every delivery and vehicle must have a unique ID",
        });
    if (!s.vehicles.some((v) => v.active))
      ctx.addIssue({ code: "custom", message: "Enable at least one vehicle" });
  });
