import { optimize } from "../../../lib/optimizer";
import { scenarioSchema } from "../../../lib/validation";
import { getDb } from "../../../db";
import { runs } from "../../../db/schema";
import {
  apiError,
  checkOrigin,
  currentOwner,
  privateHeaders,
  readPayload,
} from "../../../lib/api";
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const owner = await currentOwner();
  if (!owner)
    return Response.json(
      { error: "Sign in with ChatGPT to optimize and save runs." },
      { status: 401 },
    );
  try {
    const parsed = scenarioSchema.safeParse(await readPayload(request));
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check your plan." },
        { status: 400 },
      );
    const result = optimize(parsed.data);
    const id = crypto.randomUUID();
    await getDb()
      .insert(runs)
      .values({
        id,
        ownerId: owner,
        name: parsed.data.name,
        scenarioJson: JSON.stringify(parsed.data),
        resultJson: JSON.stringify(result),
        createdAt: Date.now(),
      });
    return Response.json({ result, runId: id }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
