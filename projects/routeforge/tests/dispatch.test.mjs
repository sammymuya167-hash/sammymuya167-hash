import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const output = path.resolve(".sites-runtime/dispatch-tests");
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [
  "node_modules/typescript/bin/tsc", "--outDir", output,
  "--module", "commonjs", "--moduleResolution", "node", "--target", "es2022",
  "--esModuleInterop", "--strict", "--skipLibCheck", "lib/dispatch.ts", "lib/map-view.ts",
], { stdio: "pipe" });
writeFileSync(path.join(output, "package.json"), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const { evaluateArrival, dispatchInput, motionOf, fleetAlerts } = require(path.join(output, "dispatch.js"));
const { projectLocation, panView, zoomView, fitView } = require(path.join(output, "map-view.js"));
const time = Date.now(), tripId = crypto.randomUUID(), deviceId = crypto.randomUUID();
const stop = { id: "stop-1", name: "Synthetic destination", address: "Fixture", lat: -1.28, lng: 36.82, arrivedAt: null, deliveredAt: null };
const dispatch = { id: crypto.randomUUID(), deviceId, name: "Fixture route", vehicleId: "van", vehicleName: "Fixture van", stops: [stop, { ...stop, id: "stop-2" }], radius: 100, assignedAt: time, updatedAt: time, revision: 1, checkedAt: 0 };
const fix = (offset, changes = {}) => ({ kind: "point", eventId: crypto.randomUUID(), tripId, recordedAt: time + offset, lat: stop.lat, lng: stop.lng, accuracy: 8, ...changes });
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-12, `${a} differs from ${b}`); }

test("wheel zoom preserves the geographic point under the cursor", () => {
  const before = { ...projectLocation(-1.31, 36.84), zoom: 14 }, anchor = { x: 237, y: -156 };
  const after = zoomView(before, 18, anchor);
  close(before.x + anchor.x / (256 * 2 ** before.zoom), after.x + anchor.x / (256 * 2 ** after.zoom));
  close(before.y + anchor.y / (256 * 2 ** before.zoom), after.y + anchor.y / (256 * 2 ** after.zoom));
  assert.equal(zoomView(before, 30).zoom, 19);
  assert.equal(zoomView(before, -5).zoom, 2);
});
test("dragging moves map content by the pointer displacement at close zoom", () => {
  const before = { ...projectLocation(-1.28, 36.82), zoom: 19 }, after = panView(before, 160, -80), world = 256 * 2 ** 19;
  close((before.x - after.x) * world, 160);
  close((before.y - after.y) * world, -80);
  assert.ok(Number.isFinite(projectLocation(90, 36).y));
});
test("fit journey contains distant fixes and destinations with padding", () => {
  const points = [projectLocation(-1.28, 36.82), projectLocation(-.8, 37.5), projectLocation(-2.0, 35.9)];
  const size = { w: 760, h: 440 }, view = fitView(points, size), world = 256 * 2 ** view.zoom;
  for (const p of points) {
    assert.ok(Math.abs(p.x - view.x) * world <= (size.w - 120) / 2);
    assert.ok(Math.abs(p.y - view.y) * world <= (size.h - 120) / 2);
  }
  assert.equal(fitView([points[0]], size).zoom, 17);
});
test("dispatch inputs reject duplicate stops, impossible coordinates and owner spoofing", () => {
  const input = { deviceId, name: "Route", vehicleId: "van", vehicleName: "Van", stops: [{ id: "one", name: "Stop", address: "Fixture", lat: -1, lng: 36 }] };
  assert.equal(dispatchInput.parse(input).radius, 100);
  assert.equal(dispatchInput.safeParse({ ...input, stops: [input.stops[0], input.stops[0]] }).success, false);
  assert.equal(dispatchInput.safeParse({ ...input, stops: [{ ...input.stops[0], lat: 91 }] }).success, false);
  assert.equal(dispatchInput.safeParse({ ...input, ownerId: "someone-else" }).success, false);
});
test("two precise fixes detect arrival without confirming delivery or advancing stops", () => {
  const first = fix(1000), second = fix(17000);
  assert.equal(evaluateArrival(dispatch, [first]).stops[0].arrivedAt, null);
  const result = evaluateArrival(dispatch, [first, second]);
  assert.equal(result.stops[0].arrivedAt, second.recordedAt);
  assert.equal(result.stops[0].deliveredAt, null);
  assert.equal(result.stops[1].arrivedAt, null);
  assert.equal(dispatch.stops[0].arrivedAt, null);
});
test("duplicate, pre-assignment and uncertain fixes cannot trigger arrival", () => {
  const first = fix(1000);
  for (const points of [
    [first, first], [fix(-20000), fix(-1000)], [first, fix(17000, { accuracy: 80 })],
    [fix(1000, { lat: stop.lat + .0008, accuracy: 20 }), fix(17000, { lat: stop.lat + .0008, accuracy: 20 })],
  ]) assert.equal(evaluateArrival(dispatch, points).stops[0].arrivedAt, null);
});
test("offline, out-of-order points use capture times; long gaps and different trips are separate", () => {
  const first = fix(1000), second = fix(17000);
  assert.equal(evaluateArrival(dispatch, [second, first]).stops[0].arrivedAt, second.recordedAt);
  assert.equal(evaluateArrival(dispatch, [first, fix(17000, { tripId: crypto.randomUUID() })]).stops[0].arrivedAt, null);
  assert.equal(evaluateArrival(dispatch, [first, fix(122000)]).stops[0].arrivedAt, null);
  assert.equal(evaluateArrival(dispatch, [first, fix(10000, { lat: -1.4 }), second]).stops[0].arrivedAt, null);
});
test("a later stop needs fresh GPS captured after the previous delivery confirmation", () => {
  const active = { ...dispatch, stops: [{ ...stop, arrivedAt: time + 17000, deliveredAt: time + 20000 }, dispatch.stops[1]] };
  assert.equal(evaluateArrival(active, [fix(1000), fix(17000)]).stops[1].arrivedAt, null);
  assert.equal(evaluateArrival(active, [fix(21000), fix(37000)]).stops[1].arrivedAt, time + 37000);
});
test("movement is an estimate and becomes unknown for stale, imprecise or missing speed", () => {
  assert.equal(motionOf(fix(0, { speed: .2 }), time), "stationary");
  assert.equal(motionOf(fix(0, { speed: 1.5 }), time), "walking");
  assert.equal(motionOf(fix(0, { speed: 3 }), time), "moving");
  assert.equal(motionOf(fix(0, { speed: 12 }), time), "vehicle");
  assert.equal(motionOf(fix(-91000, { speed: 12 }), time), "unknown");
  assert.equal(motionOf(fix(0, { speed: 12, accuracy: 80 }), time), "unknown");
  assert.equal(motionOf(fix(0), time), "unknown");
});
test("alerts report battery, capture-time arrival and delayed connection, excluding revoked devices", () => {
  const device = { id: deviceId, driverName: "Fixture driver", pairedAt: time - 1000, revokedAt: null, status: "stale", latestPoint: fix(0, { battery: 15 }), lastSeenAt: time };
  const arrived = { ...dispatch, stops: [{ ...stop, arrivedAt: time - 10000 }, dispatch.stops[1]] };
  const alerts = fleetAlerts([device], [arrived], time);
  assert.deepEqual(alerts.map(a => a.kind).sort(), ["arrival", "battery", "connection"]);
  assert.equal(alerts.find(a => a.kind === "arrival").at, time - 10000);
  assert.deepEqual(fleetAlerts([{ ...device, revokedAt: time }], [arrived], time), []);
});
