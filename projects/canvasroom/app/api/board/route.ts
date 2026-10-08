import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { boards, snapshots } from "../../../db/schema";
import { boardSchema, sanitizeBoard } from "../../../lib/canvas";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to load your private board." }, { status: 401, headers });
  const db = getDb();
  const [[board], history] = await Promise.all([
    db.select().from(boards).where(eq(boards.ownerId, user.userId)),
    db.select().from(snapshots).where(eq(snapshots.ownerId, user.userId)).orderBy(desc(snapshots.createdAt)).limit(20),
  ]);
  return Response.json({
    board: board ? JSON.parse(board.contentJson) : null,
    revision: board?.revision ?? 0,
    snapshots: history.map((snapshot) => ({ id: snapshot.id, name: snapshot.name, board: JSON.parse(snapshot.contentJson), createdAt: snapshot.createdAt })),
  }, { headers });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Use CanvasRoom to save boards." }, { status: 403, headers });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to save a private board." }, { status: 401, headers });
  try {
    const raw = await request.text();
    if (raw.length > 300_000) return Response.json({ error: "This board is too large." }, { status: 413, headers });
    const input = JSON.parse(raw) as { board?: unknown; revision?: unknown; snapshotName?: unknown };
    const parsed = boardSchema.safeParse(input.board);
    if (!parsed.success || !Number.isInteger(input.revision) || Number(input.revision) < 0) return Response.json({ error: parsed.error?.issues[0]?.message ?? "Include a valid board revision." }, { status: 400, headers });
    const board = sanitizeBoard(parsed.data);
    const db = getDb();
    const [current] = await db.select().from(boards).where(eq(boards.ownerId, user.userId));
    const expected = Number(input.revision);
    if ((current?.revision ?? 0) !== expected) return Response.json({ error: "A newer board exists. Reload before saving." }, { status: 409, headers });
    const revision = expected + 1;
    const values = { contentJson: JSON.stringify(board), revision, updatedAt: Date.now() };
    const changed = current
      ? await db.update(boards).set(values).where(and(eq(boards.ownerId, user.userId), eq(boards.revision, expected))).returning({ id: boards.ownerId })
      : await db.insert(boards).values({ ownerId: user.userId, ...values }).onConflictDoNothing().returning({ id: boards.ownerId });
    if (!changed.length) return Response.json({ error: "Another save finished first. Reload before saving." }, { status: 409, headers });
    let snapshot = null;
    if (typeof input.snapshotName === "string" && input.snapshotName.trim()) {
      const name = input.snapshotName.replace(/[<>]/g, "").trim().slice(0, 80), createdAt = Date.now(), id = crypto.randomUUID();
      await db.insert(snapshots).values({ id, ownerId: user.userId, name, contentJson: JSON.stringify(board), createdAt });
      snapshot = { id, name, board, createdAt };
    }
    return Response.json({ revision, snapshot }, { status: current ? 200 : 201, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Send valid JSON." }, { status: 400, headers });
    console.error("CanvasRoom save failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "The board could not be saved. Try again." }, { status: 500, headers });
  }
}
