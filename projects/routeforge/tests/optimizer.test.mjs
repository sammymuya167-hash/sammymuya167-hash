import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const output = path.resolve(".sites-runtime/test-build");
mkdirSync(output, { recursive: true });
execFileSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    "--outDir",
    output,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "es2022",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck",
    "lib/optimizer.ts",
    "lib/model.ts",
    "lib/demo.ts",
    "lib/csv.ts",
    "lib/validation.ts",
  ],
  { stdio: "pipe" },
);
writeFileSync(path.join(output, "package.json"), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const { optimize, distance, evaluateRoute } = require(
  path.join(output, "optimizer.js"),
);
const { demoScenario } = require(path.join(output, "demo.js"));
const { importDeliveries, deliveriesCsv, routeCsv, csvCell } = require(
  path.join(output, "csv.js"),
);
const { scenarioSchema } = require(path.join(output, "validation.js"));
function clone() {
  return structuredClone(demoScenario);
}
function feasible(result, scenario) {
  const ids = [];
  for (const route of result.routes) {
    assert.ok(route.load <= route.vehicle.capacity + 1e-8);
    assert.ok(route.finish <= route.vehicle.shiftEnd + 1e-8);
    for (const stop of route.stops) {
      ids.push(stop.id);
      assert.ok(stop.arrival >= stop.windowStart);
      assert.ok(stop.arrival <= stop.windowEnd + 1e-8);
      assert.equal(stop.departure, stop.arrival + stop.serviceMinutes);
    }
    assert.ok(evaluateRoute(route.stops, route.vehicle, scenario));
  }
  ids.push(...result.unassigned.map((u) => u.delivery.id));
  assert.equal(new Set(ids).size, scenario.deliveries.length);
  assert.equal(ids.length, scenario.deliveries.length);
}
test("Nairobi sample assigns every stop exactly once and enforces every hard constraint", () => {
  const scenario = clone();
  const result = optimize(scenario);
  feasible(result, scenario);
  assert.equal(result.assigned, 16);
  assert.equal(result.unassigned.length, 0);
  assert.ok(result.distanceKm < result.baselineKm);
  assert.ok(result.cost > 0);
});
test("oversized deliveries are reported rather than overloaded onto a vehicle", () => {
  const scenario = clone();
  scenario.deliveries[0].weight = 10000;
  const result = optimize(scenario);
  feasible(result, scenario);
  assert.equal(result.unassigned.length, 1);
  assert.match(result.unassigned[0].reason, /capacity/);
});
test("expired arrival windows are rejected", () => {
  const scenario = clone();
  scenario.deliveries[0].windowEnd = 500;
  scenario.deliveries[0].windowStart = 400;
  const result = optimize(scenario);
  feasible(result, scenario);
  assert.ok(
    result.unassigned.some((u) => u.delivery.id === scenario.deliveries[0].id),
  );
});
test("return travel and service cannot exceed the vehicle shift", () => {
  const scenario = clone();
  scenario.vehicles.forEach((v) => (v.shiftEnd = v.shiftStart + 1));
  const result = optimize(scenario);
  feasible(result, scenario);
  assert.equal(result.assigned, 0);
  assert.equal(result.unassigned.length, 16);
});
test("early arrivals wait until the delivery window opens", () => {
  const scenario = clone();
  scenario.deliveries = [
    {
      ...scenario.deliveries[0],
      lat: scenario.depot.lat,
      lng: scenario.depot.lng,
      windowStart: 660,
    },
  ];
  const result = optimize(scenario);
  const stop = result.routes.flatMap((r) => r.stops)[0];
  assert.equal(stop.arrival, 660);
  assert.equal(stop.wait, 120);
});
test("disabled vehicles are excluded", () => {
  const scenario = clone();
  scenario.vehicles[0].active = false;
  const result = optimize(scenario);
  feasible(result, scenario);
  assert.ok(
    result.routes.every((r) => r.vehicle.id !== scenario.vehicles[0].id),
  );
});
test("optimization is deterministic and leaves input unchanged", () => {
  const scenario = clone();
  const before = JSON.stringify(scenario);
  assert.deepEqual(optimize(scenario), optimize(scenario));
  assert.equal(JSON.stringify(scenario), before);
});
test("geodesic distance handles coincident and antipodal points", () => {
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
  assert.ok(
    Number.isFinite(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })),
  );
});
test("CSV round-trip preserves quoted commas and names", () => {
  const scenario = clone();
  scenario.deliveries[0].name = 'Westlands, "Market"';
  assert.deepEqual(
    importDeliveries(deliveriesCsv(scenario.deliveries)),
    scenario.deliveries,
  );
});
test("malformed and duplicate CSV rows are rejected", () => {
  assert.throws(() => importDeliveries('id,name\n1,"unfinished'), /quote/);
  const scenario = clone();
  scenario.deliveries[1].id = scenario.deliveries[0].id;
  assert.throws(
    () => importDeliveries(deliveriesCsv(scenario.deliveries)),
    /duplicate/,
  );
});
test("CSV exports neutralize spreadsheet formulas in text fields", () => {
  assert.equal(csvCell('=HYPERLINK("evil")'), '\"\'=HYPERLINK(\"\"evil\"\")\"');
  assert.equal(csvCell(-1.2), '\"-1.2\"');
});
test("driver export lists unassigned deliveries explicitly", () => {
  const scenario = clone();
  scenario.deliveries[0].weight = 10000;
  const csv = routeCsv(optimize(scenario));
  assert.match(csv, /UNASSIGNED/);
  assert.match(csv, /Westlands Market/);
});
test("validation rejects duplicate IDs, impossible shifts, invalid coordinates and oversized plans", () => {
  const duplicate = clone();
  duplicate.deliveries[1].id = duplicate.deliveries[0].id;
  assert.equal(scenarioSchema.safeParse(duplicate).success, false);
  const disabled = clone();
  disabled.vehicles.forEach((v) => (v.active = false));
  assert.equal(scenarioSchema.safeParse(disabled).success, false);
  const bad = clone();
  bad.deliveries[0].lat = 95;
  assert.equal(scenarioSchema.safeParse(bad).success, false);
  const large = clone();
  large.deliveries = Array.from({ length: 61 }, (_, i) => ({
    ...large.deliveries[0],
    id: String(i),
  }));
  assert.equal(scenarioSchema.safeParse(large).success, false);
});
test("varied feasible instances preserve all hard constraints", () => {
  for (let i = 0; i < 25; i++) {
    const scenario = clone();
    scenario.speedKph = 10 + i;
    scenario.vehicles.forEach((v, j) => {
      v.capacity = 25 + i * 2 + j * 6;
      v.shiftEnd = 720 + i * 7;
    });
    feasible(optimize(scenario), scenario);
  }
});
