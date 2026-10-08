import { officeOwner } from "./accounts";
export async function currentOwner() {
  return officeOwner();
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "This request must come from RouteForge." },
      { status: 403 },
    );
  return null;
}
export async function readPayload(request: Request) {
  const raw = await request.text();
  if (raw.length > 120000) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(raw);
}
export function apiError(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json(
      { error: "Send a valid JSON request." },
      { status: 400 },
    );
  if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")
    return Response.json({ error: "This plan is too large." }, { status: 413 });
  console.error(
    "RouteForge request failed",
    error instanceof Error ? error.message : "Unknown failure",
  );
  return Response.json(
    { error: "We could not complete this action. Please try again." },
    { status: 500 },
  );
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
