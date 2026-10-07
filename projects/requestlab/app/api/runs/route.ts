import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { runs } from "../../../db/schema";
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  summary: z
    .array(
      z.object({
        name: z.string().max(80),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
        status: z.number().int().min(0).max(599),
        durationMs: z.number().min(0).max(120000),
        passed: z.number().int().min(0).max(20),
        total: z.number().int().min(0).max(20),
        failed: z.boolean(),
      }),
    )
    .min(1)
    .max(40),
});
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Use RequestLab to record a run." },
      { status: 403, headers },
    );
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to record runs." },
      { status: 401, headers },
    );
  try {
    const raw = await request.text();
    if (raw.length > 24000)
      return Response.json(
        { error: "Run summary is too large." },
        { status: 413, headers },
      );
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.summary.some((s) => s.passed > s.total))
      return Response.json(
        { error: "Check the run summary." },
        { status: 400, headers },
      );
    const id = crypto.randomUUID(),
      createdAt = Date.now();
    await getDb()
      .insert(runs)
      .values({
        id,
        ownerId: user.userId,
        collectionName: parsed.data.name,
        summaryJson: JSON.stringify(parsed.data.summary),
        createdAt,
      });
    return Response.json({ id, createdAt }, { status: 201, headers });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "Send valid JSON." },
        { status: 400, headers },
      );
    console.error(
      "RequestLab history failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Run history could not be saved." },
      { status: 500, headers },
    );
  }
}
