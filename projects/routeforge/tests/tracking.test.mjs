import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const output = path.resolve(".sites-runtime/tracking-tests");
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
    "lib/tracking.ts",
  ],
  { stdio: "pipe" },
);
writeFileSync(path.join(output, "package.json"), '{"type":"commonjs"}');
const require = createRequire(import.meta.url);
const {
  deviceStatus,
  normalizePairCode,
  validateBatch,
  sortEvents,
  randomSecret,
  hashSecret,
} = require(path.join(output, "tracking.js"));
const now = Date.now(),
  tripId = crypto.randomUUID();
const point = {
  eventId: crypto.randomUUID(),
  tripId,
  kind: "point",
  recordedAt: now,
  lat: -1.28,
  lng: 36.82,
  accuracy: 9,
};
const device = {
  id: crypto.randomUUID(),
  driverName: "Fixture",
  vehicleLabel: "",
  phoneLabel: "",
  deviceName: "Android",
  createdAt: now - 5000,
  pairedAt: now - 3000,
  pairExpiresAt: null,
  revokedAt: null,
  lastSeenAt: now,
  lastEventAt: now,
  lastEventKind: "point",
  latestPoint: { ...point, receivedAt: now },
};
test("a freshly contacted phone with an old fix is stale", () => {
  assert.equal(
    deviceStatus(
      {
        ...device,
        latestPoint: { ...point, recordedAt: now - 3600000, receivedAt: now },
      },
      now,
    ),
    "stale",
  );
  assert.equal(deviceStatus(device, now), "live");
});
test("stop and revocation override a recent location", () => {
  assert.equal(
    deviceStatus({ ...device, lastEventKind: "stop" }, now),
    "stopped",
  );
  assert.equal(deviceStatus({ ...device, revokedAt: now }, now), "revoked");
});
test("pending pairing expires and a new trip waits for GPS", () => {
  assert.equal(
    deviceStatus({ ...device, pairedAt: null, pairExpiresAt: now - 1 }, now),
    "expired",
  );
  assert.equal(
    deviceStatus({ ...device, lastEventKind: "start" }, now),
    "ready",
  );
});
test("pairing normalization accepts separators without accepting arbitrary IDs", () => {
  assert.equal(
    normalizePairCode("abcde-12345-abcde-12345"),
    "ABCDE12345ABCDE12345",
  );
  assert.equal(normalizePairCode("+254700000000"), null);
  assert.equal(normalizePairCode("01234-56789-ABCDE-xxxxx"), null);
});
test("location validation rejects impossible values, duplicate IDs and oversized batches", () => {
  assert.throws(() => validateBatch({ events: [{ ...point, lat: 100 }] }, now));
  assert.throws(() => validateBatch({ events: [point, point] }, now));
  assert.throws(() =>
    validateBatch(
      {
        events: Array.from({ length: 51 }, () => ({
          ...point,
          eventId: crypto.randomUUID(),
        })),
      },
      now,
    ),
  );
  assert.throws(() =>
    validateBatch({ events: [{ ...point, recordedAt: now + 300001 }] }, now),
  );
});
test("delayed events retain capture times and stop follows a simultaneous point", () => {
  const start = {
    eventId: crypto.randomUUID(),
    tripId,
    kind: "start",
    recordedAt: now,
  };
  const stop = {
    eventId: crypto.randomUUID(),
    tripId,
    kind: "stop",
    recordedAt: now,
  };
  const input = [stop, point, start];
  assert.deepEqual(
    sortEvents(input).map((e) => e.kind),
    ["start", "point", "stop"],
  );
  assert.equal(input[0].kind, "stop");
  assert.equal(
    validateBatch(
      { events: [{ ...point, recordedAt: now - 7 * 86400000 }] },
      now,
    )[0].recordedAt,
    now - 7 * 86400000,
  );
});
test("device credentials have independent entropy and are hashed before storage", async () => {
  const a = randomSecret(),
    b = randomSecret();
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, b);
  const h = await hashSecret(a);
  assert.match(h, /^[a-f0-9]{64}$/);
  assert.notEqual(h, a);
  assert.equal(h, await hashSecret(a));
});
