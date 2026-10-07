import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { workspaces } from "../../../db/schema";
import {
  actionSchema,
  applyAction,
  BoardError,
  type Board,
} from "../../../lib/board";
import { demoBoard } from "../../../lib/demo";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to load your workspace." },
      { status: 401, headers },
    );
  const [row] = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.userId));
  return Response.json(
    {
      board: row ? JSON.parse(row.boardJson) : null,
      revision: row?.revision ?? 0,
    },
    { headers },
  );
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { error: "Use the SprintForge workspace to make changes." },
      { status: 403, headers },
    );
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "Sign in to save your workspace." },
      { status: 401, headers },
    );
  try {
    const text = await request.text();
    if (text.length > 24000)
      return Response.json(
        { error: "This request is too large." },
        { status: 413, headers },
      );
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input))
      return Response.json(
        { error: "Send an action object." },
        { status: 400, headers },
      );
    if (!Number.isInteger(input.revision) || input.revision < 0)
      return Response.json(
        { error: "Include the workspace revision." },
        { status: 400, headers },
      );
    const parsed = actionSchema.safeParse(input.action);
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check this action." },
        { status: 400, headers },
      );
    const db = getDb();
    const [row] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, user.userId));
    if ((row?.revision ?? 0) !== input.revision)
      return Response.json(
        {
          error:
            "This workspace changed in another tab. Reload it before trying again.",
        },
        { status: 409, headers },
      );
    const board = applyAction(
      row ? (JSON.parse(row.boardJson) as Board) : demoBoard(),
      parsed.data,
    );
    const revision = input.revision + 1,
      updatedAt = Date.now();
    if (row) {
      const result = await db
        .update(workspaces)
        .set({ boardJson: JSON.stringify(board), revision, updatedAt })
        .where(
          and(
            eq(workspaces.ownerId, user.userId),
            eq(workspaces.revision, input.revision),
          ),
        )
        .returning({ ownerId: workspaces.ownerId });
      if (!result.length)
        return Response.json(
          { error: "Another update finished first. Reload your workspace." },
          { status: 409, headers },
        );
    } else {
      const inserted = await db
        .insert(workspaces)
        .values({
          ownerId: user.userId,
          boardJson: JSON.stringify(board),
          revision,
          updatedAt,
        })
        .onConflictDoNothing()
        .returning({ ownerId: workspaces.ownerId });
      if (!inserted.length)
        return Response.json(
          { error: "Another update finished first. Reload your workspace." },
          { status: 409, headers },
        );
    }
    return Response.json(
      { board, revision },
      { status: row ? 200 : 201, headers },
    );
  } catch (error) {
    if (error instanceof BoardError || error instanceof SyntaxError)
      return Response.json({ error: error.message }, { status: 400, headers });
    console.error(
      "SprintForge save failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json(
      { error: "The workspace could not be saved. Please try again." },
      { status: 500, headers },
    );
  }
}
