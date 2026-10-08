import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { verifyDriver } from "./driver.integration.mjs";
import { verifyOffice } from "./office.integration.mjs";

// Run the built production Worker against a disposable D1 database. Fixture
// identity headers emulate the trusted hosting gateway only inside this test.
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");
const serverRoot = path.resolve("dist/server");
function moduleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? moduleFiles(path.join(directory, entry.name))
      : /\.m?js$/.test(entry.name)
        ? [path.join(directory, entry.name)]
        : [],
  );
}
const main = path.join(serverRoot, "index.js");
const geocoderCalls=[];
const mf = new Miniflare({
  modules: [
    main,
    ...moduleFiles(serverRoot).filter((file) => file !== main),
  ].map((file) => ({ type: "ESModule", path: file })),
  modulesRoot: path.resolve("dist/server"),
  modulesRules: [{ type: "ESModule", include: ["**/*.js", "**/*.mjs"] }],
  compatibilityDate: "2026-05-15",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: ["DB"],
  outboundService: async request => {
    const url=new URL(request.url);
    if(url.origin!=="https://photon.komoot.io")return new Response("Unexpected outbound request",{status:503});
    geocoderCalls.push(url);
    if(url.searchParams.get("q")==="Unavailable fixture")return new Response("Fixture unavailable",{status:503});
    if(url.searchParams.get("q")==="Redirect fixture")return new Response(null,{status:302,headers:{Location:"https://foreign.test/private"}});
    return Response.json({features:[{geometry:{type:"Point",coordinates:[36.82,-1.28]},properties:{name:"Synthetic shop",city:"Fixture city",country:"Kenya"}}]});
  },
  assets: {
    directory: path.resolve("dist/client"),
    binding: "ASSETS",
    routerConfig: {
      has_user_worker: true,
      invoke_user_worker_ahead_of_assets: true,
    },
  },
  port: 0,
});
const scenario = {
  name: "Integration fixture",
  depot: { name: "Test depot", lat: -1.27, lng: 36.8 },
  deliveries: [
    {
      id: "test-1",
      name: "Synthetic stop",
      address: "Fixture area",
      lat: -1.275,
      lng: 36.805,
      weight: 5,
      serviceMinutes: 6,
      windowStart: 540,
      windowEnd: 1020,
      priority: "normal",
    },
  ],
  vehicles: [
    {
      id: "test-van",
      name: "Test van",
      driver: "Fixture driver",
      capacity: 30,
      costPerKm: 20,
      shiftStart: 540,
      shiftEnd: 1080,
      active: true,
      color: "#5078ed",
    },
  ],
  speedKph: 28,
  roadFactor: 1.3,
};
let checked = 0;
async function request(
  endpoint,
  method = "GET",
  body,
  owner = "test-a",
  origin = "https://routeforge.test",
) {
  const headers = { Origin: origin };
  if (owner) {
    headers["oai-authenticated-user-id"] = owner;
    headers["oai-authenticated-user-email"] = `${owner}@example.test`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return mf.dispatchFetch(`https://routeforge.test${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
function passed(message) {
  checked++;
  console.log(`✓ ${message}`);
}
try {
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const sql of readFileSync("drizzle/" + file, "utf8").split(
      "--> statement-breakpoint",
    ))
      if (sql.trim()) await db.prepare(sql).run();
  }
  const home = await request("/");
  assert.equal(home.status, 200);
  const homeHtml=await home.text();
  assert.match(homeHtml, /Your office, in motion/);
  assert.doesNotMatch(homeHtml,/Make every mile count|17 deliveries|Bike 01/);
  passed("built Worker renders the real office shell without sample fleet data");
  assert.equal(
    (await request("/api/plans", "GET", undefined, null)).status,
    401,
  );
  passed("anonymous requests cannot read private plans");
  assert.equal(
    (await request("/api/optimize", "POST", scenario, null)).status,
    401,
  );
  passed("anonymous requests cannot optimize or store runs");
  assert.equal(
    (
      await request(
        "/api/plans",
        "POST",
        { scenario },
        "test-a",
        "https://other.test",
      )
    ).status,
    403,
  );
  passed("cross-origin writes are rejected");
  const created = await request("/api/plans", "POST", { scenario });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.ok(id);
  passed("a signed-in account saves a plan in D1");
  const other = await request("/api/plans", "GET", undefined, "test-b");
  const otherData = await other.json();
  assert.deepEqual(otherData.plans, []);
  assert.deepEqual(otherData.runs, []);
  passed("another account cannot see the saved plan");
  assert.equal(
    (
      await request(
        "/api/plans",
        "POST",
        { id, scenario: { ...scenario, name: "Unauthorized edit" } },
        "test-b",
      )
    ).status,
    404,
  );
  passed("another account cannot update a known plan ID");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: true }, "test-b"))
      .status,
    404,
  );
  passed("another account cannot archive a known plan ID");
  const mine = await request("/api/plans");
  assert.equal(mine.headers.get("cache-control"), "private, no-store");
  assert.equal((await mine.json()).plans[0].name, scenario.name);
  passed("owner can reload the unchanged plan with private cache headers");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: true })).status,
    200,
  );
  const archived = await (await request("/api/plans")).json();
  assert.ok(archived.plans[0].archivedAt);
  passed("archiving preserves the plan and sets its timestamp");
  assert.equal(
    (await request("/api/plans", "PATCH", { id, archived: false })).status,
    200,
  );
  const restored = await (await request("/api/plans")).json();
  assert.equal(restored.plans[0].archivedAt, null);
  passed("restore returns the same plan without data loss");
  const optimized = await request("/api/optimize", "POST", scenario);
  assert.equal(optimized.status, 200);
  const optimization = await optimized.json();
  assert.equal(optimization.result.assigned, 1);
  assert.equal(optimization.result.unassigned.length, 0);
  const history = await (await request("/api/plans")).json();
  assert.equal(history.runs.length, 1);
  assert.equal(history.runs[0].id, optimization.runId);
  passed("server optimization persists an immutable run snapshot");
  assert.equal((await request("/api/optimize", "POST", {})).status, 400);
  passed("invalid optimization inputs return a validation error");
  assert.equal((await request("/api/plans", "POST", null)).status, 400);
  passed("invalid plan payloads return a validation error");

  assert.equal(
    (await request("/api/tracking/devices", "GET", undefined, null)).status,
    401,
  );
  passed("anonymous visitors cannot list driver devices");
  const linked = await request("/api/tracking/devices", "POST", {
    driverName: "Synthetic driver",
    vehicleLabel: "Fixture van",
    phoneLabel: "+254700000000",
  });
  assert.equal(linked.status, 201);
  const invitation = await linked.json();
  assert.match(invitation.code, /^[A-F0-9]{5}(-[A-F0-9]{5}){3}$/);
  assert.equal(
    (
      await (
        await request("/api/tracking/devices", "GET", undefined, "test-b")
      ).json()
    ).devices.length,
    0,
  );
  passed(
    "device creation is private to its dispatcher and issues an expiring pairing code",
  );
  const pairResponse = await request(
    "/api/tracking/pair",
    "POST",
    { code: invitation.code, deviceName: "Fixture Android" },
    null,
  );
  assert.equal(pairResponse.status, 200);
  const paired = await pairResponse.json();
  assert.match(paired.token, /^[a-f0-9]{64}$/);
  assert.equal(
    (
      await request(
        "/api/tracking/pair",
        "POST",
        { code: invitation.code, deviceName: "Second phone" },
        null,
      )
    ).status,
    401,
  );
  passed("pairing issues a device-scoped token and consumes the code once");
  const privateList = await (await request("/api/tracking/devices")).json();
  assert.equal(privateList.devices[0].status, "ready");
  assert.ok(!JSON.stringify(privateList).includes(paired.token));
  assert.ok(!JSON.stringify(privateList).includes(invitation.code));
  const storedDevice = await db
    .prepare("SELECT * FROM tracking_devices WHERE id=?")
    .bind(invitation.id)
    .first();
  assert.notEqual(storedDevice.token_hash, paired.token);
  assert.equal(storedDevice.pair_code_hash, null);
  passed("device secrets are hashed and never returned to the dispatcher list");
  const t = Date.now(),
    tripId = crypto.randomUUID();
  const point = (time, lat = -1.28) => ({
    eventId: crypto.randomUUID(),
    tripId,
    kind: "point",
    recordedAt: time,
    lat,
    lng: 36.82,
    accuracy: 8,
    battery: 80,
  });
  async function ingest(events, token = paired.token) {
    return mf.dispatchFetch("https://routeforge.test/api/tracking/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ events }),
    });
  }
  assert.equal((await ingest([point(t)], "a".repeat(64))).status, 401);
  assert.equal((await ingest([{ ...point(t), lat: 91 }])).status, 422);
  assert.equal((await ingest([point(t + 600000)])).status, 422);
  passed(
    "unknown tokens, invalid GPS coordinates and future phone clocks are rejected",
  );
  const livePoint = point(t),
    start = {
      eventId: crypto.randomUUID(),
      tripId,
      kind: "start",
      recordedAt: t - 1000,
    };
  const firstUpload = await ingest([livePoint, start]);
  assert.equal(firstUpload.status, 200);
  assert.equal((await firstUpload.json()).acknowledged.length, 2);
  assert.equal((await ingest([livePoint, start])).status, 200);
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM tracking_events WHERE device_id=?")
        .bind(invitation.id)
        .first()
    ).n,
    2,
  );
  passed(
    "upload retries are idempotent and acknowledge durable events without duplicates",
  );
  const oldPoint = point(t - 3600000, -1.3);
  assert.equal((await ingest([oldPoint])).status, 200);
  const liveDevice = (await (await request("/api/tracking/devices")).json())
    .devices[0];
  assert.equal(liveDevice.latestPoint.eventId, livePoint.eventId);
  assert.equal(liveDevice.status, "live");
  passed(
    "offline backfill keeps original timestamps and cannot move the latest position backwards",
  );
  const replayAltered = { ...livePoint, recordedAt: t + 1000, lat: 0 };
  assert.equal((await ingest([replayAltered])).status, 200);
  assert.equal(
    (await (await request("/api/tracking/devices")).json()).devices[0]
      .latestPoint.lat,
    livePoint.lat,
  );
  passed(
    "replayed event IDs cannot rewrite the stored event or poison the live position",
  );
  const historyPath =
    "/api/tracking/history?deviceId=" + invitation.id + "&tripId=" + tripId;
  assert.equal(
    (await request(historyPath, "GET", undefined, "test-b")).status,
    404,
  );
  assert.equal(
    (await request(historyPath, "GET", undefined, null)).status,
    401,
  );
  const journeyResponse = await request(historyPath);
  assert.equal(
    journeyResponse.headers.get("cache-control"),
    "private, no-store",
  );
  const journey = await journeyResponse.json();
  assert.equal(journey.events.length, 3);
  assert.equal(journey.events[0].eventId, oldPoint.eventId);
  assert.equal(journey.events[0].recordedAt, oldPoint.recordedAt);
  assert.ok(journey.events[0].receivedAt > oldPoint.recordedAt);
  passed("GPS history is owner-only, uncached and ordered by capture time");
  const stop = {
    eventId: crypto.randomUUID(),
    tripId,
    kind: "stop",
    recordedAt: t,
  };
  assert.equal((await ingest([stop])).status, 200);
  assert.equal((await ingest([livePoint])).status, 200);
  assert.equal(
    (await (await request("/api/tracking/devices")).json()).devices[0].status,
    "stopped",
  );
  passed("retries at an equal timestamp cannot undo a stop event");

  const dispatchInput = {
    deviceId: invitation.id, name: "Synthetic delivery route", vehicleId: "fixture-van",
    vehicleName: "Fixture van", radius: 100,
    stops: [
      { id: "arrival-one", name: "Synthetic destination", address: "Fixture address", lat: -1.28, lng: 36.82 },
      { id: "arrival-two", name: "Second destination", address: "Fixture address", lat: -1.29, lng: 36.83 },
    ],
  };
  assert.equal((await request("/api/tracking/dispatch", "POST", dispatchInput, null)).status, 401);
  assert.equal((await request("/api/tracking/dispatch", "POST", dispatchInput, "test-b")).status, 404);
  assert.equal((await request("/api/tracking/dispatch", "POST", dispatchInput, "test-a", "https://other.test")).status, 403);
  assert.equal((await request("/api/tracking/dispatch", "POST", { ...dispatchInput, stops: [dispatchInput.stops[0], dispatchInput.stops[0]] })).status, 422);
  passed("dispatch rejects anonymous, cross-account, cross-origin and duplicate-stop requests");
  const dispatchResponse = await request("/api/tracking/dispatch", "POST", dispatchInput);
  assert.equal(dispatchResponse.status, 201);
  const assignment = await dispatchResponse.json();
  const ownFleetResponse = await request("/api/tracking/devices");
  assert.equal(ownFleetResponse.headers.get("cache-control"), "private, no-store");
  const ownFleet = await ownFleetResponse.json();
  assert.equal(ownFleet.dispatches[0].id, assignment.id);
  assert.equal(ownFleet.dispatches[0].stops[0].arrivedAt, null);
  const otherFleet = await (await request("/api/tracking/devices", "GET", undefined, "test-b")).json();
  assert.deepEqual(otherFleet.dispatches, []);
  assert.deepEqual(otherFleet.alerts, []);
  assert.equal((await request("/api/tracking/dispatch", "POST", dispatchInput)).status, 409);
  passed("assigned routes remain owner-private and cannot overwrite an active dispatch");
  const mutation = { deviceId: invitation.id, id: assignment.id, action: "deliver", stopId: "arrival-one" };
  assert.equal((await request("/api/tracking/dispatch", "PATCH", mutation)).status, 409);
  assert.equal((await request("/api/tracking/dispatch", "PATCH", mutation, "test-b")).status, 404);
  assert.equal((await ingest([point(assignment.assignedAt - 20000), point(assignment.assignedAt - 4000)])).status, 200);
  assert.equal((await (await request("/api/tracking/devices")).json()).dispatches[0].stops[0].arrivedAt, null);
  passed("pre-assignment backlog cannot cause arrival or permit delivery confirmation");
  const arrivalTrip = crypto.randomUUID();
  const arrivalFirst = { ...point(assignment.assignedAt + 1000), tripId: arrivalTrip, speed: 14, heading: 85, battery: 12 };
  const arrivalSecond = { ...arrivalFirst, eventId: crypto.randomUUID(), recordedAt: assignment.assignedAt + 17000 };
  assert.equal((await ingest([arrivalFirst])).status, 200);
  assert.equal((await (await request("/api/tracking/devices")).json()).dispatches[0].stops[0].arrivedAt, null);
  const secondUpload = await ingest([arrivalSecond]);
  assert.equal(secondUpload.status, 200);
  assert.deepEqual((await secondUpload.json()).acknowledged, [arrivalSecond.eventId]);
  assert.equal((await ingest([arrivalSecond])).status, 200);
  const arrivedFleet = await (await request("/api/tracking/devices")).json();
  assert.equal(arrivedFleet.dispatches[0].stops[0].arrivedAt, arrivalSecond.recordedAt);
  assert.equal(arrivedFleet.dispatches[0].stops[0].deliveredAt, null);
  assert.equal(arrivedFleet.dispatches[0].stops[1].arrivedAt, null);
  assert.equal(arrivedFleet.devices[0].latestPoint.speed, 14);
  assert.equal(arrivedFleet.devices[0].latestPoint.heading, 85);
  assert.equal(arrivedFleet.devices[0].latestPoint.battery, 12);
  assert.ok(arrivedFleet.alerts.some(a => a.kind === "arrival" && a.at === arrivalSecond.recordedAt));
  assert.ok(arrivedFleet.alerts.some(a => a.kind === "battery"));
  passed("unchanged phone upload protocol records telemetry and two-fix arrival with durable acknowledgements");
  assert.equal((await request("/api/tracking/dispatch", "PATCH", { ...mutation, stopId: "arrival-two" })).status, 409);
  assert.equal((await request("/api/tracking/dispatch", "PATCH", mutation)).status, 200);
  const delivered = (await (await request("/api/tracking/devices")).json()).dispatches[0];
  assert.ok(delivered.stops[0].deliveredAt);
  assert.equal(delivered.stops[1].deliveredAt, null);
  passed("dispatcher confirms only the arrived next stop while preserving later destinations");
  assert.equal((await request("/api/tracking/dispatch", "PATCH", { ...mutation, id: crypto.randomUUID(), action: "cancel" })).status, 409);
  assert.equal((await request("/api/tracking/dispatch", "PATCH", { ...mutation, action: "cancel" }, "test-b")).status, 404);
  assert.equal((await request("/api/tracking/dispatch", "PATCH", { ...mutation, action: "cancel" })).status, 200);
  assert.deepEqual((await (await request("/api/tracking/devices")).json()).dispatches, []);
  assert.equal((await request(historyPath)).status, 200);
  const replacementResponse = await request("/api/tracking/dispatch", "POST", dispatchInput);
  assert.equal(replacementResponse.status, 201);
  const replacement = await replacementResponse.json();
  assert.notEqual(replacement.id, assignment.id);
  assert.equal((await request("/api/tracking/dispatch", "PATCH", { ...mutation, action: "cancel" })).status, 409);
  assert.equal((await (await request("/api/tracking/devices")).json()).dispatches[0].id, replacement.id);
  passed("cancellation preserves GPS history and stale actions cannot change a replacement route");
  const olderInvite = await (
    await request("/api/tracking/devices", "POST", {
      driverName: "Expired fixture",
    })
  ).json();
  await db
    .prepare("UPDATE tracking_devices SET pair_expires_at=? WHERE id=?")
    .bind(t - 1, olderInvite.id)
    .run();
  assert.equal(
    (
      await request(
        "/api/tracking/pair",
        "POST",
        { code: olderInvite.code, deviceName: "Fixture" },
        null,
      )
    ).status,
    401,
  );
  passed("expired pairing codes cannot enroll a phone");
  const renewed = await request("/api/tracking/devices", "PATCH", {
    id: olderInvite.id,
    action: "renew",
  });
  assert.equal(renewed.status, 200);
  const renewal = await renewed.json();
  const race = await Promise.all([
    request(
      "/api/tracking/pair",
      "POST",
      { code: renewal.code, deviceName: "Phone A" },
      null,
    ),
    request(
      "/api/tracking/pair",
      "POST",
      { code: renewal.code, deviceName: "Phone B" },
      null,
    ),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 401]);
  passed("simultaneous pairing attempts can enroll only one phone");
  assert.equal(
    (
      await request(
        "/api/tracking/devices",
        "PATCH",
        { id: invitation.id, action: "revoke" },
        "test-b",
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/tracking/devices", "PATCH", {
        id: invitation.id,
        action: "remove",
      })
    ).status,
    409,
  );
  passed(
    "another dispatcher cannot unlink a known device and active history cannot be deleted",
  );
  assert.equal(
    (
      await request("/api/tracking/devices", "PATCH", {
        id: invitation.id,
        action: "revoke",
      })
    ).status,
    200,
  );
  assert.equal((await ingest([point(t + 1000)])).status, 401);
  assert.equal((await request(historyPath)).status, 200);
  passed(
    "unlinking rejects further device uploads and preserves the owner's history",
  );
  assert.equal(
    (
      await request("/api/tracking/devices", "PATCH", {
        id: invitation.id,
        action: "remove",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT COUNT(*) AS n FROM tracking_events WHERE device_id=?")
        .bind(invitation.id)
        .first()
    ).n,
    0,
  );
  assert.equal((await request(historyPath)).status, 404);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM driver_dispatches WHERE device_id=?").bind(invitation.id).first()).n, 0);
  passed("explicit removal of an unlinked device deletes its GPS history");
  const trackingPage = await request("/tracking");
  assert.equal(trackingPage.status, 200);
  const trackingHtml=await trackingPage.text();
  assert.match(trackingHtml, /Every journey, in view/);
  assert.match(trackingHtml, /href="\/" target="_top" class="tracking-back"/);
  passed("built Worker renders the live tracking portal");
  const download = await request("/downloads/routeforge-driver.apk");
  assert.equal(download.status, 200);
  const { createHash } = await import("node:crypto");
  assert.equal(createHash("sha256").update(new Uint8Array(await download.arrayBuffer())).digest("hex"), "8d9b3a0d84e7c32bbb1c10fba1c52fd052fac24d187b18b1b94223975aedbf29");
  passed("the Worker serves the exact verified Android installer");
  const riderDownload = await request("/downloads/routeforge-rider.apk", "GET", undefined, null);
  assert.equal(riderDownload.status, 200);
  assert.equal(createHash("sha256").update(new Uint8Array(await riderDownload.arrayBuffer())).digest("hex"), "552ea88f006d2d12d590e675b8fbdd96090d2e274750cce05575abcc5f738efd");
  const riderMetadata = await (await request("/downloads/routeforge-rider-release.json", "GET", undefined, null)).json();
  assert.equal(riderMetadata.applicationId, "app.shadownet.routeforge.rider");
  assert.equal(riderMetadata.apkSha256, "552ea88f006d2d12d590e675b8fbdd96090d2e274750cce05575abcc5f738efd");
  assert.equal(riderMetadata.certificateSha256, "e0c3213d4cbb6cc15c5792d8f7ffecaa6758b963d6998b9afc9511c6c45dc72c");
  passed("the built Worker publicly serves the signed Rider APK and matching release metadata while preserving the pilot");
  await verifyDriver({mf,db,request,passed});
  await verifyOffice({mf,db,request,passed,geocoderCalls});


  console.log(`${checked} Worker/D1 integration checks passed.`);
} finally {
  await mf.dispose();
}
