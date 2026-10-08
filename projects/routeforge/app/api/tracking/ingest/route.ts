import { checkOrigin } from "../../../../lib/api";
import {
  trackingPayload,
  trackingResponse,
  trackingFailure,
  validateBatch,
} from "../../../../lib/tracking";
import {
  authenticateDevice,
  ingestEvents,
} from "../../../../lib/tracking-store";
export async function POST(request: Request) {
  const origin = checkOrigin(request);
  if (origin) return origin;
  try {
    const device = await authenticateDevice(request);
    const events = validateBatch(await trackingPayload(request));
    return trackingResponse(await ingestEvents(device, events));
  } catch (e) {
    return trackingFailure(e);
  }
}
