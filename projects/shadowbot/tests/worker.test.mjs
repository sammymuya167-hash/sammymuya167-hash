import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare } = require("miniflare");

test("ShadowBot built Worker + D1 release verification", async (t) => {
  let mode = "normal";
  const captured = [];
  const mf = new Miniflare({
    modules: [
      "index.js",
      ...readdirSync("dist/server", { recursive: true }).filter(
        (p) => p.endsWith(".js") && p !== "index.js",
      ),
    ].map((p) => ({ type: "ESModule", path: resolve("dist/server", p) })),
    modulesRoot: resolve("dist/server"),
    modulesRules: [
      { type: "ESModule", include: ["**/*.js", "**/*.mjs"], fallthrough: true },
    ],
    compatibilityDate: JSON.parse(
      readFileSync("dist/server/wrangler.json", "utf8"),
    ).compatibility_date,
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    assets: {
      directory: resolve("dist/client"),
      binding: "ASSETS",
      routerConfig: { has_user_worker: true },
    },
    bindings: {
      AI_BASE_URL: "https://provider.example/v1",
      AI_API_KEY: "test-provider-secret",
      AI_MODEL: "test-model",
      AI_LABEL: "Test provider",
    },
    outboundService: async (request) => {
      assert.equal(new URL(request.url).origin, "https://provider.example");
      assert.equal(
        request.headers.get("Authorization"),
        "Bearer test-provider-secret",
      );
      const body = await request.json();
      captured.push(body);
      if (mode === "failure")
        return new Response("private upstream error", { status: 502 });
      if (mode === "wrong-type")
        return new Response('{"response":"not streaming"}', {
          headers: { "Content-Type": "application/json" },
        });
      const s =
        'data: {"choices":[{"delta":{"content":"Refunds take "}}]}\n\ndata: {"choices":[{"delta":{"content":"five business days [1]."}}]}\n\n' +
        (mode === "truncated" ? "" : "data: [DONE]\n\n");
      return new Response(s, {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const sql of readFileSync("drizzle/" + file, "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(sql).run();
  }
  const origin = "https://shadowbot.test";
  const cookies = {};
  const request = (who, path, method = "GET", body, headers = {}) =>
    mf.dispatchFetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        ...(cookies[who] ? { Cookie: cookies[who] } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  const account = async (who) => {
    const r = await request(null, "/api/auth/signup", "POST", {
      name: who,
      email: `${who}@example.test`,
      password: "a secure passphrase for " + who,
    });
    assert.equal(r.status, 201);
    cookies[who] = r.headers.get("set-cookie").split(";")[0];
    return (await r.json()).user;
  };
  const chat = async (
    who,
    botId,
    conversationId,
    content = "How long does a card refund take?",
    requestId = crypto.randomUUID(),
  ) => {
    const r = await request(who, "/api/chat", "POST", {
      botId,
      conversationId,
      content,
      requestId,
    });
    const text = await r.text();
    const frames = text
      .trim()
      .split("\n\n")
      .map((v) => {
        const lines = v.split("\n");
        return {
          event: lines[0]?.slice(7),
          data: JSON.parse(
            lines.find((l) => l.startsWith("data: "))?.slice(6) || "{}",
          ),
        };
      });
    return {
      r,
      text,
      frames,
      meta: frames.find((f) => f.event === "meta")?.data,
    };
  };
  let alice, bob, bot, conversationId, docId;
  const fields = {
    name: "Support specialist",
    description: "Answers questions using our refund policy.",
    system_prompt:
      "You work at Example Shop. Answer in a calm and concise tone. NEVER_CROSS_ACCOUNT",
    greeting: "Welcome! How can I help?",
    color: "purple",
    is_public: false,
  };
  await t.test(
    "public pages and health serve without exposing private data",
    async () => {
      const r = await request(null, "/");
      assert.equal(r.status, 200);
      assert.match(await r.text(), /ShadowBot/);
      assert.match(
        r.headers.get("Content-Security-Policy"),
        /object-src 'none'/,
      );
      assert.equal(r.headers.get("Cache-Control"), "private, no-store");
      const boot = await (await request(null, "/api/bootstrap")).json();
      assert.equal(boot.user, null);
      assert.ok(boot.publicBots.some((b) => b.id === "shadow-guide"));
      assert.ok(!JSON.stringify(boot).includes("test-provider-secret"));
      assert.equal((await request(null, "/api/health")).status, 200);
      assert.equal((await request(null, "/chat/shadow-guide")).status, 200);
    },
  );
  await t.test(
    "origin checks, input limits and unauthenticated writes fail closed",
    async () => {
      assert.equal(
        (await request(null, "/api/bots", "POST", fields)).status,
        401,
      );
      assert.equal(
        (
          await request(
            null,
            "/api/auth/signup",
            "POST",
            {},
            { Origin: "https://evil.test" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(null, "/api/auth/signup", "POST", {
            name: "Test",
            email: "bad",
            password: "short",
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(null, "/api/auth/login", "POST", [], {})).status,
        400,
      );
    },
  );
  await t.test(
    "real salted passwords, secure sessions and login round trip work",
    async () => {
      alice = await account("Alice");
      bob = await account("Bob");
      const row = await db
        .prepare("SELECT password_hash FROM users WHERE id=?")
        .bind(alice.id)
        .first();
      assert.match(row.password_hash, /pbkdf2-sha256/);
      assert.ok(!row.password_hash.includes("a secure"));
      const login = await request(null, "/api/auth/login", "POST", {
        email: "ALICE@example.test",
        password: "a secure passphrase for Alice",
      });
      assert.equal(login.status, 200);
      assert.match(
        login.headers.get("set-cookie"),
        /HttpOnly; Secure; SameSite=Lax/,
      );
      assert.equal(
        (
          await request(null, "/api/auth/login", "POST", {
            email: "Alice@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
      const sessions = (
        await db.prepare("SELECT token_hash FROM sessions").all()
      ).results;
      assert.ok(sessions.every((s) => !cookies.Alice.includes(s.token_hash)));
    },
  );
  await t.test(
    "owners can create/edit bots; other users cannot discover private bots or mutate them",
    async () => {
      const r = await request("Alice", "/api/bots", "POST", fields);
      assert.equal(r.status, 201);
      bot = (await r.json()).bot;
      assert.equal((await request("Bob", `/api/bots/${bot.id}`)).status, 404);
      assert.equal(
        (await request("Bob", `/api/bots/${bot.id}`, "PATCH", fields)).status,
        404,
      );
      assert.equal((await request(null, `/api/bots/${bot.id}`)).status, 404);
      const boot = await (await request("Bob", "/api/bootstrap")).json();
      assert.equal(boot.bots.length, 0);
    },
  );
  await t.test(
    "knowledge validates UTF-8 text types, limits, duplicates and owner isolation",
    async () => {
      assert.equal(
        (
          await request("Alice", `/api/bots/${bot.id}/documents`, "POST", {
            name: "policy.pdf",
            content: "data",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request("Alice", `/api/bots/${bot.id}/documents`, "POST", {
            name: "huge.md",
            content: "a".repeat(50001),
          })
        ).status,
        400,
      );
      const r = await request(
        "Alice",
        `/api/bots/${bot.id}/documents`,
        "POST",
        {
          name: "Refund policy.md",
          content:
            "Card refunds take five business days. Return your unused item with a receipt within 14 days.",
        },
      );
      assert.equal(r.status, 201);
      docId = (await r.json()).document.id;
      assert.equal(
        (
          await request("Alice", `/api/bots/${bot.id}/documents`, "POST", {
            name: "copy.md",
            content:
              "Card refunds take five business days. Return your unused item with a receipt within 14 days.",
          })
        ).status,
        409,
      );
      assert.equal(
        (await request("Bob", `/api/bots/${bot.id}/documents`)).status,
        404,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) n FROM chunks WHERE bot_id=?")
            .bind(bot.id)
            .first()
        ).n,
        1,
      );
    },
  );
  await t.test(
    "RAG, custom system prompt, SSE deltas and durable messages work together",
    async () => {
      const result = await chat("Alice", bot.id);
      assert.equal(result.r.status, 200);
      assert.match(result.r.headers.get("Content-Type"), /event-stream/);
      assert.match(result.text, /five business days/);
      conversationId = result.meta.conversationId;
      assert.equal(result.meta.sources[0].name, "Refund policy.md");
      assert.match(captured.at(-1).messages[0].content, /NEVER_CROSS_ACCOUNT/);
      assert.match(captured.at(-1).messages[0].content, /five business days/);
      const saved = await (
        await request("Alice", `/api/conversations/${conversationId}`)
      ).json();
      assert.equal(saved.messages.length, 2);
      assert.equal(
        saved.messages[1].content,
        "Refunds take five business days [1].",
      );
      assert.equal(saved.messages[1].status, "complete");
      assert.equal(result.frames.at(-1).event, "done");
    },
  );
  await t.test(
    "next turns include saved memory and follow-up retrieval",
    async () => {
      const r = await chat(
        "Alice",
        bot.id,
        conversationId,
        "Does that apply to my previous question?",
      );
      assert.equal(r.r.status, 200);
      const turns = captured.at(-1).messages;
      assert.equal(turns[1].content, "How long does a card refund take?");
      assert.match(turns[2].content, /five business days/);
      assert.ok(r.meta.sources.length > 0);
    },
  );
  await t.test(
    "chat history is isolated, including from the bot owner after publication",
    async () => {
      assert.equal(
        (await request("Bob", `/api/conversations/${conversationId}`)).status,
        404,
      );
      assert.equal(
        (await request("Bob", `/api/conversations/${conversationId}`, "DELETE"))
          .status,
        404,
      );
      await request("Alice", `/api/bots/${bot.id}`, "PATCH", {
        ...fields,
        is_public: true,
      });
      const pub = await (await request(null, `/api/bots/${bot.id}`)).json();
      assert.equal(pub.bot.system_prompt, undefined);
      assert.equal(pub.bot.owner_id, undefined);
      const r = await chat("Bob", bot.id);
      assert.equal(r.r.status, 200);
      assert.equal(
        (await request("Alice", `/api/conversations/${r.meta.conversationId}`))
          .status,
        404,
      );
      const boot = await (await request("Alice", "/api/bootstrap")).json();
      assert.ok(
        boot.conversations.every((c) => c.id !== r.meta.conversationId),
      );
    },
  );
  await t.test(
    "request id deduplication and conversation leases prevent overlapping generations",
    async () => {
      const previous = (
        await db
          .prepare(
            "SELECT id FROM messages WHERE conversation_id=? AND role='user' LIMIT 1",
          )
          .bind(conversationId)
          .first()
      ).id;
      assert.equal(
        (
          await request("Alice", "/api/chat", "POST", {
            botId: bot.id,
            conversationId,
            content: "again",
            requestId: previous,
          })
        ).status,
        409,
      );
      await db
        .prepare("UPDATE conversations SET lease_until=? WHERE id=?")
        .bind(Date.now() + 100000, conversationId)
        .run();
      assert.equal(
        (
          await request("Alice", "/api/chat", "POST", {
            botId: bot.id,
            conversationId,
            content: "again",
            requestId: crypto.randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(
            "Alice",
            `/api/conversations/${conversationId}`,
            "DELETE",
          )
        ).status,
        409,
      );
      await db
        .prepare("UPDATE conversations SET lease_until=0 WHERE id=?")
        .bind(conversationId)
        .run();
    },
  );
  await t.test(
    "provider failure is saved honestly and no upstream secrets leak",
    async () => {
      await db.prepare("DELETE FROM rate_limits").run();
      mode = "failure";
      const r = await chat("Alice", bot.id, conversationId);
      assert.match(r.text, /event: error/);
      assert.ok(!r.text.includes("private upstream"));
      const saved = await (
        await request("Alice", `/api/conversations/${conversationId}`)
      ).json();
      assert.equal(saved.messages.at(-1).status, "failed");
      assert.equal(saved.messages.at(-1).content, "");
      mode = "normal";
    },
  );
  await t.test(
    "truncated stream preserves partial output as failed, never as completed",
    async () => {
      mode = "truncated";
      const r = await chat("Alice", bot.id, conversationId);
      assert.match(r.text, /ended early/);
      const saved = await (
        await request("Alice", `/api/conversations/${conversationId}`)
      ).json();
      assert.equal(saved.messages.at(-1).status, "failed");
      assert.match(saved.messages.at(-1).content, /Refunds/);
      mode = "normal";
    },
  );
  await t.test("non-streaming provider errors fail clearly", async () => {
    mode = "wrong-type";
    const r = await chat("Alice", bot.id, conversationId);
    assert.match(r.text, /supported stream/);
    assert.equal(r.frames.at(-1).data.status, "failed");
    mode = "normal";
  });
  await t.test(
    "privacy changes revoke further chat and history access for visitors",
    async () => {
      await request("Alice", `/api/bots/${bot.id}`, "PATCH", fields);
      const bobChat = (
        await db
          .prepare("SELECT id FROM conversations WHERE user_id=?")
          .bind(bob.id)
          .first()
      ).id;
      assert.equal(
        (await request("Bob", `/api/conversations/${bobChat}`)).status,
        404,
      );
      assert.equal(
        (
          await request("Bob", "/api/chat", "POST", {
            botId: bot.id,
            content: "help",
            requestId: crypto.randomUUID(),
          })
        ).status,
        404,
      );
    },
  );
  await t.test("persistent rate limits block excess model calls", async () => {
    await db.prepare("DELETE FROM rate_limits").run();
    const key = `chat-day:${alice.id}:${Math.floor(Date.now() / 86400000)}`;
    await db
      .prepare("INSERT INTO rate_limits (key,count,expires_at) VALUES (?,40,?)")
      .bind(key, Date.now() + 86400000)
      .run();
    const before = captured.length;
    const r = await request("Alice", "/api/chat", "POST", {
      botId: bot.id,
      conversationId,
      content: "help",
      requestId: crypto.randomUUID(),
    });
    assert.equal(r.status, 429);
    assert.equal(captured.length, before);
    await db.prepare("DELETE FROM rate_limits").run();
  });
  await t.test(
    "document deletion removes chunks; conversation deletion removes messages",
    async () => {
      assert.equal(
        (
          await request(
            "Alice",
            `/api/bots/${bot.id}/documents/${docId}`,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) n FROM chunks WHERE bot_id=?")
            .bind(bot.id)
            .first()
        ).n,
        0,
      );
      assert.equal(
        (
          await request(
            "Alice",
            `/api/conversations/${conversationId}`,
            "DELETE",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=?")
            .bind(conversationId)
            .first()
        ).n,
        0,
      );
    },
  );
  await t.test(
    "bot deletion removes its documents and all associated chat records",
    async () => {
      await request("Alice", `/api/bots/${bot.id}/documents`, "POST", {
        name: "new.md",
        content: "This is fresh knowledge.",
      });
      assert.equal(
        (await request("Alice", `/api/bots/${bot.id}`, "DELETE")).status,
        200,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) n FROM documents WHERE bot_id=?")
            .bind(bot.id)
            .first()
        ).n,
        0,
      );
      assert.equal(
        (
          await db
            .prepare("SELECT COUNT(*) n FROM conversations WHERE bot_id=?")
            .bind(bot.id)
            .first()
        ).n,
        0,
      );
    },
  );
  await t.test("logout invalidates the server-side session", async () => {
    assert.equal(
      (await request("Alice", "/api/auth/logout", "POST")).status,
      200,
    );
    assert.equal(
      (await (await request("Alice", "/api/bootstrap")).json()).user,
      null,
    );
    assert.equal(
      (await request("Alice", "/api/bots", "POST", fields)).status,
      401,
    );
  });
});
