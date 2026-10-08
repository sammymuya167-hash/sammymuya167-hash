import { currentOwner } from "../../../../lib/api";
import {
  trackingResponse,
  trackingFailure,
  TrackingError,
} from "../../../../lib/tracking";
import { history } from "../../../../lib/tracking-store";
export async function GET(request: Request) {
  try {
    const owner = await currentOwner();
    if (!owner) throw new TrackingError(401, "Sign in to view journeys.");
    return trackingResponse(await history(owner, new URL(request.url)));
  } catch (e) {
    return trackingFailure(e);
  }
}
