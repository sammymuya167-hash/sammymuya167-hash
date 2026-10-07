import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { runs, workspaces } from "../../../db/schema";
import { sanitizeWorkspace, workspaceSchema } from "../../../lib/lab";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to load your collections." },
      { status: 401, headers },
    );
  const db = getDb();
  const [[row], history] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.ownerId, user.userId)),
    db
      .select()
      .from(runs)
      .where(eq(runs.ownerId, user.userId))
      .orderBy(desc(runs.createdAt))
      .limit(30),
  ]);
  return Response.json(
    {
      workspace: row ? JSON.parse(row.contentJson) : null,
      revision: row?.revision ?? 0,
      runs: history.map((r) => ({
        id: r.id,
        name: r.collectionName,
        summary: JSON.parse(r.summaryJson),
        createdAt: r.createdAt,
      })),
    },
    { headers },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Use RequestLab to save collections." },
      { status: 403, headers },
    );
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your collections." },
      { status: 401, headers },
    );
  try {
    const raw = await request.text();
    if (raw.length > 220000)
      return Response.json(
        { error: "This workspace is too large." },
        { status: 413, headers },
      );
    const input = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input))
      return Response.json(
        { error: "Send a workspace object." },
        { status: 400, headers },
      );
    const parsed = workspaceSchema.safeParse(input.workspace);
    if (
      !parsed.success ||
      !Number.isInteger(input.revision) ||
      input.revision < 0
    )
      return Response.json(
        {
          error:
            parsed.error?.issues[0]?.message ??
            "Include a valid workspace revision.",
        },
        { status: 400, headers },
      );
    const workspace = sanitizeWorkspace(parsed.data),
      db = getDb(),
      revision = input.revision + 1;
    const [row] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.userId));
    if ((row?.revision ?? 0) !== input.revision)
      return Response.json(
        { error: "A newer version exists. Reload before saving." },
        { status: 409, headers },
      );
    const values = {
      contentJson: JSON.stringify(workspace),
      revision,
      updatedAt: Date.now(),
    };
    const changed = row
      ? await db
          .update(workspaces)
          .set(values)
          .where(
            and(
              eq(workspaces.ownerId, user.userId),
              eq(workspaces.revision, input.revision),
            ),
          )
          .returning({ id: workspaces.ownerId })
      : await db
          .insert(workspaces)
          .values({ ownerId: user.userId, ...values })
          .onConflictDoNothing()
          .returning({ id: workspaces.ownerId });
    if (!changed.length)
      return Response.json(
        { error: "Another save finished first. Reload before saving." },
        { status: 409, headers },
      );
    return Response.json({ revision }, { status: row ? 200 : 201, headers });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "Send valid JSON." },
        { status: 400, headers },
      );
    console.error(
      "RequestLab save failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "Collections could not be saved. Try again." },
      { status: 500, headers },
    );
  }
}
