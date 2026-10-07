import type { Delivery, OptimizationResult } from "./model";
import { clock } from "./model";
import { deliverySchema } from "./validation";
export const deliveryColumns = [
  "id",
  "name",
  "address",
  "lat",
  "lng",
  "weight",
  "serviceMinutes",
  "windowStart",
  "windowEnd",
  "priority",
];
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(text))
    text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function deliveriesCsv(deliveries: Delivery[]) {
  return [
    deliveryColumns.join(","),
    ...deliveries.map((d) =>
      deliveryColumns.map((key) => csvCell(d[key as keyof Delivery])).join(","),
    ),
  ].join("\r\n");
}
export function routeCsv(result: OptimizationResult) {
  return [
    [
      "vehicle",
      "driver",
      "sequence",
      "deliveryId",
      "name",
      "address",
      "latitude",
      "longitude",
      "arrival",
      "departure",
      "weightKg",
    ].join(","),
    ...result.routes.flatMap((route) =>
      route.stops.map((stop, index) =>
        [
          route.vehicle.name,
          route.vehicle.driver,
          index + 1,
          stop.id,
          stop.name,
          stop.address,
          stop.lat,
          stop.lng,
          clock(stop.arrival),
          clock(stop.departure),
          stop.weight,
        ]
          .map(csvCell)
          .join(","),
      ),
    ),
    ...result.unassigned.map(({ delivery, reason }) =>
      [
        "UNASSIGNED",
        "",
        "",
        delivery.id,
        delivery.name,
        reason,
        delivery.lat,
        delivery.lng,
        "",
        "",
        delivery.weight,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\r\n");
}
export function importDeliveries(text: string): Delivery[] {
  if (text.length > 120000)
    throw new Error("CSV is too large. Use up to 60 deliveries.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV has an unclosed quote.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim());
  if (!headers || !deliveryColumns.every((h) => headers.includes(h)))
    throw new Error(
      "Use the sample CSV columns. Times are minutes after midnight.",
    );
  if (rows.length < 1 || rows.length > 60)
    throw new Error("Import between 1 and 60 deliveries.");
  const result = rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`Row ${index + 2} has the wrong number of columns.`);
    const raw = Object.fromEntries(
      headers.map((h, i) => [h, values[i].trim()]),
    );
    const parsed = deliverySchema.safeParse({
      ...raw,
      lat: Number(raw.lat),
      lng: Number(raw.lng),
      weight: Number(raw.weight),
      serviceMinutes: Number(raw.serviceMinutes),
      windowStart: Number(raw.windowStart),
      windowEnd: Number(raw.windowEnd),
    });
    if (!parsed.success)
      throw new Error(`Row ${index + 2}: ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
  if (new Set(result.map((d) => d.id)).size !== result.length)
    throw new Error("CSV contains duplicate delivery IDs.");
  return result;
}
