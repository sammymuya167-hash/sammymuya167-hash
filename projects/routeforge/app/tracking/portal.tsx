"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Compass,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
  X,
} from "lucide-react";
import type { Device, TrackingEvent } from "../../lib/tracking";
import JourneyMap from "./map";
import { useFleet } from "./use-fleet";
import { DispatchProgress, DriverTelemetry, FleetAlerts } from "./operations";
import { motionOf, motionLabels } from "../../lib/dispatch";
import { useOffice } from "../office/use-office";
import { NewOrderForm, DriverDetails } from "../office/forms";
type Trip = {
  id: string;
  startedAt: number;
  lastAt: number;
  points: number;
  stoppedAt: number | null;
};
type Pair = { id: string; code: string; expiresAt: number };
type Event = TrackingEvent & { receivedAt: number };
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(data.error ?? "Could not load tracking.");
  return data;
}
function when(value: number | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "No update yet";
}
const labels = {
  pending: "Awaiting pairing",
  expired: "Code expired",
  ready: "Awaiting GPS",
  live: "Live",
  stale: "Location delayed",
  stopped: "Trip stopped",
  revoked: "Unlinked",
};
export default function TrackingPortal({
  signedIn,
  signInPath,
  userName,
}: {
  signedIn: boolean;
  signInPath: string;
  userName: string;
}) {
  const fleet = useFleet(signedIn);
  const office = useOffice(signedIn);
  const { devices, dispatches, loading, refreshed, refresh } = fleet;
  const [newOrderOpen,setNewOrderOpen] = useState(false),[detailsOpen,setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(""),
    [tripId, setTripId] = useState(""),
    [trips, setTrips] = useState<Trip[]>([]),
    [events, setEvents] = useState<Event[]>([]);
  const [pair, setPair] = useState<Pair | null>(null),
    [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [historyBusy, setHistoryBusy] = useState(false),
    [cursor, setCursor] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [name, setName] = useState(""),
    [vehicle, setVehicle] = useState(""),
    [phone, setPhone] = useState("");
  const historyGeneration = useRef(0),
    historyInFlight = useRef(false),
    loadedMore = useRef(false);
  const selectedDevice = devices.find((d) => d.id === selected) ?? null;
  const assignment = dispatches.find(a=>a.deviceId===selected);
  useEffect(() => {
    setSelected(current=>devices.some(d=>d.id===current)?current:devices[0]?.id??"");
  },[devices]);
  useEffect(() => {
    if (!signedIn || !selected) return;
    const controller = new AbortController();
    const generation = ++historyGeneration.current;
    let running = false;
    setEvents([]);
    setCursor(null);
    setTrips([]);
    loadedMore.current = false;
    const tick = async () => {
      if (running || document.hidden) return;
      running = true;
      setHistoryBusy(true);
      try {
        const query =
          "/api/tracking/history?deviceId=" + encodeURIComponent(selected);
        const [history, journeys] = await Promise.all([
          api<{ events: Event[]; nextCursor: string | null }>(
            query + (tripId ? "&tripId=" + encodeURIComponent(tripId) : ""),
            "GET",
            undefined,
            controller.signal,
          ),
          api<{ trips: Trip[] }>(
            query + "&mode=trips",
            "GET",
            undefined,
            controller.signal,
          ),
        ]);
        if (generation === historyGeneration.current) {
          setEvents((old) =>
            [
              ...new Map(
                [...old, ...history.events].map((e) => [e.eventId, e]),
              ).values(),
            ]
              .filter((e) => tripId || e.recordedAt >= Date.now() - 86400000)
              .sort(
                (a, b) =>
                  a.recordedAt - b.recordedAt ||
                  a.eventId.localeCompare(b.eventId),
              ),
          );
          if (!loadedMore.current) setCursor(history.nextCursor);
          setTrips(journeys.trips);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load journey.");
      } finally {
        running = false;
        if (generation === historyGeneration.current) setHistoryBusy(false);
      }
    };
    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 15000);
    return () => {
      if (historyGeneration.current === generation)
        historyGeneration.current = generation + 1;
      controller.abort();
      clearInterval(timer);
    };
  }, [selected, tripId, signedIn, historyRevision]);
  async function more() {
    if (!cursor || historyInFlight.current) return;
    const generation = historyGeneration.current;
    historyInFlight.current = true;
    loadedMore.current = true;
    setHistoryBusy(true);
    try {
      const r = await api<{ events: Event[]; nextCursor: string | null }>(
        "/api/tracking/history?deviceId=" +
          selected +
          (tripId ? "&tripId=" + tripId : "") +
          "&cursor=" +
          encodeURIComponent(cursor),
      );
      if (generation === historyGeneration.current) {
        setEvents((old) =>
          [
            ...new Map(
              [...old, ...r.events].map((e) => [e.eventId, e]),
            ).values(),
          ].sort(
            (a, b) =>
              a.recordedAt - b.recordedAt || a.eventId.localeCompare(b.eventId),
          ),
        );
        setCursor(r.nextCursor);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more history.");
    } finally {
      historyInFlight.current = false;
      setHistoryBusy(false);
    }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api<Pair>("/api/tracking/devices", "POST", {
        driverName: name,
        vehicleLabel: vehicle,
        phoneLabel: phone,
      });
      setPair(p);
      setAdding(false);
      setName("");
      setVehicle("");
      setPhone("");
      await refresh();
      setSelected(p.id);
      setTripId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add device.");
    } finally {
      setBusy(false);
    }
  }
  async function action(d: Device, action: "renew" | "revoke" | "remove") {
    if (
      action === "revoke" &&
      !window.confirm(
        "Unlink " +
          d.driverName +
          "? This phone will no longer be able to upload. Existing journey history remains.",
      )
    )
      return;
    if (
      action === "remove" &&
      !window.confirm(
        "Delete this device and all its uploaded GPS history permanently?",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await api<Pair>("/api/tracking/devices", "PATCH", {
        id: d.id,
        action,
      });
      if (action === "renew") setPair(r);
      if (action === "remove" && d.id === selected) {
        setEvents([]);
        setTrips([]);
        setTripId("");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change device.");
    } finally {
      setBusy(false);
    }
  }
  const points = events.filter(
    (e): e is Extract<Event, { kind: "point" }> => e.kind === "point",
  );
  const apk = "/downloads/routeforge-driver.apk";
  async function refreshOffice(){await Promise.all([refresh(),office.refresh()]);}
  return (
    <main className="tracking-shell">
      <header className="tracking-header">
        <Link href="/" className="brand tracking-brand">
          <span className="brand-mark">
            <Compass size={22} />
          </span>
          RouteForge<span className="brand-period">.</span>
        </Link>
        {/* A full document navigation also works in the embedded office frame. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" target="_top" className="tracking-back">
          <ArrowLeft size={16} /> Dispatch
        </a>
        <span className="tracking-user">{userName}</span>
      </header>
      <div className="tracking-heading">
        <div>
          <span className="tiny-label">DRIVER OPERATIONS</span>
          <h1>Every journey, in view.</h1>
          <p>
            Pair a driver&apos;s Android phone. Follow live GPS and recover the
            journey after an offline stretch.
          </p>
        </div>
        <button
          className="tracking-primary"
          onClick={() => setAdding(true)}
          disabled={!signedIn}
        >
          <Plus size={17} />
          Link a driver
        </button>
      </div>
      {!signedIn ? (
        <section className="tracking-signin">
          <ShieldCheck size={34} />
          <h2>Your drivers&apos; locations are private.</h2>
          <p>Sign in to create device links and see your own fleet.</p>
          <a className="tracking-primary" href={signInPath} target="_top">
            Sign in with ChatGPT
          </a>
        </section>
      ) : (
        <>
          {(error || fleet.error) && (
            <div className="tracking-error" role="alert">
              {error || fleet.error}
            </div>
          )}
          <div className="tracking-stats">
            <div>
              <span>Linked devices</span>
              <strong>
                {devices.filter((d) => d.pairedAt && !d.revokedAt).length}
              </strong>
            </div>
            <div>
              <span>Fresh GPS</span>
              <strong>
                {devices.filter((d) => d.status === "live").length}
              </strong>
            </div>
            <div>
              <span>Delayed location</span>
              <strong>
                {devices.filter((d) => d.status === "stale").length}
              </strong>
            </div>
            <div>
              <span>Portal updated</span>
              <strong className="tracking-time">
                {refreshed
                  ? new Date(refreshed).toLocaleTimeString()
                  : "Loading…"}
              </strong>
            </div>
          </div>
          <div className="tracking-grid">
            <aside className="tracking-devices">
              <div className="tracking-section-title">
                <h2>Drivers</h2>
                <button
                  onClick={() =>
                    void refresh().catch((e) => setError(e.message))
                  }
                  aria-label="Refresh drivers"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              {loading && <p className="tracking-empty">Loading your fleet…</p>}
              {!loading && !devices.length && (
                <div className="tracking-empty">
                  <Smartphone size={32} />
                  <h3>Link your first driver</h3>
                  <p>
                    Create a pairing code here, then enter it in the driver app
                    on their phone.
                  </p>
                </div>
              )}
              {devices.map((d) => (
                <button
                  key={d.id}
                  className={
                    "driver-card " + (selected === d.id ? "selected" : "")
                  }
                  onClick={() => {
                    setSelected(d.id);
                    setTripId("");
                  }}
                >
                  <div>
                    <strong>{d.driverName}</strong>
                    <span className={"tracking-status status-" + d.status}>
                      {labels[d.status]}
                    </span>
                  </div>
                  <p>
                    <Truck size={14} />
                    {d.vehicleLabel || "No vehicle label"}
                  </p>
                  <small>
                    {d.status === "live" ? motionLabels[motionOf(d.latestPoint)] + " · " : ""}
                    {d.latestPoint
                      ? "GPS " + when(d.latestPoint.recordedAt)
                      : d.deviceName || "Not paired yet"}
                  </small>
                </button>
              ))}
            </aside>
            <section className="tracking-detail">
              <div className="tracking-section-title">
                <div>
                  <h2>{selectedDevice?.driverName ?? "Journey map"}</h2>
                  <p>
                    {selectedDevice?.vehicleLabel ||
                      "Choose a driver to inspect their journey."}
                  </p>
                </div>
                <select
                  aria-label="Journey history"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  disabled={!selectedDevice}
                >
                  <option value="">Last 24 hours</option>
                  {trips.map((t) => (
                    <option value={t.id} key={t.id}>
                      {new Date(t.startedAt).toLocaleString()} · {t.points}{" "}
                      fixes{t.stoppedAt ? " · stopped" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <JourneyMap
                key={selected + tripId}
                points={points}
                latest={tripId ? null : (selectedDevice?.latestPoint ?? null)}
                drivers={tripId ? [] : devices}
                selectedId={selected}
                onSelect={id=>{setSelected(id);setTripId("");}}
                destinations={tripId ? [] : (assignment?.stops ?? [])}
              />
              {selectedDevice && (
                <>
                  <DriverTelemetry device={selectedDevice}/>
                  <div className="tracking-fix">
                    <div>
                      <MapPin size={18} />
                      <strong>{labels[selectedDevice.status]}</strong>
                      <span>
                        {selectedDevice.latestPoint
                          ? `${selectedDevice.latestPoint.lat.toFixed(5)}, ${selectedDevice.latestPoint.lng.toFixed(5)} · ±${Math.round(selectedDevice.latestPoint.accuracy)} m`
                          : "Waiting for the phone's first GPS fix."}
                      </span>
                    </div>
                    <p>
                      GPS captured:{" "}
                      {when(selectedDevice.latestPoint?.recordedAt ?? null)}
                      <br />
                      Phone last contacted portal:{" "}
                      {when(selectedDevice.lastSeenAt)}
                    </p>
                  </div>
                  {selectedDevice.status === "stale" && (
                    <p className="tracking-note">
                      This is the last known position. The phone may be offline
                      or recording may have stopped. Missing GPS points upload
                      when its connection returns.
                    </p>
                  )}
                  {/* Keep the office return link as a full document navigation. */}
                  {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                  {selectedDevice.pairedAt && !selectedDevice.revokedAt && <section className="dispatch-composer"><h3>Office dispatch</h3><p>Choose registered partner locations and assign work to this company driver.</p>{office.error&&<p className="dispatch-error" role="alert">{office.error}</p>}<button className="tracking-primary" disabled={!office.data} onClick={()=>setNewOrderOpen(true)}>New collection / delivery</button><a href="/" target="_top" className="office-tracker-link">Open main office →</a></section>}
                  {assignment&&<DispatchProgress key={assignment.id} dispatch={assignment} device={selectedDevice} onChanged={refreshOffice}/>}
                  <div className="device-actions">
                    <span>
                      <Smartphone size={16} />
                      {selectedDevice.deviceName ?? "Phone not paired"}
                      {selectedDevice.phoneLabel
                        ? " · " + selectedDevice.phoneLabel
                        : ""}
                    </span>
                    {selectedDevice.pairedAt&&!selectedDevice.revokedAt&&<button onClick={()=>setDetailsOpen(true)}>Driver details / call</button>}
                    {["pending", "expired"].includes(selectedDevice.status) && (
                      <button
                        disabled={busy}
                        onClick={() => void action(selectedDevice, "renew")}
                      >
                        New pairing code
                      </button>
                    )}
                    {selectedDevice.status !== "revoked" ? (
                      <button
                        disabled={busy}
                        onClick={() => void action(selectedDevice, "revoke")}
                      >
                        Unlink device
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => void action(selectedDevice, "remove")}
                      >
                        Delete device & history
                      </button>
                    )}
                  </div>
                  {selectedDevice.latestPoint && <a className="street-view-link" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedDevice.latestPoint.lat},${selectedDevice.latestPoint.lng}`} target="_blank" rel="noreferrer">Explore Street View imagery ↗ <small>Where available · historical images, not a live camera</small></a>}
                </>
              )}
              <FleetAlerts alerts={fleet.alerts} notifications={fleet.notifications} onNotifications={()=>void fleet.toggleNotifications()}/>
              <div className="tracking-section-title">
                <h3>Journey timeline</h3>
                <button
                  aria-label="Refresh journey history"
                  onClick={() => setHistoryRevision((n) => n + 1)}
                >
                  <RefreshCw size={16} />
                </button>
                <span>
                  {points.length} GPS fixes{historyBusy ? " · Updating…" : ""}
                </span>
              </div>
              {cursor && (
                <p className="tracking-note">
                  More history is available. Load it to see the full journey.
                </p>
              )}
              <div className="tracking-timeline">
                {events
                  .slice(-12)
                  .reverse()
                  .map((e) => (
                    <div key={e.eventId}>
                      <span className={"timeline-dot " + e.kind} />
                      <div>
                        <strong>
                          {e.kind === "start"
                            ? "Trip started"
                            : e.kind === "stop"
                              ? "Trip stopped"
                              : `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}`}
                        </strong>
                        <small>
                          {when(e.recordedAt)}
                          {e.receivedAt - e.recordedAt > 90000
                            ? " · Uploaded after a delay"
                            : ""}
                        </small>
                      </div>
                      {e.kind === "point" && (
                        <span>±{Math.round(e.accuracy)} m</span>
                      )}
                    </div>
                  ))}
                {!events.length && (
                  <p className="tracking-empty">
                    No uploaded journey events in this view.
                  </p>
                )}
              </div>
              {cursor && (
                <button
                  className="tracking-secondary"
                  disabled={historyBusy}
                  onClick={() => void more()}
                >
                  Load more journey points
                </button>
              )}
            </section>
          </div>
        </>
      )}
      <section className="tracking-setup">
        <div>
          <Smartphone size={25} />
          <h2>Set up the driver phone</h2>
          <p>
            Android 8 or newer. Install the pilot app, enter the pairing code,
            allow location and tap Start trip. The phone keeps a silent “Trip
            recording” notification with a Stop action.
          </p>
          <a className="tracking-primary" href={apk}>
            Download Android pilot APK
          </a>
          <a
            className="tracking-docs"
            href="https://github.com/sammymuya167-hash/sammymuya167-hash/blob/main/projects/routeforge/docs/TRACKING.md"
            target="_blank"
            rel="noreferrer"
          >
            Setup and operating limits ↗
          </a>
        </div>
        <div>
          <ShieldCheck size={25} />
          <h2>Driver controlled recording</h2>
          <p>
            Start and stop are always visible. A phone number is only a label;
            the app collects GPS while the driver has a trip running. Offline
            capture needs the phone to remain powered on with location enabled.
            Android may stop the recorder, leaving a gap.
          </p>
          <p>
            Live location refreshes about every 10 seconds. GPS points carry
            their original capture time, including after offline upload.
          </p>
        </div>
      </section>
      {newOrderOpen&&selectedDevice&&office.data&&<NewOrderForm data={office.data} devices={devices} dispatches={dispatches} initialDriver={selectedDevice.id} onChanged={refreshOffice} onClose={()=>setNewOrderOpen(false)}/>}
      {detailsOpen&&selectedDevice&&<DriverDetails device={selectedDevice} profile={office.data?.profiles.find(p=>p.deviceId===selectedDevice.id)} dispatches={dispatches} onChanged={refreshOffice} onClose={()=>setDetailsOpen(false)}/>}
      {adding && (
        <div className="tracking-modal-wrap">
          <form
            className="tracking-modal"
            onSubmit={create}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setAdding(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <h2 id="add-title">Link a driver</h2>
            <p>
              The driver must agree to share their location and pair the phone.
            </p>
            <label>
              Driver name
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Driver name"
              />
            </label>
            <label>
              Vehicle label
              <input
                maxLength={80}
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="Registration or fleet name"
              />
            </label>
            <label>
              Phone number (optional label)
              <input
                maxLength={32}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254…"
              />
            </label>
            <button className="tracking-primary" disabled={busy}>
              {busy ? "Creating…" : "Create pairing code"}
            </button>
          </form>
        </div>
      )}
      {pair && (
        <div className="tracking-modal-wrap">
          <div
            className="tracking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pair-title"
          >
            <button
              className="modal-close"
              onClick={() => setPair(null)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <Smartphone size={30} />
            <h2 id="pair-title">Pair the driver&apos;s phone</h2>
            <p>
              Open the RouteForge Driver app on the consenting driver&apos;s
              phone and enter:
            </p>
            <code className="pair-code">{pair.code}</code>
            <p>
              Expires {when(pair.expiresAt)}. Can be used once. Share it only
              with this driver.
            </p>
            <button
              className="tracking-secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(pair.code)
                  .catch(() => setError("Copy the code shown above."))
              }
            >
              Copy code
            </button>
            <a className="tracking-primary" href={apk}>
              Download Android pilot APK
            </a>
            <button
              className="tracking-secondary"
              onClick={() => setPair(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
