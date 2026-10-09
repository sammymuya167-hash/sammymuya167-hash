import { legacyMutationPermission } from "../../../../lib/network-access";
import { currentOwner, checkOrigin } from "../../../../lib/api";
import {
  trackingPayload,
  trackingResponse,
  trackingFailure,
  TrackingError,
} from "../../../../lib/tracking";
import {
  listDevices,
  createDevice,
  changeDevice,
} from "../../../../lib/tracking-store";
import { listDispatches } from "../../../../lib/dispatch-store";
import { fleetAlerts } from "../../../../lib/dispatch";
export async function GET() {
  try {
    const owner = await currentOwner();
    if (!owner)
      throw new TrackingError(401, "Sign in to manage driver devices.");
    const [devices,dispatches] = await Promise.all([listDevices(owner),listDispatches(owner)]);
    return trackingResponse({
      devices,
      dispatches,
      alerts: fleetAlerts(devices,dispatches),
      serverTime: Date.now(),
    });
  } catch (e) {
    return trackingFailure(e);
  }
}
async function mutate(request: Request, change: boolean) {
  const origin = checkOrigin(request);
  if (origin) return origin;
  try {
    const owner = await currentOwner();
    if (!owner)
      throw new TrackingError(401, "Sign in to manage driver devices.");
    await legacyMutationPermission(request);
    const body = await trackingPayload(request);
    return trackingResponse(
      await (change ? changeDevice(owner, body) : createDevice(owner, body)),
      change ? 200 : 201,
    );
  } catch (e) {
    return trackingFailure(e);
  }
}
export async function POST(request: Request) {
  return mutate(request, false);
}
export async function PATCH(request: Request) {
  return mutate(request, true);
}
