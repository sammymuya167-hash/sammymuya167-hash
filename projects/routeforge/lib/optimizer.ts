import type {
  Delivery,
  OptimizationResult,
  Point,
  Route,
  Scenario,
  Vehicle,
} from "./model";
export function distance(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function evaluateRoute(
  jobs: Delivery[],
  vehicle: Vehicle,
  scenario: Scenario,
): Route | null {
  const load = jobs.reduce((sum, j) => sum + j.weight, 0);
  if (load > vehicle.capacity + 1e-8) return null;
  let current: Point = scenario.depot,
    time = vehicle.shiftStart,
    km = 0;
  const stops = [];
  for (const job of jobs) {
    const legKm = distance(current, job) * scenario.roadFactor;
    const reached = time + (legKm / scenario.speedKph) * 60;
    const arrival = Math.max(reached, job.windowStart);
    if (arrival > job.windowEnd + 1e-8) return null;
    const departure = arrival + job.serviceMinutes;
    stops.push({ ...job, arrival, departure, wait: arrival - reached, legKm });
    km += legKm;
    time = departure;
    current = job;
  }
  const returnKm = jobs.length
    ? distance(current, scenario.depot) * scenario.roadFactor
    : 0;
  const finish = time + (returnKm / scenario.speedKph) * 60;
  if (finish > vehicle.shiftEnd + 1e-8) return null;
  km += returnKm;
  return {
    vehicle,
    stops,
    distanceKm: km,
    durationMinutes: jobs.length ? finish - vehicle.shiftStart : 0,
    finish,
    load,
    cost: km * vehicle.costPerKm,
  };
}
function inputDistance(jobs: Delivery[], s: Scenario) {
  let km = 0,
    previous: Point = s.depot;
  for (const job of jobs) {
    km += distance(previous, job) * s.roadFactor;
    previous = job;
  }
  return km + (jobs.length ? distance(previous, s.depot) * s.roadFactor : 0);
}
export function optimize(s: Scenario): OptimizationResult {
  const routes: Route[] = s.vehicles
    .filter((v) => v.active)
    .map((v) => evaluateRoute([], v, s)!);
  const unassigned: OptimizationResult["unassigned"] = [];
  const ordered = [...s.deliveries].sort(
    (a, b) =>
      (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0) ||
      a.windowEnd - b.windowEnd ||
      b.weight - a.weight ||
      a.id.localeCompare(b.id),
  );
  for (const job of ordered) {
    let best: { index: number; route: Route; score: number } | null = null;
    routes.forEach((route, index) => {
      const jobs = route.stops.map((j) => j as Delivery);
      for (let position = 0; position <= jobs.length; position++) {
        const candidate = evaluateRoute(
          [...jobs.slice(0, position), job, ...jobs.slice(position)],
          route.vehicle,
          s,
        );
        if (!candidate) continue;
        const score =
          candidate.distanceKm -
          route.distanceKm +
          (candidate.durationMinutes - route.durationMinutes) * 0.015;
        if (!best || score < best.score - 1e-8)
          best = { index, route: candidate, score };
      }
    });
    const chosen = best as {
      index: number;
      route: Route;
      score: number;
    } | null;
    if (chosen) routes[chosen.index] = chosen.route;
    else
      unassigned.push({
        delivery: job,
        reason: !routes.some((r) => r.vehicle.capacity >= job.weight)
          ? "Load exceeds every active vehicle's capacity"
          : "No feasible capacity, delivery-window and shift combination",
      });
  }
  for (let index = 0; index < routes.length; index++) {
    let route = routes[index];
    for (let pass = 0; pass < 5; pass++) {
      let improved = false;
      const jobs = route.stops.map((j) => j as Delivery);
      for (let i = 0; i < jobs.length - 1; i++)
        for (let k = i + 1; k < jobs.length; k++) {
          const candidate = evaluateRoute(
            [
              ...jobs.slice(0, i),
              ...jobs.slice(i, k + 1).reverse(),
              ...jobs.slice(k + 1),
            ],
            route.vehicle,
            s,
          );
          if (candidate && candidate.distanceKm < route.distanceKm - 1e-8) {
            route = candidate;
            improved = true;
          }
        }
      if (!improved) break;
    }
    routes[index] = route;
  }
  const distanceKm = routes.reduce((sum, r) => sum + r.distanceKm, 0);
  const baselineKm = routes.reduce((sum, r) => {
    const ids = new Set(r.stops.map((j) => j.id));
    return (
      sum +
      inputDistance(
        s.deliveries.filter((j) => ids.has(j.id)),
        s,
      )
    );
  }, 0);
  return {
    routes,
    unassigned,
    distanceKm,
    baselineKm,
    savingsPercent: baselineKm
      ? ((baselineKm - distanceKm) / baselineKm) * 100
      : 0,
    cost: routes.reduce((sum, r) => sum + r.cost, 0),
    assigned: routes.reduce((sum, r) => sum + r.stops.length, 0),
    durationMinutes: Math.max(0, ...routes.map((r) => r.durationMinutes)),
    algorithm: "Feasible cheapest insertion + bounded 2-opt",
  };
}
