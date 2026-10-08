export type MapCenter = { x: number; y: number };
export type MapView = MapCenter & { zoom: number };
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 19;
export function projectLocation(lat: number, lng: number): MapCenter {
  const phi = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180;
  return { x: (lng + 180) / 360, y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 };
}
export function unprojectLocation(center:MapCenter){
  return {lat:Math.atan(Math.sinh(Math.PI*(1-2*center.y)))*180/Math.PI,lng:((center.x*360-180+180)%360+360)%360-180};
}
export function panView(view: MapView, dx: number, dy: number): MapView {
  const world = 256 * 2 ** view.zoom;
  return { ...view, x: view.x - dx / world, y: Math.max(0, Math.min(1, view.y - dy / world)) };
}
// Keep the geographic point under a mouse/finger fixed as the scale changes.
export function zoomView(view: MapView, zoom: number, anchor = { x: 0, y: 0 }): MapView {
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const before = 256 * 2 ** view.zoom, after = 256 * 2 ** next;
  return { x: view.x + anchor.x / before - anchor.x / after, y: Math.max(0, Math.min(1, view.y + anchor.y / before - anchor.y / after)), zoom: next };
}
export function fitView(points: MapCenter[], size: { w: number; h: number }): MapView {
  if (!points.length) return { ...projectLocation(-1.2864, 36.8172), zoom: 12 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const zoom = points.length === 1 ? 17 : Math.floor(Math.log2(Math.min(Math.max(80, size.w - 120) / (256 * Math.max(x1 - x0, .000005)), Math.max(80, size.h - 120) / (256 * Math.max(y1 - y0, .000005)))));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) };
}
