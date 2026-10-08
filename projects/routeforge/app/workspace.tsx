/* eslint-disable @next/next/no-html-link-for-pages -- These office transitions intentionally reload the full document in the Sites host. */
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Archive,
  Bike,
  Box,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  FolderOpen,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Route as RouteIcon,
  Search,
  Settings2,
  Sparkles,
  Truck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import RouteMap from "./route-map";

import type {
  Delivery,
  OptimizationResult,
  SavedPlan,
  Scenario,
  Vehicle,
} from "../lib/model";
import { clock, money } from "../lib/model";

import { deliverySchema, scenarioSchema } from "../lib/validation";
import { deliveriesCsv, importDeliveries, routeCsv } from "../lib/csv";

type View = "dispatch" | "deliveries" | "fleet" | "saved" | "guide";
type Run = {
  id: string;
  name: string;
  scenario: Scenario;
  result: OptimizationResult;
  createdAt: number;
};
const nav = [
  { id: "dispatch", label: "Dispatch", icon: LayoutDashboard },
  { id: "deliveries", label: "Deliveries", icon: Package },
  { id: "fleet", label: "Fleet", icon: Truck },
  { id: "saved", label: "Saved plans", icon: FolderOpen },
] as const;
function download(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

export default function DispatchWorkspace({
  initialScenario,
  initialResult,
  userName,
  signedIn,
  signInPath,
  embedded = false,
  onOffice,
  initialPlan = null,
}: {
  initialScenario: Scenario;
  initialResult: OptimizationResult | null;
  userName: string;
  signedIn: boolean;
  signInPath: string;
  embedded?: boolean;
  onOffice?: () => void;
  initialPlan?: SavedPlan | null;
}) {
  const [scenario, setScenario] = useState(initialPlan?.scenario ?? initialScenario),
    [result, setResult] = useState<OptimizationResult | null>(initialPlan?.result ?? initialResult);
  const [view, setView] = useState<View>("dispatch"),
    [selected, setSelected] = useState<string | null>(null),
    [routeDetail, setRouteDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Company planning draft"),
    [message, setMessage] = useState("");
  const [plans, setPlans] = useState<SavedPlan[]>([]),
    [runs, setRuns] = useState<Run[]>([]),
    [planId, setPlanId] = useState<string | null>(initialPlan?.id ?? null),
    [savedLoading, setSavedLoading] = useState(false),
    [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Delivery | null>(null),
    [settings, setSettings] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (signedIn) {
      let active = true;
      api<{ plans: SavedPlan[]; runs: Run[] }>("/api/plans")
        .then((data) => {
          if (active) {
            setPlans(data.plans);
            setRuns(data.runs);
          }
        })
        .catch((error) => {
          if (active) setMessage(error.message);
        });
      return () => {
        active = false;
      };
    }
  }, [signedIn]);
  async function refresh() {
    setSavedLoading(true);
    try {
      const data = await api<{ plans: SavedPlan[]; runs: Run[] }>("/api/plans");
      setPlans(data.plans);
      setRuns(data.runs);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load plans.",
      );
    } finally {
      setSavedLoading(false);
    }
  }
  function update(next: Scenario) {
    setScenario(next);
    setResult(null);
    setSelected(null);
    setStatus("Changes ready to optimize");
  }
  async function run() {
    const checked = scenarioSchema.safeParse(scenario);
    if (!checked.success) {
      setMessage(checked.error.issues[0].message);
      return;
    }
    if (!signedIn) {
      setMessage(
        "Sign in with ChatGPT to run the optimizer and keep your plans.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ result: OptimizationResult }>(
        "/api/optimize",
        "POST",
        scenario,
      );
      setResult(data.result);
      setStatus("Optimized · saved to run history");
      setSelected(null);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Optimization failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const data = await api<{ id: string }>("/api/plans", "POST", {
        id: planId,
        scenario,
      });
      setPlanId(data.id);
      setMessage("Plan saved. Find it in Saved plans.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  function load(
    s: Scenario,
    r: OptimizationResult | null,
    id: string | null,
    state: string,
  ) {
    const connected={...s,vehicles:initialScenario.vehicles.map(v=>{const saved=s.vehicles.find(x=>x.id===v.id);return saved?{...saved,id:v.id,name:v.name,driver:v.driver}:v;})};
    setScenario(connected);
    setResult(connected.vehicles.length===s.vehicles.length&&connected.vehicles.every(v=>s.vehicles.some(x=>x.id===v.id))?r:null);
    setPlanId(id);
    setSelected(null);
    setStatus(state);
    setView("dispatch");
  }
  async function archive(id: string, archived: boolean) {
    setBusy(true);
    try {
      await api("/api/plans", "PATCH", { id, archived });
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update plan.",
      );
    } finally {
      setBusy(false);
    }
  }
  function addDelivery() {
    if (scenario.deliveries.length >= 60) {
      setMessage("This release supports up to 60 deliveries per plan.");
      return;
    }
    setEditing({
      id: `RF-${crypto.randomUUID().slice(0, 8)}`,
      name: "",
      address: "",
      lat: scenario.depot.lat,
      lng: scenario.depot.lng,
      weight: 5,
      serviceMinutes: 6,
      windowStart: 540,
      windowEnd: 1020,
      priority: "normal",
    });
  }
  const route = result?.routes.find((r) => r.vehicle.id === routeDetail);
  const deliveries = scenario.deliveries.filter((d) =>
    `${d.name} ${d.address} ${d.id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const WorkspaceMain=embedded?"section":"main";
  return (
    <div className={`app-shell planning-workspace ${embedded ? "planner-embedded" : ""}`}>
      {!embedded && <aside className="sidebar">
        <Link className="brand" href="/" aria-label="RouteForge home">
          <span className="brand-mark">
            <RouteIcon size={23} strokeWidth={2.5} />
          </span>
          <span>
            routeforge<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="workspace-name">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>SHADOWNET</strong>
            <small>Delivery workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(n.id);
                if (n.id === "dispatch") requestAnimationFrame(() => document.getElementById("active-drivers")?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "deliveries" && (
                <span className="nav-count">{scenario.deliveries.length}</span>
              )}
            </button>
          ))}
          <Link href="/tracking" className="nav-item"><MapPin size={18}/>Live tracking</Link>
        </nav>
        <div className="sidebar-card">
          <span className="tiny-label">BUILT FOR THE LAST MILE</span>
          <Compass size={31} />
          <strong>
            A better way
            <br />
            from A to everywhere.
          </strong>
          <p>Less distance. More delivered.</p>
          <button onClick={() => setView("guide")}>
            Explore the planner <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => setView("guide")}>
            <HelpCircle size={18} />
            Planner guide
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>
                {userName.includes("@") ? userName.split("@")[0] : userName}
              </strong>
              <small>
                {signedIn ? "Private workspace" : "Sign in to plan"}
              </small>
            </div>
            <MoreHorizontal size={17} />
          </div>
          <small className="version">RouteForge 1.0 · by SHADOWNET</small>
        </div>
      </aside>}
      <WorkspaceMain className="main">
        {!embedded && <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>
              {nav.find((n) => n.id === view)?.label ?? "Planner guide"}
            </strong>
          </div>
          <div className="topbar-right">
            <a className="button secondary small" href="/" target="_top">Main office ↗</a>
            {signedIn ? (
              <span className="private-label">
                <span className="live-dot" />
                Signed in
              </span>
            ) : (
              <a className="sign-in" href={signInPath} target="_top">
                Sign in with ChatGPT <ArrowUpRight size={13} />
              </a>
            )}
          </div>
        </header>}
        {embedded && <nav className="planner-section-nav" aria-label="Planning controls">{nav.map(n=><button key={n.id} className={view===n.id?"active":""} aria-current={view===n.id?"page":undefined} onClick={()=>setView(n.id)}><n.icon size={16}/>{n.id==="dispatch"?"Routes & costs":n.id==="deliveries"?"Planning stops":n.id==="fleet"?"Capacity & rates":"Saved scenarios"}</button>)}<button className={view==="guide"?"active":""} onClick={()=>setView("guide")}><HelpCircle size={16}/> Planner guide</button></nav>}
        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <span className="line" /> THE DELIVERY CONTROL ROOM
              </p>
              <h1>
                {view === "dispatch"
                  ? "Make every mile count."
                  : view === "deliveries"
                    ? "Every stop, in one place."
                    : view === "fleet"
                      ? "Your fleet. Your rules."
                      : view === "saved"
                        ? "Good plans, kept."
                        : "From orders to optimized."}
              </h1>
              <p>
                {view === "dispatch"
                  ? "Turn a busy delivery day into a plan that just makes sense."
                  : view === "deliveries"
                    ? "Add stops, set delivery windows, and bring your own orders."
                    : view === "fleet"
                      ? "Set capacity and working hours before planning your routes."
                      : view === "saved"
                        ? "Pick up a saved scenario or revisit a previous optimization."
                        : "A practical route planner, with the assumptions in plain sight."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={16} />
                Plan settings
              </button>
              <button className="button primary" disabled={busy} onClick={run}>
                {busy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Zap size={16} />
                )}
                Optimize routes
              </button>
            </div>
          </div>
          {message && (
            <div className="notice" role="status">
              <span>{message}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="plan-bar">
            <div>
              <span className="scenario-dot" />
              <strong>{scenario.name}</strong>
              <span className="plan-status">{status}</span>
            </div>
            <div>
              <button className="text-button" disabled={busy} onClick={save}>
                <FolderOpen size={14} />
                Save plan
              </button>
              <button className="text-button" disabled={busy} onClick={()=>{if(window.confirm("Replace this planning draft with the current office queue and fleet? Save it first to keep your changes.")){update(initialScenario);setPlanId(null);setStatus("Company queue reloaded");}}}><RotateCcw size={14}/> Reload company orders</button>
            </div>
          </div>
          {view === "dispatch" && (
            <>
              <div className="metrics">
                <Metric
                  label="DELIVERY STOPS"
                  value={String(scenario.deliveries.length)}
                  suffix="stops"
                  icon={<Package size={18} />}
                  detail={`${result?.assigned ?? 0} assigned to routes`}
                />
                <Metric
                  label="PLANNED VEHICLES"
                  value={String(
                    scenario.vehicles.filter((v) => v.active).length,
                  )}
                  suffix="vehicles"
                  icon={<Truck size={18} />}
                  detail={`${scenario.vehicles.filter((v) => v.active).reduce((n, v) => n + v.capacity, 0)} kg combined capacity`}
                />
                <Metric
                  label="PLANNED DISTANCE"
                  value={result ? result.distanceKm.toFixed(1) : "—"}
                  suffix="km"
                  icon={<RouteIcon size={18} />}
                  detail={
                    result
                      ? `${Math.abs(result.savingsPercent).toFixed(0)}% ${result.savingsPercent >= 0 ? "less" : "more"} vs input order`
                      : "Run the optimizer to calculate"
                  }
                  positive={!!result && result.savingsPercent > 0}
                />
                <Metric
                  label="ESTIMATED ROUTE COST"
                  value={result ? money(result.cost) : "—"}
                  icon={<Box size={18} />}
                  detail="Based on your per-km fleet rates"
                />
              </div>
              <section className="planner-office-link"><strong>Live deliveries stay connected to the office.</strong><p>This planner calculates routes, capacity and cost estimates. Its drafts do not assign work to a rider.</p>{embedded?<button className="button secondary small" onClick={onOffice}>Open delivery desk →</button>:<a className="button secondary small" href="/" target="_top">Open main office & dispatch →</a>}</section>
              <div className="dispatch-grid">
                <div>
                  <div className="section-heading">
                    <div>
                      <h2>Route overview</h2>
                      <p>One clear view of your delivery day.</p>
                    </div>
                    <button
                      className="button small secondary"
                      disabled={!result}
                      onClick={() =>
                        result &&
                        download("routeforge-routes.csv", routeCsv(result))
                      }
                    >
                      <ArrowDownToLine size={14} />
                      Export CSV
                    </button>
                  </div>
                  <RouteMap
                    scenario={scenario}
                    result={result}
                    selected={selected}
                    onRoute={setSelected}
                    onDelivery={setEditing}
                  />
                  <div className="insight">
                    <span className="insight-icon">
                      <Sparkles size={19} />
                    </span>
                    <div>
                      <strong>
                        {result
                          ? `${Math.abs(result.baselineKm - result.distanceKm).toFixed(1)} km ${result.baselineKm >= result.distanceKm ? "saved" : "added"} compared with input order`
                          : "Your next efficient delivery day starts here"}
                      </strong>
                      <p>
                        {result
                          ? "Same assigned stops and vehicles. Capacity, delivery windows and depot returns are checked."
                          : "Add your stops and fleet, then optimize to calculate a feasible plan."}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Read optimization assumptions"
                      onClick={() => setView("guide")}
                    >
                      <ArrowUpRight size={20} />
                    </button>
                  </div>
                </div>
                <section className="route-panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Your routes{" "}
                        <span className="count-pill">
                          {result?.routes.filter((r) => r.stops.length)
                            .length ?? 0}
                        </span>
                      </h2>
                      <p>Ready for a closer look.</p>
                    </div>
                  </div>
                  <div className="route-cards">
                    {result ? (
                      result.routes.map((r, i) => (
                        <button
                          key={r.vehicle.id}
                          className={`route-card ${selected === r.vehicle.id ? "selected" : ""}`}
                          onClick={() => {
                            setSelected(r.vehicle.id);
                            setRouteDetail(r.vehicle.id);
                          }}
                        >
                          <div className="route-card-top">
                            <span
                              className="vehicle-icon"
                              style={{
                                background: `${r.vehicle.color}18`,
                                color: r.vehicle.color,
                              }}
                            >
                              {r.vehicle.name.toLowerCase().includes("bike") ? (
                                <Bike size={21} />
                              ) : (
                                <Truck size={21} />
                              )}
                            </span>
                            <span className="route-number">
                              ROUTE {String(i + 1).padStart(2, "0")}
                            </span>
                            <ArrowUpRight size={17} />
                          </div>
                          <strong>{r.vehicle.name}</strong>
                          <small>{r.vehicle.driver || "Driver not set"}</small>
                          <div className="route-stats">
                            <span>
                              <b>{r.stops.length}</b> stops
                            </span>
                            <span>
                              <b>{r.distanceKm.toFixed(1)}</b> km
                            </span>
                            <span>
                              <b>{Math.ceil(r.durationMinutes)}</b> min
                            </span>
                          </div>
                          <div className="capacity-caption">
                            <span>Vehicle capacity</span>
                            <b>
                              {r.load} / {r.vehicle.capacity} kg
                            </b>
                          </div>
                          <div className="capacity-track">
                            <span
                              style={{
                                width: `${(r.load / r.vehicle.capacity) * 100}%`,
                                background: r.vehicle.color,
                              }}
                            />
                          </div>
                          <div className="route-card-bottom">
                            <span>
                              <span
                                className="small-dot"
                                style={{ background: r.vehicle.color }}
                              />
                              {r.stops.length
                                ? `Returns ${clock(r.finish)}`
                                : "No stops assigned"}
                            </span>
                            <span>
                              View stops <ArrowRight size={12} />
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="empty-state">
                        <RouteIcon size={30} />
                        <h3>Routes will appear here</h3>
                        <p>
                          Run optimization after changing your deliveries or
                          fleet.
                        </p>
                      </div>
                    )}
                  </div>
                  {!!result?.unassigned.length && (
                    <div className="unassigned">
                      <strong>
                        {result.unassigned.length} stops need attention
                      </strong>
                      {result.unassigned.map(({ delivery, reason }) => (
                        <p key={delivery.id}>
                          <button onClick={() => setEditing(delivery)}>
                            {delivery.name}
                          </button>
                          <small>{reason}</small>
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="route-note">
                    <Check size={15} />
                    <span>
                      Delivery windows and shift limits are enforced.
                      <br />
                      All routes return to your depot.
                    </span>
                  </div>
                </section>
              </div>
              <section className="delivery-preview">
                <div className="section-heading">
                  <div>
                    <h2>On the delivery board</h2>
                    <p>Your next stops, at a glance.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("deliveries")}
                  >
                    View all deliveries <ArrowRight size={14} />
                  </button>
                </div>
                <div className="mini-deliveries">
                  {scenario.deliveries.slice(0, 4).map((d) => (
                    <button key={d.id} onClick={() => setEditing(d)}>
                      <span className="mini-pin">
                        <MapPin size={18} />
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>
                          {d.address} · {d.weight} kg
                        </small>
                      </div>
                      <span
                        className={
                          d.priority === "high" ? "priority high" : "priority"
                        }
                      >
                        {d.priority === "high" ? "Priority" : "Standard"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "deliveries" && (
            <section className="table-card">
              <div className="table-toolbar">
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search deliveries"
                    placeholder="Search stops, areas, IDs…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      download(
                        "routeforge-delivery-template.csv",
                        deliveriesCsv(scenario.deliveries),
                      )
                    }
                  >
                    <ArrowDownToLine size={14} />
                    Sample CSV
                  </button>
                  <button
                    className="button secondary small"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={14} />
                    Import CSV
                  </button>
                  <button
                    className="button primary small"
                    onClick={addDelivery}
                  >
                    <Plus size={15} />
                    Add delivery
                  </button>
                </div>
                <input
                  hidden
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imported = importDeliveries(await file.text());
                      update({ ...scenario, deliveries: imported });
                      setMessage(
                        `Imported ${imported.length} deliveries. Existing stops were replaced in this draft.`,
                      );
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Could not import CSV.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>DELIVERY</th>
                      <th>AREA</th>
                      <th>LOAD</th>
                      <th>DELIVERY WINDOW</th>
                      <th>PRIORITY</th>
                      <th>
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.name}</strong>
                          <small>{d.id}</small>
                        </td>
                        <td>{d.address}</td>
                        <td>{d.weight} kg</td>
                        <td>
                          <Clock3 size={13} /> {clock(d.windowStart)}–
                          {clock(d.windowEnd)}
                        </td>
                        <td>
                          <span
                            className={
                              d.priority === "high"
                                ? "priority high"
                                : "priority"
                            }
                          >
                            {d.priority === "high" ? "High" : "Standard"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setEditing(d)}
                          >
                            Edit <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!deliveries.length && (
                  <div className="empty-state">
                    No deliveries match this search.
                  </div>
                )}
              </div>
              <div className="table-foot">
                {deliveries.length} of {scenario.deliveries.length} deliveries ·
                CSV times use minutes after midnight · maximum 60 stops
              </div>
            </section>
          )}
          {view === "fleet" && (
            <>
              <section className="planner-office-link"><strong>Live deliveries stay connected to the office.</strong><p>This planner calculates routes, capacity and cost estimates. Its drafts do not assign work to a rider.</p>{embedded?<button className="button secondary small" onClick={onOffice}>Open delivery desk →</button>:<a className="button secondary small" href="/" target="_top">Open main office & dispatch →</a>}</section>
              <div className="section-heading">
                <div>
                  <h2>Vehicles & working hours</h2>
                  <p>
                    Paired company vehicles only. Capacity, shifts and rates apply to this planning draft; they do not override office duty status.
                  </p>
                </div>
                <a className="button secondary small" href="/tracking" target="_top"><Plus size={15}/> Onboard company vehicle</a>
              </div>
              <div className="fleet-grid">
                {scenario.vehicles.map((v) => (
                  <FleetCard
                    key={v.id}
                    vehicle={v}
                    onUpdate={(next) =>
                      update({
                        ...scenario,
                        vehicles: scenario.vehicles.map((item) =>
                          item.id === next.id ? next : item,
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
          {view === "saved" && (
            <>
              <div className="section-heading">
                <div>
                  <h2>Saved scenarios</h2>
                  <p>
                    {signedIn
                      ? "Plans are stored in your private account."
                      : "Sign in with ChatGPT to save and revisit plans."}
                  </p>
                </div>
                <div className="heading-actions">
                  <label className="archive-toggle">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    Archived
                  </label>
                  <button
                    className="button secondary small"
                    disabled={savedLoading || !signedIn}
                    onClick={refresh}
                  >
                    {savedLoading ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    Refresh
                  </button>
                </div>
              </div>
              <div className="saved-grid">
                {plans
                  .filter((p) => !!p.archivedAt === showArchived)
                  .map((p) => (
                    <article className="saved-card" key={p.id}>
                      <FolderOpen size={22} />
                      <h3>{p.name}</h3>
                      <p>
                        {p.scenario.deliveries.length} stops ·{" "}
                        {p.scenario.vehicles.filter((v) => v.active).length}{" "}
                        vehicles
                      </p>
                      <small>
                        Saved {new Date(p.updatedAt).toLocaleString("en-GB")}
                      </small>
                      <div>
                        <button
                          className="button secondary small"
                          onClick={() =>
                            load(
                              p.scenario,
                              p.result,
                              p.id,
                              "Loaded saved plan",
                            )
                          }
                        >
                          Open plan <ArrowUpRight size={14} />
                        </button>
                        <button
                          className="icon-button"
                          disabled={busy}
                          aria-label={
                            p.archivedAt
                              ? `Restore ${p.name}`
                              : `Archive ${p.name}`
                          }
                          onClick={() => archive(p.id, !p.archivedAt)}
                        >
                          {p.archivedAt ? (
                            <RotateCcw size={16} />
                          ) : (
                            <Archive size={16} />
                          )}
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!plans.some((p) => !!p.archivedAt === showArchived) && (
                <div className="empty-state panel">
                  <FolderOpen size={32} />
                  <h3>
                    {showArchived
                      ? "No archived plans"
                      : "Your good plans belong here"}
                  </h3>
                  <p>
                    Use Save plan to keep a scenario, then reopen it on another
                    device.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setView("dispatch")}
                  >
                    Back to dispatch <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <div className="section-heading history-heading">
                <div>
                  <h2>Recent optimization runs</h2>
                  <p>
                    Each successful server optimization keeps an immutable
                    snapshot.
                  </p>
                </div>
              </div>
              <div className="run-list">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      load(r.scenario, r.result, null, "Loaded historical run")
                    }
                  >
                    <span className="vehicle-icon">
                      <RouteIcon size={20} />
                    </span>
                    <div>
                      <strong>{r.name}</strong>
                      <small>
                        {new Date(r.createdAt).toLocaleString("en-GB")}
                      </small>
                    </div>
                    <span>
                      {r.result.assigned} stops ·{" "}
                      {r.result.distanceKm.toFixed(1)} km
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
                {!runs.length && (
                  <p className="muted">
                    Run your first optimization to start the history.
                  </p>
                )}
              </div>
            </>
          )}
          {view === "guide" && (
            <div className="guide-grid">
              <section className="guide-card">
                <span className="eyebrow">YOUR FIRST DISPATCH</span>
                <h2>A plan in three moves.</h2>
                {[
                  [
                    "01",
                    "Bring your deliveries",
                    "Add stops by coordinates or import the sample CSV format. Set weight, service time and the delivery window.",
                  ],
                  [
                    "02",
                    "Set your fleet",
                    "Choose available vehicles, their payload capacity, working hours and per-kilometre rates.",
                  ],
                  [
                    "03",
                    "Optimize, inspect, export",
                    "Check ordered stops, estimated arrival times and unassigned deliveries. Save the scenario or export the driver manifest.",
                  ],
                ].map(([n, title, text]) => (
                  <div className="guide-step" key={n}>
                    <b>{n}</b>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
                <button
                  className="button primary"
                  onClick={() => setView("dispatch")}
                >
                  Start planning <ArrowRight size={15} />
                </button>
              </section>
              <section className="guide-card">
                <span className="eyebrow">THE MODEL, EXPLAINED</span>
                <h2>Useful estimates. Clear limits.</h2>
                <p>
                  RouteForge uses feasible cheapest insertion followed by
                  bounded 2-opt. It enforces vehicle payload, arrival windows
                  and return-to-depot shift deadlines. High-priority deliveries
                  are considered first.
                </p>
                <p>
                  Travel distance is haversine distance × your detour factor.
                  Time uses a constant average speed; cost uses each vehicle’s
                  per-km rate. Routes on the schematic map connect locations
                  directly.
                </p>
                <p>
                  The comparison keeps the same assigned deliveries and
                  vehicles, in the original input order. It compares distance
                  only; the input-order baseline is not a validated dispatch
                  schedule.
                </p>
                <p>
                  This is a heuristic, so it does not guarantee the global
                  optimum. There is no live traffic, geocoding, driver tracking,
                  or road navigation. The Nairobi scenario is synthetic.
                </p>
                <div className="guide-credit">
                  <strong>Project 92 · Full Stack Projects</strong>
                  <p>
                    Inspired by{" "}
                    <a
                      href="https://github.com/VROOM-Project/vroom"
                      target="_blank"
                      rel="noreferrer"
                    >
                      VROOM
                    </a>
                    . RouteForge has an original TypeScript engine and
                    interface; VROOM is not running in this release.
                  </p>
                  <a
                    href="https://github.com/sammymuya167-hash/sammymuya167-hash/tree/main/projects/routeforge"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explore source on GitHub <ArrowUpRight size={14} />
                  </a>
                </div>
              </section>
            </div>
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-dot" /> Crafted by SHADOWNET
            </span>
            <span>
              Built to move things forward. <RouteIcon size={13} />
            </span>
          </footer>
        </div>
      </WorkspaceMain>
      {editing && (
        <DeliveryDialog
          key={editing.id}
          delivery={editing}
          existing={scenario.deliveries.some((d) => d.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(d) => {
            update({
              ...scenario,
              deliveries: scenario.deliveries.some((item) => item.id === d.id)
                ? scenario.deliveries.map((item) =>
                    item.id === d.id ? d : item,
                  )
                : [...scenario.deliveries, d],
            });
            setEditing(null);
          }}
          onRemove={() => {
            update({
              ...scenario,
              deliveries: scenario.deliveries.filter(
                (d) => d.id !== editing.id,
              ),
            });
            setEditing(null);
          }}
        />
      )}
      {settings && (
        <SettingsDialog
          scenario={scenario}
          onClose={() => setSettings(false)}
          onSave={(s) => {
            update(s);
            setSettings(false);
          }}
        />
      )}
      {route && (
        <div className="modal-backdrop" onClick={() => setRouteDetail(null)}>
          <section
            className="modal route-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="route-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">DRIVER MANIFEST</p>
                <h2 id="route-title">{route.vehicle.name}</h2>
                <p>
                  {route.vehicle.driver} · {route.distanceKm.toFixed(1)} km ·{" "}
                  {money(route.cost)}
                </p>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close route details"
                onClick={() => setRouteDetail(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="timeline">
              <div className="timeline-stop">
                <span className="depot-marker">
                  <Truck size={14} />
                </span>
                <div>
                  <strong>Leave {scenario.depot.name}</strong>
                  <small>
                    {clock(route.vehicle.shiftStart)} · {route.load} kg on board
                  </small>
                </div>
              </div>
              {route.stops.map((stop, index) => (
                <div className="timeline-stop" key={stop.id}>
                  <span style={{ background: route.vehicle.color }}>
                    {index + 1}
                  </span>
                  <div>
                    <strong>{stop.name}</strong>
                    <small>
                      {stop.address} · {stop.weight} kg · {stop.serviceMinutes}{" "}
                      min service
                    </small>
                    <small>
                      Window {clock(stop.windowStart)}–{clock(stop.windowEnd)}
                      {stop.wait > 0.5
                        ? ` · ${Math.ceil(stop.wait)} min wait`
                        : ""}
                    </small>
                  </div>
                  <b>{clock(stop.arrival)}</b>
                </div>
              ))}
              <div className="timeline-stop">
                <span className="depot-marker">
                  <Check size={15} />
                </span>
                <div>
                  <strong>Return to depot</strong>
                  <small>
                    {clock(route.finish)} · before shift end{" "}
                    {clock(route.vehicle.shiftEnd)}
                  </small>
                </div>
              </div>
            </div>
            <button
              className="button primary"
              onClick={() =>
                result &&
                download(
                  `${route.vehicle.id}-manifest.csv`,
                  routeCsv({ ...result, routes: [route], unassigned: [] }),
                )
              }
            >
              <ArrowDownToLine size={15} />
              Export this manifest
            </button>
          </section>
        </div>
      )}
      <DialogKeys
        active={!!editing || settings || !!route}
        onClose={() => {
          setEditing(null);
          setSettings(false);
          setRouteDetail(null);
        }}
      />
    </div>
  );
}
function Metric({
  label,
  value,
  suffix,
  icon,
  detail,
  positive,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  detail: string;
  positive?: boolean;
}) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <p>
        {value}
        <small>{suffix}</small>
      </p>
      <span className={positive ? "metric-detail positive" : "metric-detail"}>
        {positive && <ArrowUpRight size={12} />}
        {detail}
      </span>
    </article>
  );
}
function FleetCard({
  vehicle: v,
  onUpdate,
}: {
  vehicle: Vehicle;
  onUpdate: (v: Vehicle) => void;
}) {
  return (
    <article className="fleet-card">
      <div className="fleet-card-top">
        <span
          className="vehicle-icon"
          style={{ color: v.color, background: `${v.color}18` }}
        >
          <Truck size={23} />
        </span>
        <label className="active-toggle">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => onUpdate({ ...v, active: e.target.checked })}
          />
          {v.active ? "Available" : "Unavailable"}
        </label>
      </div>
      <label>
        Vehicle name
        <input
          value={v.name}
          readOnly
        />
      </label>
      <label>
        Driver
        <input
          value={v.driver}
          readOnly
        />
      </label>
      <div className="form-grid">
        <label>
          Capacity (kg)
          <input
            type="number"
            min="1"
            max="100000"
            value={v.capacity}
            onChange={(e) =>
              onUpdate({ ...v, capacity: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Rate (KSh / km)
          <input
            type="number"
            min="0"
            max="5000"
            value={v.costPerKm}
            onChange={(e) =>
              onUpdate({ ...v, costPerKm: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Shift starts
          <input
            type="time"
            value={clock(v.shiftStart)}
            onChange={(e) =>
              onUpdate({ ...v, shiftStart: fromTime(e.target.value) })
            }
          />
        </label>
        <label>
          Shift ends
          <input
            type="time"
            value={clock(v.shiftEnd)}
            onChange={(e) =>
              onUpdate({ ...v, shiftEnd: fromTime(e.target.value) })
            }
          />
        </label>
      </div>
    </article>
  );
}
function fromTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function DeliveryDialog({
  delivery,
  existing,
  onClose,
  onSave,
  onRemove,
}: {
  delivery: Delivery;
  existing: boolean;
  onClose: () => void;
  onSave: (d: Delivery) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(delivery),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = deliverySchema.safeParse(draft);
          if (!parsed.success) setError(parsed.error.issues[0].message);
          else onSave(parsed.data);
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">DELIVERY DETAILS</p>
            <h2 id="delivery-title">
              {existing ? "Edit your stop" : "Add a delivery"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close delivery editor"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <label>
          Delivery name
          <input
            autoFocus
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="e.g. Westlands pickup"
          />
        </label>
        <label>
          Area / address
          <input
            maxLength={180}
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Latitude
            <input
              required
              type="number"
              step="any"
              min="-85"
              max="85"
              value={draft.lat}
              onChange={(e) =>
                setDraft({ ...draft, lat: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Longitude
            <input
              required
              type="number"
              step="any"
              min="-180"
              max="180"
              value={draft.lng}
              onChange={(e) =>
                setDraft({ ...draft, lng: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Weight (kg)
            <input
              required
              type="number"
              min="0.1"
              step="any"
              value={draft.weight}
              onChange={(e) =>
                setDraft({ ...draft, weight: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Service time (min)
            <input
              type="number"
              min="0"
              max="180"
              value={draft.serviceMinutes}
              onChange={(e) =>
                setDraft({ ...draft, serviceMinutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Window starts
            <input
              required
              type="time"
              value={clock(draft.windowStart)}
              onChange={(e) =>
                setDraft({ ...draft, windowStart: fromTime(e.target.value) })
              }
            />
          </label>
          <label>
            Window ends
            <input
              required
              type="time"
              value={clock(draft.windowEnd)}
              onChange={(e) =>
                setDraft({ ...draft, windowEnd: fromTime(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Priority
          <select
            value={draft.priority}
            onChange={(e) =>
              setDraft({
                ...draft,
                priority: e.target.value as "normal" | "high",
              })
            }
          >
            <option value="normal">Standard</option>
            <option value="high">High priority</option>
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {existing ? (
            <button
              type="button"
              className="text-button danger"
              onClick={onRemove}
            >
              Remove from draft
            </button>
          ) : (
            <span />
          )}
          <button className="button primary" type="submit">
            <Check size={16} />
            Save delivery
          </button>
        </div>
      </form>
    </div>
  );
}
function SettingsDialog({
  scenario,
  onClose,
  onSave,
}: {
  scenario: Scenario;
  onClose: () => void;
  onSave: (s: Scenario) => void;
}) {
  const [draft, setDraft] = useState(scenario);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PLANNING ASSUMPTIONS</p>
            <h2 id="settings-title">Plan settings</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <label>
          Plan name
          <input
            autoFocus
            required
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Depot name
          <input
            required
            maxLength={100}
            value={draft.depot.name}
            onChange={(e) =>
              setDraft({
                ...draft,
                depot: { ...draft.depot, name: e.target.value },
              })
            }
          />
        </label>
        <div className="form-grid">
          <label>
            Depot latitude
            <input
              required
              type="number"
              step="any"
              min="-85"
              max="85"
              value={draft.depot.lat}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  depot: { ...draft.depot, lat: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Depot longitude
            <input
              required
              type="number"
              step="any"
              min="-180"
              max="180"
              value={draft.depot.lng}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  depot: { ...draft.depot, lng: Number(e.target.value) },
                })
              }
            />
          </label>
          <label>
            Average speed (km/h)
            <input
              required
              type="number"
              min="5"
              max="100"
              value={draft.speedKph}
              onChange={(e) =>
                setDraft({ ...draft, speedKph: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Distance detour factor
            <input
              required
              type="number"
              min="1"
              max="3"
              step="0.05"
              value={draft.roadFactor}
              onChange={(e) =>
                setDraft({ ...draft, roadFactor: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <p className="muted">
          Distance uses haversine × detour factor. Arrival times use a constant
          speed, with service and waiting time included.
        </p>
        <div className="modal-actions">
          <span />
          <button className="button primary" type="submit">
            Apply settings <Check size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
function DialogKeys({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        const elements = dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, a[href], [tabindex="0"]',
        );
        if (!elements?.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [active, onClose]);
  return null;
}
