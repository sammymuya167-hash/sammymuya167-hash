import { validPublicKey } from "./crypto-core.ts";
import { RELEASE } from "./chat-types.ts";
import type { Member, Message, Conversation, Envelope } from "./chat-types";

export type RequestUser = { userId: string; email: string; displayName: string };
type MemberRow = { id: string; handle: string; name: string; public_key: string; role: "owner" | "member"; status: "active" | "revoked" };
type ChatRow = { id: string; a: string; b: string; a_read: number; b_read: number; a_delivered: number; b_delivered: number; created_at: number; updated_at: number };
type MessageRow = { seq: number; id: string; conversation_id: string; sender_id: string; nonce: string; ciphertext: string; created_at: number };
class UserError extends Error { readonly status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
function json(value: unknown, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } }); }
const member = (r: MemberRow): Member => ({ id: r.id, handle: r.handle, name: r.name, publicKey: r.public_key, role: r.role, status: r.status });
const message = (r: MessageRow): Message => ({ seq: r.seq, id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, nonce: r.nonce, ciphertext: r.ciphertext, createdAt: r.created_at });
const uuid = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
async function hashToken(token: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), x => x.toString(16).padStart(2, "0")).join(""); }
async function body(req: Request): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new UserError("Send JSON data.", 415);
  if (Number(req.headers.get("content-length")) > 24000) throw new UserError("Request is too large.", 413);
  const reader = req.body?.getReader(); if (!reader) throw new UserError("Missing request.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const result = await reader.read(); if (result.done) break; size += result.value.length; if (size > 24000) { await reader.cancel(); throw new UserError("Request is too large.", 413); } chunks.push(result.value); }
  const data = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(data)); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw new UserError("Invalid JSON data."); }
}
async function limit(db: D1Database, userId: string, action: string, max: number, period = 60000) {
  const window = Math.floor(Date.now() / period);
  const r = await db.prepare("INSERT INTO rate_windows (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END, window = excluded.window RETURNING count").bind(`${userId}:${action}`, window).first<{ count: number }>();
  if (!r || r.count > max) throw new UserError("Please slow down and try again shortly.", 429);
}
async function current(db: D1Database, id: string) { return db.prepare("SELECT * FROM members WHERE id = ?").bind(id).first<MemberRow>(); }
async function chat(db: D1Database, id: string, userId: string) {
  if (!uuid(id)) throw new UserError("Conversation not found.", 404);
  const r = await db.prepare("SELECT c.* FROM conversations c JOIN members ma ON ma.id = c.a JOIN members mb ON mb.id = c.b WHERE c.id = ? AND (c.a = ? OR c.b = ?) AND ma.status = 'active' AND mb.status = 'active'").bind(id, userId, userId).first<ChatRow>();
  if (!r) throw new UserError("Conversation is unavailable.", 404); return r;
}
function numeric(value: unknown): number { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new UserError("Invalid message cursor."); return n; }
function envelope(b: Record<string, unknown>): Envelope {
  if (!uuid(b.id) || !uuid(b.conversationId) || typeof b.nonce !== "string" || !/^[A-Za-z0-9+/]{32}$/.test(b.nonce) || typeof b.ciphertext !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.ciphertext) || b.ciphertext.length < 40 || b.ciphertext.length > 22000 || b.ciphertext.length % 4 !== 0) throw new UserError("Invalid encrypted message.");
  return { id: b.id, conversationId: b.conversationId, nonce: b.nonce, ciphertext: b.ciphertext };
}

