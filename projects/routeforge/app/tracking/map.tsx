/* eslint-disable @next/next/no-img-element -- Raster map tiles require direct browser requests, Referer and normal HTTP caching. */
"use client";
import { useEffect, useRef, useState } from "react";
import type { TrackingEvent } from "../../lib/tracking";
type Point = Extract<TrackingEvent, { kind: "point" }>;
function project(lat: number, lng: number) {
  const phi = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2,
  };
}
export default function JourneyMap({
  points,
  latest,
}: {
  points: Point[];
  latest: Point | null;
}) {
  const el = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 760, h: 440 }),
    [zoomDelta, setZoomDelta] = useState(0);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const o = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    o.observe(node);
    return () => o.disconnect();
  }, []);
  const route =
    latest && !points.some((p) => p.eventId === latest.eventId)
      ? [...points, latest].sort((a, b) => a.recordedAt - b.recordedAt)
      : points;
  const projected = route.map((p) => ({
    ...project(p.lat, p.lng),
    tripId: p.tripId,
    point: p,
  }));
  const center = projected.length
    ? {
        x:
          (Math.min(...projected.map((p) => p.x)) +
            Math.max(...projected.map((p) => p.x))) /
          2,
        y:
          (Math.min(...projected.map((p) => p.y)) +
            Math.max(...projected.map((p) => p.y))) /
          2,
      }
    : project(-1.2864, 36.8172);
  const rangeX = projected.length
    ? Math.max(...projected.map((p) => p.x)) -
      Math.min(...projected.map((p) => p.x))
    : 0.006;
  const rangeY = projected.length
    ? Math.max(...projected.map((p) => p.y)) -
      Math.min(...projected.map((p) => p.y))
    : 0.006;
  const fitted =
    projected.length === 1
      ? 15
      : Math.floor(
          Math.log2(
            Math.min(
              (size.w - 100) / (256 * Math.max(rangeX, 0.00005)),
              (size.h - 100) / (256 * Math.max(rangeY, 0.00005)),
            ),
          ),
        );
  const z = Math.max(2, Math.min(18, fitted + zoomDelta)),
    tiles = 2 ** z,
    world = tiles * 256,
    left = center.x * world - size.w / 2,
    top = center.y * world - size.h / 2;
  const tileImages = [];
  for (
    let x = Math.floor(left / 256);
    x <= Math.floor((left + size.w) / 256);
    x++
  )
    for (
      let y = Math.floor(top / 256);
      y <= Math.floor((top + size.h) / 256);
      y++
    ) {
      if (y < 0 || y >= tiles) continue;
      tileImages.push({
        key: z + "-" + x + "-" + y,
        x,
        y,
        url: `https://tile.openstreetmap.org/${z}/${((x % tiles) + tiles) % tiles}/${y}.png`,
      });
    }
  const path: string[] = [];
  let previous = "";
  for (const p of projected) {
    path.push(
      (p.tripId === previous ? "L" : "M") +
        (p.x * world - left).toFixed(2) +
        "," +
        (p.y * world - top).toFixed(2),
    );
    previous = p.tripId;
  }
  const first = projected[0],
    last = projected.at(-1);
  return (
    <div
      ref={el}
      className="journey-map"
      aria-label={
        route.length ? "GPS journey map" : "Map awaiting driver locations"
      }
    >
      {tileImages.map((t) => (
        <img
          key={t.key}
          src={t.url}
          width={256}
          height={256}
          alt=""
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            position: "absolute",
            left: t.x * 256 - left,
            top: t.y * 256 - top,
          }}
        />
      ))}
      <svg
        width={size.w}
        height={size.h}
        className="journey-overlay"
        aria-hidden="true"
      >
        <path
          d={path.join(" ")}
          fill="none"
          stroke="#ffffff"
          strokeWidth={8}
          strokeLinejoin="round"
        />
        <path
          d={path.join(" ")}
          fill="none"
          stroke="#276744"
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {first && (
          <circle
            cx={first.x * world - left}
            cy={first.y * world - top}
            r={6}
            fill="#fff"
            stroke="#276744"
            strokeWidth={3}
          />
        )}
        {last && (
          <g>
            <circle
              cx={last.x * world - left}
              cy={last.y * world - top}
              r={14}
              fill="#c5ec95"
              opacity={0.7}
            />
            <circle
              cx={last.x * world - left}
              cy={last.y * world - top}
              r={7}
              fill="#214e38"
              stroke="white"
              strokeWidth={3}
            />
          </g>
        )}
      </svg>
      <div className="map-zoom">
        <button
          aria-label="Zoom in"
          onClick={() => setZoomDelta((d) => Math.min(8, d + 1))}
        >
          +
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoomDelta((d) => Math.max(-8, d - 1))}
        >
          −
        </button>
        <button onClick={() => setZoomDelta(0)}>Fit</button>
      </div>
      {!route.length && (
        <div className="map-empty">The first GPS fix will appear here.</div>
      )}
      <a
        className="osm-credit"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
