import { checkOrigin } from "../../../../lib/api";
import {
  trackingPayload,
  trackingResponse,
  trackingFailure,
} from "../../../../lib/tracking";
import { pairDevice } from "../../../../lib/tracking-store";
export async function POST(request: Request) {
  const origin = checkOrigin(request);
  if (origin) return origin;
  try {
    return trackingResponse(await pairDevice(await trackingPayload(request)));
  } catch (e) {
    return trackingFailure(e);
  }
}
