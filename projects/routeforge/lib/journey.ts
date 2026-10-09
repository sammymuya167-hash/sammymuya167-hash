import type { GPSPoint } from "./dispatch";

const distance = (a: GPSPoint, b: GPSPoint) => {
  const r = Math.PI / 180, n = Math.sin((b.lat-a.lat)*r/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;
  return 12742000*Math.atan2(Math.sqrt(n),Math.sqrt(Math.max(0,1-n)));
};

/** Display measured fixes without inventing movement through missing GPS.
 * Raw, timestamped events remain unchanged in the server and export.
 * Keep turns; suppress uncertainty-sized jitter and isolated impossible jumps.
 */
export function journeySegments(points: GPSPoint[]): GPSPoint[][] {
  const ordered = [...new Map(points.map(p => [p.eventId,p])).values()].sort((a,b)=>a.recordedAt-b.recordedAt);
  const segments: GPSPoint[][] = []; let anchor: GPSPoint | null = null;
  for (const p of ordered) {
    if (![p.lat,p.lng,p.accuracy,p.recordedAt].every(Number.isFinite) || Math.abs(p.lat)>90 || Math.abs(p.lng)>180 || p.accuracy<0 || p.accuracy>50) continue;
    const gap = anchor ? p.recordedAt-anchor.recordedAt : 0;
    if (!anchor || anchor.tripId!==p.tripId || gap>120000) { segments.push([p]); anchor=p; continue; }
    if (gap<=0) continue;
    const metres=distance(anchor,p);
    if (metres>55*gap/1000+anchor.accuracy+p.accuracy) continue;
    if (metres<Math.max(3,Math.min(10,Math.min(anchor.accuracy,p.accuracy)*.35))) continue;
    segments[segments.length-1].push(p); anchor=p;
  }
  return segments;
}
