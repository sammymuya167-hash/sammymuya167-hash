"use client";
import { useState } from "react";
import { Plus, Minus, LocateFixed, Layers, Navigation } from "lucide-react";
import type {
  Delivery,
  OptimizationResult,
  Point,
  Scenario,
} from "../lib/model";

export default function RouteMap({
  scenario,
  result,
  selected,
  onRoute,
  onDelivery,
}: {
  scenario: Scenario;
  result: OptimizationResult | null;
  selected: string | null;
  onRoute: (id: string | null) => void;
  onDelivery: (d: Delivery) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const all = [scenario.depot, ...scenario.deliveries];
  const minLat = Math.min(...all.map((p) => p.lat)) - 0.012,
    maxLat = Math.max(...all.map((p) => p.lat)) + 0.012;
  const minLng = Math.min(...all.map((p) => p.lng)) - 0.018,
    maxLng = Math.max(...all.map((p) => p.lng)) + 0.018;
  const project = (p: Point) => [
    ((p.lng - minLng) / (maxLng - minLng)) * 900,
    ((maxLat - p.lat) / (maxLat - minLat)) * 560,
  ];
  const depot = project(scenario.depot);
  const inNairobi =
    Math.abs(scenario.depot.lat + 1.27) < 0.3 &&
    Math.abs(scenario.depot.lng - 36.81) < 0.3;
  const labels: [string, number, number][] = [
    ["GIGIRI", -1.226, 36.808],
    ["SPRING VALLEY", -1.248, 36.784],
    ["PARKLANDS", -1.253, 36.824],
    ["WESTLANDS", -1.267, 36.797],
    ["LAVINGTON", -1.278, 36.762],
    ["KILELESHWA", -1.285, 36.787],
    ["KILIMANI", -1.296, 36.777],
    ["CITY CENTRE", -1.284, 36.824],
    ["UPPER HILL", -1.306, 36.815],
    ["SOUTH B", -1.315, 36.838],
  ];
  const assigned = new Map(
    result?.routes.flatMap((r) =>
      r.stops.map(
        (d, i) =>
          [
            d.id,
            { color: r.vehicle.color, sequence: i + 1, vehicle: r.vehicle.id },
          ] as const,
      ),
    ) ?? [],
  );
  return (
    <section className="map-card" aria-label="Delivery map">
      <div className="map-top">
        <span>
          <span className="live-dot" />{" "}
          {inNairobi ? "Nairobi, Kenya" : "Delivery area"}
        </span>
        <span className="map-mode">
          <Layers size={13} /> Schematic map
        </span>
      </div>
      <div className="map-canvas">
        <svg
          viewBox="0 0 900 560"
          role="img"
          aria-label="Schematic delivery map with numbered stops and estimated route connections"
        >
          <defs>
            <pattern
              id="map-grid"
              width="55"
              height="48"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-14)"
            >
              <rect width="55" height="48" fill="#f1f2ed" />
              <path fill="none" d="M0 0H55V48" stroke="#fff" strokeWidth="6" />
              <path
                fill="none"
                d="M25 0V48M0 24H55"
                stroke="#e5e8df"
                strokeWidth="1"
              />
            </pattern>
            <filter id="pin-shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".12" />
            </filter>
          </defs>
          <rect width="900" height="560" fill="url(#map-grid)" />
          <g
            transform={`translate(${450 - 450 * zoom},${280 - 280 * zoom}) scale(${zoom})`}
          >
            {inNairobi && (
              <>
                <path
                  d="M480 -20L735 -20L770 110L683 163L599 138L524 71Z"
                  fill="#dee8d7"
                />
                <path
                  d="M584 370L641 365L658 425L598 446L568 414Z"
                  fill="#e0e9d8"
                />
                <path
                  d="M-30 339C165 326 116 238 287 239S464 167 900 212"
                  stroke="#d4ddd7"
                  strokeWidth="9"
                  fill="none"
                />
                <path
                  d="M-30 339C165 326 116 238 287 239S464 167 900 212"
                  stroke="#e6eeed"
                  strokeWidth="5"
                  fill="none"
                />
                <path
                  d="M-20 413L202 392L404 335L567 288L683 146L762 -20M322 -20L367 91L450 173L539 271L625 365L721 489L881 580M-30 191L182 215L313 283L381 416L469 580"
                  stroke="#d9dccc"
                  strokeWidth="13"
                  fill="none"
                />
                <path
                  d="M-20 413L202 392L404 335L567 288L683 146L762 -20M322 -20L367 91L450 173L539 271L625 365L721 489L881 580M-30 191L182 215L313 283L381 416L469 580"
                  stroke="#fffdf1"
                  strokeWidth="9"
                  fill="none"
                />
                <text x="608" y="63" className="park-label">
                  KARURA FOREST
                </text>
              </>
            )}
            {inNairobi &&
              labels.map(([name, lat, lng]) => {
                const [x, y] = project({ lat, lng });
                return (
                  <text
                    key={name}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="map-label"
                  >
                    {name}
                  </text>
                );
              })}
            {result?.routes
              .filter((r) => r.stops.length)
              .map((r) => {
                const points = [scenario.depot, ...r.stops, scenario.depot].map(
                  project,
                );
                return (
                  <g
                    key={r.vehicle.id}
                    opacity={!selected || selected === r.vehicle.id ? 1 : 0.16}
                  >
                    <polyline
                      points={points.map((p) => p.join(",")).join(" ")}
                      stroke="white"
                      strokeWidth="8"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <polyline
                      points={points.map((p) => p.join(",")).join(" ")}
                      stroke={r.vehicle.color}
                      strokeWidth="3.3"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                      fill="none"
                    />
                  </g>
                );
              })}
            {scenario.deliveries.map((d) => {
              const [x, y] = project(d),
                route = assigned.get(d.id),
                color = route?.color ?? "#6b766d";
              return (
                <g
                  key={d.id}
                  transform={`translate(${x},${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${d.name}, ${d.weight} kilograms${route ? `, stop ${route.sequence}` : ""}`}
                  onClick={() => onDelivery(d)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onDelivery(d);
                    }
                  }}
                  className="map-pin"
                  opacity={
                    !selected || !route || selected === route.vehicle ? 1 : 0.35
                  }
                >
                  <title>
                    {d.name} · {d.address} · {d.lat}, {d.lng}
                  </title>
                  <circle
                    r="14"
                    fill={color}
                    stroke="white"
                    strokeWidth="3"
                    filter="url(#pin-shadow)"
                  />
                  <text
                    y="4"
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {route?.sequence ?? "·"}
                  </text>
                </g>
              );
            })}
            <g transform={`translate(${depot[0]},${depot[1]})`}>
              <circle r="25" fill="#c8ea92" opacity=".45" />
              <rect
                x="-14"
                y="-14"
                width="28"
                height="28"
                rx="8"
                fill="#183a2d"
                stroke="white"
                strokeWidth="3"
              />
              <path
                d="M-6 6V-3L0 -7L6 -3V6H-6M-2 6V1H2V6"
                fill="none"
                stroke="#d3efa8"
                strokeWidth="1.7"
              />
              <title>{scenario.depot.name}</title>
            </g>
          </g>
        </svg>
        <div className="map-tools">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((v) => Math.min(2.2, v + 0.2))}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((v) => Math.max(0.8, v - 0.2))}
          >
            <Minus size={18} />
          </button>
          <button aria-label="Fit delivery area" onClick={() => setZoom(1)}>
            <LocateFixed size={18} />
          </button>
        </div>
        <span className="compass">
          <Navigation size={16} /> N
        </span>
      </div>
      <div className="map-bottom">
        <div className="map-legend">
          <button
            className={!selected ? "chosen" : ""}
            onClick={() => onRoute(null)}
          >
            All routes
          </button>
          {scenario.vehicles
            .filter((v) => v.active)
            .map((v) => (
              <button
                key={v.id}
                className={selected === v.id ? "chosen" : ""}
                onClick={() => onRoute(selected === v.id ? null : v.id)}
              >
                <i style={{ background: v.color }} />
                {v.name}
              </button>
            ))}
        </div>
        <small>Estimated connections · not turn-by-turn directions</small>
      </div>
    </section>
  );
}