export async function handleChatRequest(req: Request, db: D1Database, user: RequestUser | null): Promise<Response> {
  const url = new URL(req.url), path = url.pathname, method = req.method;
  try {
    if (!user) throw new UserError("Sign in to continue.", 401);
    if (method !== "GET" && method !== "POST") throw new UserError("Method not allowed.", 405);
    if (method === "POST") {
      const origin = req.headers.get("origin");
      const allowed = new Set([url.origin, "https://shadowchat-shadownet.sammymuya167.chatgpt.site"]);
      if (!origin || !allowed.has(origin)) throw new UserError("Request origin is not allowed.", 403);
    }
    const me = await current(db, user.userId);
    if (path === "/api/bootstrap" && method === "GET") {
      const initialized = Boolean(await db.prepare("SELECT id FROM settings WHERE id = 1").first());
      return json({ user: { id: user.userId, name: user.displayName, email: user.email }, member: me ? member(me) : null, initialized, release: RELEASE });
    }
    if (path === "/api/join" && method === "POST") {
      await limit(db, user.userId, "join", 10);
      if (me) throw new UserError("This account already has an identity. Restore its device key to continue.", 409);
      const b = await body(req), handle = typeof b.handle === "string" ? b.handle.toLowerCase().trim() : "", name = typeof b.name === "string" ? b.name.trim() : "";
      if (!/^[a-z][a-z0-9_]{2,23}$/.test(handle) || name.length < 1 || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name) || !validPublicKey(b.publicKey)) throw new UserError("Choose a name and a username with 3–24 letters, numbers or underscores.");
      const exists = await db.prepare("SELECT owner_id FROM settings WHERE id = 1").first<{ owner_id: string }>();
      const now = Date.now();
      if (!exists) {
        // Initial owner enrolment is possible only behind the owner-private hosting gate.
        await db.batch([
          db.prepare("INSERT INTO settings (id, owner_id) VALUES (1, ?) ON CONFLICT(id) DO NOTHING").bind(user.userId),
          db.prepare("INSERT INTO members (id, handle, name, public_key, role, status, joined_at) SELECT ?, ?, ?, ?, 'owner', 'active', ? WHERE EXISTS (SELECT 1 FROM settings WHERE id = 1 AND owner_id = ?)").bind(user.userId, handle, name, b.publicKey, now, user.userId)
        ]);
      } else {
        if (typeof b.token !== "string" || !/^[a-f0-9]{64}$/.test(b.token)) throw new UserError("You need a valid invitation from the owner.", 403);
        const hashed = await hashToken(b.token), email = user.email.toLowerCase().trim();
        await db.batch([
          db.prepare("UPDATE invitations SET claimed_by = ? WHERE token_hash = ? AND email = ? AND claimed_by IS NULL AND revoked_at IS NULL AND expires_at > ?").bind(user.userId, hashed, email, now),
          db.prepare("INSERT INTO members (id, handle, name, public_key, role, status, joined_at) SELECT ?, ?, ?, ?, 'member', 'active', ? FROM invitations WHERE token_hash = ? AND claimed_by = ? AND email = ? AND revoked_at IS NULL AND expires_at > ?").bind(user.userId, handle, name, b.publicKey, now, hashed, user.userId, email, now)
        ]);
      }
      const joined = await current(db, user.userId); if (!joined) throw new UserError("Invitation is invalid, expired or belongs to another email.", 403);
      return json({ member: member(joined) }, 201);
    }
    if (!me || me.status !== "active") throw new UserError(me?.status === "revoked" ? "Your access has been removed by the owner." : "Join with an invitation first.", 403);
    if (path === "/api/members" && method === "GET") {
      const r = await db.prepare(me.role === "owner" ? "SELECT * FROM members ORDER BY joined_at" : "SELECT * FROM members WHERE status = 'active' ORDER BY name").all<MemberRow>();
      return json({ members: r.results.map(member) });
    }
    if (path === "/api/members/revoke" && method === "POST") {
      if (me.role !== "owner") throw new UserError("Only the owner can remove access.", 403);
      const b = await body(req); if (typeof b.id !== "string" || b.id === me.id) throw new UserError("The owner cannot be removed.");
      await db.prepare("UPDATE members SET status = 'revoked' WHERE id = ? AND role != 'owner'").bind(b.id).run(); return json({ ok: true });
    }
    if (path === "/api/invitations") {
      if (me.role !== "owner") throw new UserError("Only the owner can manage invitations.", 403);
      if (method === "GET") {
        const r = await db.prepare("SELECT id, email, created_at, expires_at, claimed_by, revoked_at FROM invitations ORDER BY created_at DESC LIMIT 50").all<{ id: string; email: string; created_at: number; expires_at: number; claimed_by: string | null; revoked_at: number | null }>();
        return json({ invitations: r.results.map(x => ({ id: x.id, email: x.email, createdAt: x.created_at, expiresAt: x.expires_at, claimed: Boolean(x.claimed_by), revoked: Boolean(x.revoked_at) })) });
      }
      await limit(db, me.id, "invitations", 20, 3600000);
      const b = await body(req), email = typeof b.email === "string" ? b.email.toLowerCase().trim() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Enter the email your friend uses to sign in.");
      const id = crypto.randomUUID(), bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = Array.from(bytes, x => x.toString(16).padStart(2, "0")).join(""), now = Date.now();
      await db.prepare("INSERT INTO invitations (id, token_hash, email, inviter_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, await hashToken(token), email, me.id, now, now + 48 * 3600000).run();
      return json({ id, token, expiresAt: now + 48 * 3600000 }, 201);
    }
    if (path === "/api/invitations/revoke" && method === "POST") {
      if (me.role !== "owner") throw new UserError("Only the owner can revoke invitations.", 403);
      const b = await body(req); if (!uuid(b.id)) throw new UserError("Invalid invitation.");
      await db.prepare("UPDATE invitations SET revoked_at = ? WHERE id = ? AND claimed_by IS NULL").bind(Date.now(), b.id).run(); return json({ ok: true });
    }
    if (path === "/api/conversations" && method === "POST") {
      await limit(db, me.id, "conversations", 30);
      const b = await body(req); if (typeof b.peerId !== "string" || b.peerId === me.id) throw new UserError("Choose another approved member.");
      const peer = await current(db, b.peerId); if (!peer || peer.status !== "active") throw new UserError("This member is unavailable.", 404);
      const [a, c] = [me.id, peer.id].sort(), id = crypto.randomUUID(), now = Date.now();
      await db.prepare("INSERT INTO conversations (id, a, b, created_at, updated_at) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM members WHERE id = ? AND status = 'active') AND EXISTS (SELECT 1 FROM members WHERE id = ? AND status = 'active') ON CONFLICT(a, b) DO NOTHING").bind(id, a, c, now, now, me.id, peer.id).run();
      const row = await db.prepare("SELECT id FROM conversations WHERE a = ? AND b = ?").bind(a, c).first<{ id: string }>(); if (!row) throw new UserError("Member access changed. Refresh and try again.", 403); return json({ id: row.id }, 201);
    }
    if (path === "/api/conversations" && method === "GET") {
      type Listing = ChatRow & { peer_id: string; peer_handle: string; peer_name: string; peer_key: string; peer_role: "owner" | "member"; unread: number; msg_id: string | null; msg_seq: number | null; msg_sender: string | null; msg_nonce: string | null; msg_ciphertext: string | null; msg_created: number | null };
      const rows = await db.prepare("SELECT c.*, p.id AS peer_id, p.handle AS peer_handle, p.name AS peer_name, p.public_key AS peer_key, p.role AS peer_role, (SELECT COUNT(*) FROM messages u WHERE u.conversation_id = c.id AND u.sender_id != ? AND u.seq > CASE WHEN c.a = ? THEN c.a_read ELSE c.b_read END) AS unread, m.id AS msg_id, m.seq AS msg_seq, m.sender_id AS msg_sender, m.nonce AS msg_nonce, m.ciphertext AS msg_ciphertext, m.created_at AS msg_created FROM conversations c JOIN members ma ON ma.id = c.a JOIN members mb ON mb.id = c.b JOIN members p ON p.id = CASE WHEN c.a = ? THEN c.b ELSE c.a END LEFT JOIN messages m ON m.seq = (SELECT MAX(l.seq) FROM messages l WHERE l.conversation_id = c.id) WHERE (c.a = ? OR c.b = ?) AND ma.status = 'active' AND mb.status = 'active' ORDER BY c.updated_at DESC LIMIT 100").bind(me.id, me.id, me.id, me.id, me.id).all<Listing>();
      const conversations: Conversation[] = rows.results.map(c => ({ id: c.id, peer: { id: c.peer_id, handle: c.peer_handle, name: c.peer_name, publicKey: c.peer_key, role: c.peer_role, status: "active" }, createdAt: c.created_at, updatedAt: c.updated_at, unread: c.unread, peerReadSeq: c.a === me.id ? c.b_read : c.a_read, peerDeliveredSeq: c.a === me.id ? c.b_delivered : c.a_delivered, last: c.msg_id !== null ? { id: c.msg_id, seq: c.msg_seq!, conversationId: c.id, senderId: c.msg_sender!, nonce: c.msg_nonce!, ciphertext: c.msg_ciphertext!, createdAt: c.msg_created! } : null }));
      return json({ conversations });
    }
    if (path === "/api/messages" && method === "POST") {
      await limit(db, me.id, "messages", 90);
      const e = envelope(await body(req)); await chat(db, e.conversationId, me.id);
      const old = await db.prepare("SELECT * FROM messages WHERE id = ?").bind(e.id).first<MessageRow>();
      if (old) {
        if (old.sender_id !== me.id || old.conversation_id !== e.conversationId || old.nonce !== e.nonce || old.ciphertext !== e.ciphertext) throw new UserError("Message identity conflicts with an existing message.", 409);
        return json({ message: message(old) });
      }
      const now = Date.now();
      await db.batch([
        db.prepare("INSERT INTO messages (id, conversation_id, sender_id, nonce, ciphertext, created_at) SELECT ?, c.id, ?, ?, ?, ? FROM conversations c JOIN members ma ON ma.id = c.a JOIN members mb ON mb.id = c.b WHERE c.id = ? AND (c.a = ? OR c.b = ?) AND ma.status = 'active' AND mb.status = 'active' ON CONFLICT(id) DO NOTHING").bind(e.id, me.id, e.nonce, e.ciphertext, now, e.conversationId, me.id, me.id),
        db.prepare("UPDATE conversations SET updated_at = MAX(updated_at, ?) WHERE id = ? AND EXISTS (SELECT 1 FROM messages WHERE id = ? AND sender_id = ?)").bind(now, e.conversationId, e.id, me.id)
      ]);
      const saved = await db.prepare("SELECT * FROM messages WHERE id = ?").bind(e.id).first<MessageRow>();
      if (!saved || saved.sender_id !== me.id || saved.conversation_id !== e.conversationId || saved.nonce !== e.nonce || saved.ciphertext !== e.ciphertext) throw new UserError("Message identity conflict.", 409);
      return json({ message: message(saved) }, 201);
    }
    if (path === "/api/messages" && method === "GET") {
      const conversationId = url.searchParams.get("conversationId") ?? "", c = await chat(db, conversationId, me.id);
      const after = url.searchParams.get("after"), before = url.searchParams.get("before");
      if (after && before) throw new UserError("Choose one message cursor.");
      const rows = after !== null
        ? await db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND seq > ? ORDER BY seq ASC LIMIT 101").bind(c.id, numeric(after)).all<MessageRow>()
        : await db.prepare("SELECT * FROM messages WHERE conversation_id = ? AND seq < ? ORDER BY seq DESC LIMIT 101").bind(c.id, before === null ? Number.MAX_SAFE_INTEGER : numeric(before)).all<MessageRow>();
      const hasMore = rows.results.length > 100, page = rows.results.slice(0, 100);
      if (after === null) page.reverse();
      return json({ messages: page.map(message), hasMore, peerReadSeq: c.a === me.id ? c.b_read : c.a_read, peerDeliveredSeq: c.a === me.id ? c.b_delivered : c.a_delivered });
    }
    if (path === "/api/receipts" && method === "POST") {
      const b = await body(req); if (!uuid(b.conversationId)) throw new UserError("Invalid conversation.");
      const c = await chat(db, b.conversationId, me.id), upto = numeric(b.upto), read = b.read === true;
      const maximum = await db.prepare("SELECT COALESCE(MAX(seq), 0) AS n FROM messages WHERE conversation_id = ?").bind(c.id).first<{ n: number }>();
      const seq = Math.min(upto, maximum?.n ?? 0), prefix = c.a === me.id ? "a" : "b";
      await db.prepare(`UPDATE conversations SET ${prefix}_delivered = MAX(${prefix}_delivered, ?), ${prefix}_read = MAX(${prefix}_read, ?) WHERE id = ?`).bind(seq, read ? seq : 0, c.id).run();
      return json({ ok: true });
    }
    throw new UserError("Not found.", 404);
  } catch (error) {
    if (error instanceof UserError) return json({ error: error.message }, error.status);
    if (error instanceof Error && /UNIQUE constraint failed: members.handle/.test(error.message)) return json({ error: "That username is already taken." }, 409);
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return json({ error: "That operation conflicts with an existing record. Refresh and try again." }, 409);
    console.error("ShadowChat operation failed", { method, path });
    return json({ error: "Could not complete this request. Please try again." }, 500);
  }
}
