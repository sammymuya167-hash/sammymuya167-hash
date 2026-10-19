import { demoBot, demoKnowledge } from "../lib/demo";
import { chunkText, retrieve, buildPrompt } from "../lib/rag";
import { sse } from "../lib/sse";
import type { Bot, User } from "../lib/contracts";
import {
  generate,
  memoryWindow,
  providerInfo,
  type ProviderConfig,
} from "./provider";
import {
  HttpError,
  requireValue,
  digest,
  passwordHash,
  passwordMatches,
  readJSON,
  stringField,
  securityHeaders,
} from "./security";
export type AppEnv = Pick<Cloudflare.Env, "DB"> & ProviderConfig;
const cookieName = "__Host-shadowbot";
const now = () => Date.now();
const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
const safeBot = (b: Bot, owner = false) => {
  const { system_prompt, owner_id, ...publicFields } = b;
  return owner ? b : publicFields;
};
async function userFor(req: Request, db: D1Database): Promise<User | null> {
  const cookie = req.headers
    .get("Cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!cookie || !/^[a-f0-9]{64}$/.test(cookie)) return null;
  return db
    .prepare(
      "SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await digest(cookie), now())
    .first<User>();
}
async function requireUser(req: Request, db: D1Database) {
  const u = await userFor(req, db);
  requireValue(u, 401, "Sign in to continue.");
  return u;
}
async function rate(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
) {
  const n = now();
  const window = Math.floor(n / windowMs);
  const row = await db
    .prepare(
      "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<? RETURNING count",
    )
    .bind(`${key}:${window}`, n + windowMs * 2, limit)
    .first<{ count: number }>();
  requireValue(row, 429, "Usage limit reached. Please try again later.");
}
async function authCookie(db: D1Database, userId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  await db
    .prepare(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)",
    )
    .bind(await digest(token), userId, now() + 7 * 86400000)
    .run();
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}
async function botFor(
  db: D1Database,
  id: string,
  user: User | null,
  ownerOnly = false,
): Promise<Bot> {
  if (id === demoBot.id && !ownerOnly) return demoBot;
  const bot = await db
    .prepare("SELECT * FROM bots WHERE id=?")
    .bind(id)
    .first<Bot>();
  requireValue(
    bot &&
      ((user && bot.owner_id === user.id) ||
        (!ownerOnly && bot.is_public === 1)),
    404,
    "Bot not found or access is private.",
  );
  return bot;
}
function botFields(data: Record<string, unknown>) {
  const name = stringField(data, "name", 70);
  const description = stringField(data, "description", 240, 0);
  const systemPrompt = stringField(data, "system_prompt", 6000);
  const greeting = stringField(data, "greeting", 500);
  const color = stringField(data, "color", 10);
  requireValue(
    ["purple", "green", "blue", "orange"].includes(color),
    400,
    "Choose a supported color.",
  );
  requireValue(
    typeof data.is_public === "boolean",
    400,
    "is_public must be a boolean.",
  );
  return {
    name,
    description,
    systemPrompt,
    greeting,
    color,
    isPublic: data.is_public ? 1 : 0,
  };
}
async function route(
  req: Request,
  env: AppEnv,
  ctx: ExecutionContext,
): Promise<Response> {
  requireValue(env.DB, 503, "Database is not configured.");
  const db = env.DB;
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = req.method;
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method))
    throw new HttpError(405, "Method not allowed.");
  if (method !== "GET") {
    requireValue(
      req.headers.get("Origin") === url.origin,
      403,
      "Request origin is not allowed.",
    );
    requireValue(
      req.headers.get("Sec-Fetch-Site") !== "cross-site",
      403,
      "Cross-site requests are not allowed.",
    );
  }
  if (path === "/api/health" && method === "GET") {
    await db.prepare("SELECT 1").first();
    return json({ ok: true, version: "1.0.0", ai: providerInfo(env).ready });
  }
  if (path === "/api/auth/signup" && method === "POST") {
    await rate(
      db,
      "signup:" +
        (await digest(req.headers.get("CF-Connecting-IP") || "local")),
      8,
      3600000,
    );
    const data = await readJSON(req, 12000);
    const email = stringField(data, "email", 254).toLowerCase();
    requireValue(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      400,
      "Enter a valid email address.",
    );
    const name = stringField(data, "name", 60);
    const pass = stringField(data, "password", 128, 12);
    const id = crypto.randomUUID();
    try {
      await db
        .prepare(
          "INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(id, email, name, await passwordHash(pass), now())
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new HttpError(409, "An account with this email already exists.");
      throw e;
    }
    return json({ user: { id, email, name } }, 201, {
      "Set-Cookie": await authCookie(db, id),
    });
  }
  if (path === "/api/auth/login" && method === "POST") {
    const data = await readJSON(req, 12000);
    const email = stringField(data, "email", 254).toLowerCase();
    const pass = stringField(data, "password", 128, 1);
    await rate(
      db,
      "login-ip:" +
        (await digest(req.headers.get("CF-Connecting-IP") || "local")),
      30,
      900000,
    );
    await rate(db, "login-email:" + (await digest(email)), 10, 900000);
    const user = await db
      .prepare("SELECT * FROM users WHERE email=?")
      .bind(email)
      .first<User & { password_hash: string }>();
    const hash =
      user?.password_hash ||
      "pbkdf2-sha256$100000$0123456789abcdef0123456789abcdef$0000000000000000000000000000000000000000000000000000000000000000";
    const valid = await passwordMatches(pass, hash);
    requireValue(user && valid, 401, "Email or password is incorrect.");
    return json(
      { user: { id: user.id, name: user.name, email: user.email } },
      200,
      { "Set-Cookie": await authCookie(db, user.id) },
    );
  }
  if (path === "/api/auth/logout" && method === "POST") {
    const user = await userFor(req, db);
    if (user) {
      const token = req.headers
        .get("Cookie")
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(cookieName + "="))
        ?.slice(cookieName.length + 1);
      if (token)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await digest(token))
          .run();
    }
    return json({ ok: true }, 200, {
      "Set-Cookie": `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    });
  }
  if (path === "/api/bootstrap" && method === "GET") {
    const user = await userFor(req, db);
    const publicBots = await db
      .prepare(
        "SELECT id,name,description,greeting,color,is_public FROM bots WHERE is_public=1 ORDER BY updated_at DESC LIMIT 50",
      )
      .all<Bot>();
    const owned = user
      ? (
          await db
            .prepare(
              "SELECT b.*, (SELECT COUNT(*) FROM documents d WHERE d.bot_id=b.id) document_count,(SELECT COUNT(*) FROM conversations c WHERE c.bot_id=b.id) conversation_count FROM bots b WHERE owner_id=? ORDER BY updated_at DESC",
            )
            .bind(user.id)
            .all<Bot>()
        ).results
      : [];
    const history = user
      ? (
          await db
            .prepare(
              "SELECT c.*,COALESCE(b.name,?) bot_name,COALESCE(b.color,?) color FROM conversations c LEFT JOIN bots b ON c.bot_id=b.id WHERE c.user_id=? ORDER BY c.updated_at DESC LIMIT 100",
            )
            .bind(demoBot.name, demoBot.color, user.id)
            .all()
        ).results
      : [];
    return json({
      user,
      publicBots: [safeBot(demoBot), ...publicBots.results],
      bots: owned,
      conversations: history,
      provider: providerInfo(env),
    });
  }
  if (path === "/api/bots" && method === "POST") {
    const user = await requireUser(req, db);
    const f = botFields(await readJSON(req, 15000));
    const id = crypto.randomUUID();
    const n = now();
    const result = await db
      .prepare(
        "INSERT INTO bots (id,owner_id,name,description,system_prompt,greeting,color,is_public,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM bots WHERE owner_id=?)<20",
      )
      .bind(
        id,
        user.id,
        f.name,
        f.description,
        f.systemPrompt,
        f.greeting,
        f.color,
        f.isPublic,
        n,
        n,
        user.id,
      )
      .run();
    requireValue(result.meta.changes, 409, "You can create up to 20 bots.");
    return json({ bot: await botFor(db, id, user) }, 201);
  }
  const botMatch = path.match(/^\/api\/bots\/([^/]+)$/);
  if (botMatch) {
    const user = await userFor(req, db);
    const bot = await botFor(db, botMatch[1], user, method !== "GET");
    if (method === "GET")
      return json({
        bot: safeBot(bot, bot.owner_id === user?.id),
        owner: bot.owner_id === user?.id,
      });
    requireValue(user, 401, "Sign in to continue.");
    if (method === "PATCH") {
      const f = botFields(await readJSON(req, 15000));
      await db
        .prepare(
          "UPDATE bots SET name=?,description=?,system_prompt=?,greeting=?,color=?,is_public=?,updated_at=? WHERE id=? AND owner_id=?",
        )
        .bind(
          f.name,
          f.description,
          f.systemPrompt,
          f.greeting,
          f.color,
          f.isPublic,
          now(),
          bot.id,
          user.id,
        )
        .run();
      return json({ bot: await botFor(db, bot.id, user) });
    }
    if (method === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM conversations WHERE bot_id=?").bind(bot.id),
        db
          .prepare("DELETE FROM bots WHERE id=? AND owner_id=?")
          .bind(bot.id, user.id),
      ]);
      return json({ ok: true });
    }
  }
  const docMatch = path.match(
    /^\/api\/bots\/([^/]+)\/documents(?:\/([^/]+))?$/,
  );
  if (docMatch) {
    const user = await requireUser(req, db);
    const bot = await botFor(db, docMatch[1], user, true);
    if (method === "GET" && !docMatch[2])
      return json({
        documents: (
          await db
            .prepare(
              "SELECT id,name,bytes,chunk_count,created_at FROM documents WHERE bot_id=? ORDER BY created_at DESC",
            )
            .bind(bot.id)
            .all()
        ).results,
      });
    if (method === "DELETE" && docMatch[2]) {
      const result = await db
        .prepare("DELETE FROM documents WHERE id=? AND bot_id=?")
        .bind(docMatch[2], bot.id)
        .run();
      requireValue(result.meta.changes, 404, "Document not found.");
      return json({ ok: true });
    }
    if (method === "POST" && !docMatch[2]) {
      const data = await readJSON(req);
      const name = stringField(data, "name", 120);
      requireValue(
        /\.(txt|md|markdown)$/i.test(name) && !/[\x00-\x1f]/.test(name),
        400,
        "Use a .txt or .md file.",
      );
      const content = stringField(data, "content", 50000);
      const bytes = new TextEncoder().encode(content).length;
      requireValue(bytes <= 50000, 413, "Document must be at most 50 KB.");
      requireValue(
        !content.includes("\u0000"),
        400,
        "Upload a valid UTF-8 text document.",
      );
      const parts = chunkText(content);
      const id = crypto.randomUUID();
      const hash = await digest(content);
      try {
        const result = await db.batch([
          db
            .prepare(
              "INSERT INTO documents (id,bot_id,name,content,digest,bytes,chunk_count,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM documents WHERE bot_id=?)<20 AND (SELECT COUNT(*) FROM chunks WHERE bot_id=?)+?<=600",
            )
            .bind(
              id,
              bot.id,
              name,
              content,
              hash,
              bytes,
              parts.length,
              now(),
              bot.id,
              bot.id,
              parts.length,
            ),
          ...parts.map((text, i) =>
            db
              .prepare(
                "INSERT INTO chunks (id,document_id,bot_id,content,position) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=?)",
              )
              .bind(crypto.randomUUID(), id, bot.id, text, i, id),
          ),
        ]);
        requireValue(
          result[0].meta.changes,
          409,
          "Knowledge limit reached (20 documents or 600 chunks).",
        );
      } catch (e) {
        if (String(e).includes("UNIQUE"))
          throw new HttpError(
            409,
            "This document is already in the knowledge base.",
          );
        throw e;
      }
      return json(
        {
          document: {
            id,
            name,
            bytes,
            chunk_count: parts.length,
            created_at: now(),
          },
        },
        201,
      );
    }
  }
  const convMatch = path.match(/^\/api\/conversations\/([^/]+)$/);
  if (convMatch) {
    const user = await requireUser(req, db);
    const conv = await db
      .prepare("SELECT * FROM conversations WHERE id=? AND user_id=?")
      .bind(convMatch[1], user.id)
      .first<{ id: string; bot_id: string; lease_until: number }>();
    requireValue(conv, 404, "Conversation not found.");
    if (method === "DELETE") {
      requireValue(
        conv.lease_until < now(),
        409,
        "Stop the current response before deleting this chat.",
      );
      await db
        .prepare("DELETE FROM conversations WHERE id=? AND user_id=?")
        .bind(conv.id, user.id)
        .run();
      return json({ ok: true });
    }
    if (method === "GET") {
      const bot = await botFor(db, conv.bot_id, user);
      const rows = (
        await db
          .prepare(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC,id ASC LIMIT 200",
          )
          .bind(conv.id)
          .all<{
            id: string;
            role: string;
            content: string;
            sources: string;
            status: string;
          }>()
      ).results;
      return json({
        conversation: conv,
        bot: safeBot(bot, bot.owner_id === user.id),
        messages: rows.map((m) => ({
          ...m,
          status:
            m.status === "streaming" && conv.lease_until < now()
              ? "failed"
              : m.status,
          sources: JSON.parse(m.sources),
        })),
      });
    }
  }
  if (path === "/api/chat" && method === "POST") {
    const user = await requireUser(req, db);
    requireValue(providerInfo(env).ready, 503, "AI is not configured yet.");
    const data = await readJSON(req, 10000);
    const content = stringField(data, "content", 4000);
    const botId = stringField(data, "botId", 100);
    const requestId = stringField(data, "requestId", 40);
    requireValue(
      /^[a-f0-9-]{36}$/i.test(requestId),
      400,
      "A valid requestId is required.",
    );
    const bot = await botFor(db, botId, user);
    await rate(db, "chat-minute:" + user.id, 8, 60000);
    let conversationId =
      typeof data.conversationId === "string" ? data.conversationId : "";
    if (conversationId) {
      const c = await db
        .prepare(
          "SELECT id FROM conversations WHERE id=? AND user_id=? AND bot_id=?",
        )
        .bind(conversationId, user.id, botId)
        .first();
      requireValue(c, 404, "Conversation not found.");
    } else {
      conversationId = crypto.randomUUID();
      const count = await db
        .prepare("SELECT COUNT(*) n FROM conversations WHERE user_id=?")
        .bind(user.id)
        .first<{ n: number }>();
      requireValue(
        count && count.n < 100,
        409,
        "You have 100 chats. Delete an older chat to make room.",
      );
      await db
        .prepare(
          "INSERT INTO conversations (id,user_id,bot_id,title,created_at,updated_at,lease_until) VALUES (?,?,?,?,?,?,0)",
        )
        .bind(
          conversationId,
          user.id,
          bot.id,
          content.slice(0, 65),
          now(),
          now(),
        )
        .run();
    }
    const locked = await db
      .prepare(
        "UPDATE conversations SET lease_until=? WHERE id=? AND user_id=? AND lease_until<? RETURNING id",
      )
      .bind(now() + 110000, conversationId, user.id, now())
      .first();
    requireValue(locked, 409, "A response is already running in this chat.");
    try {
      requireValue(
        !(await db
          .prepare("SELECT id FROM messages WHERE id=?")
          .bind(requestId)
          .first()),
        409,
        "This message was already submitted.",
      );
      const total = await db
        .prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=?")
        .bind(conversationId)
        .first<{ n: number }>();
      requireValue(
        total && total.n < 200,
        409,
        "This chat is full. Start a new conversation.",
      );
      await rate(db, "chat-day:" + user.id, 40, 86400000);
      await rate(db, "chat-global", 200, 86400000);
      const history = (
        await db
          .prepare(
            "SELECT role,content,status FROM messages WHERE conversation_id=? AND status='complete' ORDER BY created_at DESC,id DESC LIMIT 30",
          )
          .bind(conversationId)
          .all<{ role: string; content: string; status: string }>()
      ).results.reverse();
      const chunks =
        bot.id === demoBot.id
          ? chunkText(demoKnowledge).map((content, i) => ({
              id: `handbook-${i}`,
              name: "ShadowBot handbook.md",
              position: i,
              content,
            }))
          : (
              await db
                .prepare(
                  "SELECT c.id,c.content,c.position,d.name FROM chunks c JOIN documents d ON c.document_id=d.id WHERE c.bot_id=? LIMIT 600",
                )
                .bind(bot.id)
                .all<{
                  id: string;
                  name: string;
                  content: string;
                  position: number;
                }>()
            ).results;
      const query = [
        ...history
          .filter((h) => h.role === "user")
          .slice(-1)
          .map((h) => h.content),
        content,
      ].join(" ");
      const sources = retrieve(query, chunks);
      const assistantId = crypto.randomUUID();
      const created = now();
      await db.batch([
        db
          .prepare(
            "INSERT INTO messages (id,conversation_id,role,content,sources,status,created_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            requestId,
            conversationId,
            "user",
            content,
            "[]",
            "complete",
            created,
          ),
        db
          .prepare(
            "INSERT INTO messages (id,conversation_id,role,content,sources,status,created_at) VALUES (?,?,?,?,?,?,?)",
          )
          .bind(
            assistantId,
            conversationId,
            "assistant",
            "",
            JSON.stringify(sources),
            "streaming",
            created + 1,
          ),
        db
          .prepare("UPDATE conversations SET updated_at=? WHERE id=?")
          .bind(created, conversationId),
      ]);
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort("timeout"), 90000);
      const onAbort = () => abort.abort("stopped");
      req.signal.addEventListener("abort", onAbort, { once: true });
      const { readable, writable } = new TransformStream<
        Uint8Array,
        Uint8Array
      >();
      const writer = writable.getWriter();
      ctx.waitUntil(
        (async () => {
          let answer = "";
          let status = "complete";
          let failed = false;
          try {
            await writer.write(
              sse("meta", {
                conversationId,
                userMessageId: requestId,
                assistantId,
                sources,
              }),
            );
            for await (const token of generate(
              env,
              [
                {
                  role: "system",
                  content: buildPrompt(bot.system_prompt || "", sources),
                },
                ...memoryWindow(history),
                { role: "user", content },
              ],
              abort.signal,
            )) {
              if (answer.length + token.length > 16000)
                throw new Error("Response exceeded output limit");
              answer += token;
              await writer.write(sse("delta", { text: token }));
            }
            if (!answer.trim())
              throw new Error("The provider returned an empty response.");
          } catch (e) {
            failed = true;
            status =
              abort.signal.aborted && abort.signal.reason === "stopped"
                ? "stopped"
                : "failed";
            const message =
              e instanceof HttpError
                ? e.message
                : abort.signal.aborted
                  ? "The response was interrupted."
                  : "The response could not finish. Please try again.";
            try {
              await writer.write(sse("error", { message }));
            } catch {
              abort.abort("stopped");
            }
            console.warn(
              JSON.stringify({ event: "chat_failed", requestId, status }),
            );
          } finally {
            clearTimeout(timeout);
            req.signal.removeEventListener("abort", onAbort);
            try {
              await db.batch([
                db
                  .prepare("UPDATE messages SET content=?,status=? WHERE id=?")
                  .bind(answer, status, assistantId),
                db
                  .prepare(
                    "UPDATE conversations SET lease_until=0,updated_at=? WHERE id=?",
                  )
                  .bind(now(), conversationId),
              ]);
              await writer.write(
                sse("done", { conversationId, assistantId, status, failed }),
              );
            } catch {
              console.error(
                JSON.stringify({ event: "chat_finalize_failed", requestId }),
              );
            } finally {
              await writer.close().catch(() => {});
            }
          }
        })(),
      );
      writer.closed.catch(() => abort.abort("stopped"));
      ctx.waitUntil(
        db
          .batch([
            db.prepare("DELETE FROM sessions WHERE expires_at<?").bind(now()),
            db
              .prepare("DELETE FROM rate_limits WHERE expires_at<?")
              .bind(now()),
          ])
          .then(() => {}),
      );
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (e) {
      await db
        .prepare("UPDATE conversations SET lease_until=0 WHERE id=?")
        .bind(conversationId)
        .run();
      throw e;
    }
  }
  throw new HttpError(404, "Endpoint not found.");
}
export async function handleAPI(
  req: Request,
  env: AppEnv,
  ctx: ExecutionContext,
) {
  try {
    return securityHeaders(await route(req, env, ctx));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "api_error",
          path: new URL(req.url).pathname,
          error: e instanceof Error ? e.message : "unknown",
        }),
      );
    return securityHeaders(
      json(
        {
          error:
            e instanceof HttpError
              ? e.message
              : "An unexpected error occurred. Please try again.",
        },
        status,
      ),
    );
  }
}
