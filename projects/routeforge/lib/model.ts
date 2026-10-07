export type Point = { lat: number; lng: number };
export type Delivery = Point & {
  id: string;
  name: string;
  address: string;
  weight: number;
  serviceMinutes: number;
  windowStart: number;
  windowEnd: number;
  priority: "normal" | "high";
};
export type Vehicle = {
  id: string;
  name: string;
  driver: string;
  capacity: number;
  costPerKm: number;
  shiftStart: number;
  shiftEnd: number;
  active: boolean;
  color: string;
};
export type Scenario = {
  name: string;
  depot: Point & { name: string };
  deliveries: Delivery[];
  vehicles: Vehicle[];
  speedKph: number;
  roadFactor: number;
};
export type Visit = Delivery & {
  arrival: number;
  departure: number;
  wait: number;
  legKm: number;
};
export type Route = {
  vehicle: Vehicle;
  stops: Visit[];
  distanceKm: number;
  durationMinutes: number;
  finish: number;
  load: number;
  cost: number;
};
export type OptimizationResult = {
  routes: Route[];
  unassigned: { delivery: Delivery; reason: string }[];
  distanceKm: number;
  baselineKm: number;
  savingsPercent: number;
  cost: number;
  assigned: number;
  durationMinutes: number;
  algorithm: string;
};
export type SavedPlan = {
  id: string;
  name: string;
  scenario: Scenario;
  result: OptimizationResult;
  updatedAt: number;
  archivedAt: number | null;
};
export function clock(minutes: number) {
  const rounded = Math.ceil(minutes);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}
export function money(value: number) {
  return `KSh ${Math.round(value).toLocaleString("en-KE")}`;
}
