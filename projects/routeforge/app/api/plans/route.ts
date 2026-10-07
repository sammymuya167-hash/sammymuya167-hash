import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { plans, runs } from "../../../db/schema";
import { optimize } from "../../../lib/optimizer";
import { scenarioSchema } from "../../../lib/validation";
import {
  apiError,
  checkOrigin,
  currentOwner,
  privateHeaders,
  readPayload,
} from "../../../lib/api";
export async function GET() {
  const owner = await currentOwner();
  if (!owner)
    return Response.json(
      { error: "Sign in to see your saved plans." },
      { status: 401 },
    );
  try {
    const db = getDb();
    const [saved, recent] = await Promise.all([
      db
        .select()
        .from(plans)
        .where(eq(plans.ownerId, owner))
        .orderBy(desc(plans.updatedAt))
        .limit(100),
      db
        .select()
        .from(runs)
        .where(eq(runs.ownerId, owner))
        .orderBy(desc(runs.createdAt))
        .limit(15),
    ]);
    return Response.json(
      {
        plans: saved.map((row) => ({
          id: row.id,
          name: row.name,
          scenario: JSON.parse(row.scenarioJson),
          result: JSON.parse(row.resultJson),
          updatedAt: row.updatedAt,
          archivedAt: row.archivedAt,
        })),
        runs: recent.map((row) => ({
          id: row.id,
          name: row.name,
          scenario: JSON.parse(row.scenarioJson),
          result: JSON.parse(row.resultJson),
          createdAt: row.createdAt,
        })),
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const owner = await currentOwner();
  if (!owner)
    return Response.json(
      { error: "Sign in to save your plan." },
      { status: 401 },
    );
  try {
    const payload = await readPayload(request);
    if (!payload || typeof payload !== "object")
      return Response.json({ error: "Send a plan object." }, { status: 400 });
    const parsed = scenarioSchema.safeParse(payload.scenario);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check your plan." },
        { status: 400 },
      );
    const db = getDb();
    const id =
      typeof payload.id === "string" ? payload.id : crypto.randomUUID();
    const row = {
      id,
      ownerId: owner,
      name: parsed.data.name,
      scenarioJson: JSON.stringify(parsed.data),
      resultJson: JSON.stringify(optimize(parsed.data)),
      updatedAt: Date.now(),
      archivedAt: null,
    };
    if (payload.id) {
      const changed = await db
        .update(plans)
        .set({
          name: row.name,
          scenarioJson: row.scenarioJson,
          resultJson: row.resultJson,
          updatedAt: row.updatedAt,
        })
        .where(and(eq(plans.id, id), eq(plans.ownerId, owner)))
        .returning({ id: plans.id });
      if (!changed.length)
        return Response.json({ error: "Plan not found." }, { status: 404 });
    } else await db.insert(plans).values(row);
    return Response.json(
      { id },
      { status: payload.id ? 200 : 201, headers: privateHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const owner = await currentOwner();
  if (!owner)
    return Response.json(
      { error: "Sign in to change your plans." },
      { status: 401 },
    );
  try {
    const payload = await readPayload(request);
    if (
      !payload ||
      typeof payload.id !== "string" ||
      typeof payload.archived !== "boolean"
    )
      return Response.json(
        { error: "Choose a plan and archive state." },
        { status: 400 },
      );
    const changed = await getDb()
      .update(plans)
      .set({ archivedAt: payload.archived ? Date.now() : null })
      .where(and(eq(plans.id, payload.id), eq(plans.ownerId, owner)))
      .returning({ id: plans.id });
    if (!changed.length)
      return Response.json({ error: "Plan not found." }, { status: 404 });
    return Response.json({ ok: true }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
