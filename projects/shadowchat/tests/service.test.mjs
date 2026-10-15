import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { handleChatRequest } from '../lib/chat-service.ts';
import { createIdentity, sealMessage, openMessage } from '../lib/crypto-core.ts';
const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { Miniflare } = require('miniflare');
const alice = { userId: 'alice', email: 'alice@example.test', displayName: 'Alice' }, bob = { userId: 'bob', email: 'bob@example.test', displayName: 'Bob' }, carol = { userId: 'carol', email: 'carol@example.test', displayName: 'Carol' }, other = { userId: 'other', email: 'other@example.test', displayName: 'Other' };
const keys = { alice: createIdentity(), bob: createIdentity(), carol: createIdentity(), other: createIdentity() };
async function fixture(t) {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("test"); } }', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose()); const db = await mf.getD1Database('DB');
  const sql = readFileSync(new URL('../drizzle/0000_square_reavers.sql', import.meta.url), 'utf8');
  for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  async function call(user, path, data, extras = {}) {
    const req = new Request(`https://shadowchat.test/api/${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { 'Origin': 'https://shadowchat.test', 'Content-Type': 'application/json', ...extras }, body: data === undefined ? undefined : JSON.stringify(data) });
    const response = await handleChatRequest(req, db, user); return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function join(user, token = '') { return call(user, 'join', { name: user.displayName, handle: user.userId, publicKey: keys[user.userId].publicKey, token }); }
  async function invite(user) { const r = await call(alice, 'invitations', { email: user.email }); assert.equal(r.status, 201); return r.data; }
  async function seedOwner() {
    await db.batch([db.prepare('INSERT INTO settings (id, owner_id) VALUES (1, ?)').bind(alice.userId), db.prepare("INSERT INTO members (id, handle, name, public_key, role, status, joined_at) VALUES (?, ?, ?, ?, 'owner', 'active', ?)").bind(alice.userId, alice.userId, alice.displayName, keys.alice.publicKey, Date.now())]);
  }
  async function members() { await seedOwner(); for (const u of [bob, carol]) { const i = await invite(u); assert.equal((await join(u, i.token)).status, 201); } }
  async function conversation() { const r = await call(alice, 'conversations', { peerId: bob.userId }); assert.equal(r.status, 201); return r.data.id; }
  return { db, call, join, invite, members, conversation, seedOwner };
}
test('identity is required; hostile origins and oversized input are rejected', async t => {
  const f = await fixture(t); assert.equal((await f.call(null, 'bootstrap')).status, 401);
  assert.equal((await f.call(alice, 'join', {}, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await f.call(alice, 'join', { text: 'x'.repeat(25000) })).status, 413);
  assert.equal((await f.call(alice, 'bootstrap')).headers.get('Cache-Control'), 'private, no-store');
});
test('public visitors cannot claim ownership of an empty space, even concurrently', async t => {
  const f = await fixture(t); const result = await Promise.all([f.join(alice), f.join(bob)]);
  assert.deepEqual(result.map(r => r.status), [503, 503]);
  assert.equal((await f.db.prepare('SELECT * FROM settings').all()).results.length, 0);
  assert.equal((await f.db.prepare('SELECT * FROM members').all()).results.length, 0);
});
test('signed-in visitors still need an invitation before any private operation', async t => {
  const f = await fixture(t); await f.seedOwner();
  assert.equal((await f.join(bob)).status,403);
  for (const path of ['members','invitations','conversations','messages?conversationId='+crypto.randomUUID()]) assert.equal((await f.call(bob,path)).status,403);
  for (const [path,data] of [['invitations',{email:other.email}],['members/revoke',{id:alice.userId}],['conversations',{peerId:alice.userId}],['messages',{}],['receipts',{}]]) assert.equal((await f.call(bob,path,data)).status,403);
  assert.equal((await f.call(bob,'bootstrap')).data.member,null);
});
test('invitations are email bound, one use, and stored as hashes', async t => {
  const f = await fixture(t); await f.seedOwner();
  const i = await f.invite(bob); const record = await f.db.prepare('SELECT * FROM invitations WHERE id=?').bind(i.id).first();
  assert.equal(record.token_hash.length, 64); assert.notEqual(record.token_hash, i.token); assert.ok(!Object.values(record).includes(i.token));
  assert.equal((await f.join(other, i.token)).status, 403);
  assert.equal((await f.join(bob, i.token)).status, 201);
  assert.equal((await f.join(bob, i.token)).status, 409);
  assert.equal((await f.join(carol, i.token)).status, 403);
});
test('expired and revoked invitations cannot enrol; handle conflicts do not consume invites', async t => {
  const f = await fixture(t); await f.seedOwner();
  const expired = await f.invite(bob); await f.db.prepare('UPDATE invitations SET expires_at=1 WHERE id=?').bind(expired.id).run(); assert.equal((await f.join(bob, expired.token)).status, 403);
  const revoked = await f.invite(bob); await f.call(alice, 'invitations/revoke', { id: revoked.id }); assert.equal((await f.join(bob, revoked.token)).status, 403);
  const valid = await f.invite(bob); assert.equal((await f.call(bob, 'join', { name: 'Bob', handle: 'alice', publicKey: keys.bob.publicKey, token: valid.token })).status, 409); assert.equal((await f.join(bob, valid.token)).status, 201);
});
test('only the owner can invite, revoke, or inspect invitation emails', async t => {
  const f = await fixture(t); await f.members();
  assert.equal((await f.call(bob, 'invitations')).status, 403);
  assert.equal((await f.call(bob, 'invitations', { email: other.email })).status, 403);
  assert.equal((await f.call(bob, 'members/revoke', { id: carol.userId })).status, 403);
  assert.equal((await f.call(alice, 'members/revoke', { id: alice.userId })).status, 400);
  const list = await f.call(bob, 'members'); assert.ok(!JSON.stringify(list.data).includes('@example.test'));
});
test('a real encrypted message reaches its recipient and is idempotent on retry', async t => {
  const f = await fixture(t); await f.members(); const id = await f.conversation();
  const plain = { v: 1, id: crypto.randomUUID(), conversationId: id, senderId: alice.userId, recipientId: bob.userId, text: 'Hello Bob, from Nairobi 👋' };
  const ciphertext = sealMessage(plain, keys.alice, keys.bob.publicKey);
  const sent = await f.call(alice, 'messages', ciphertext); assert.equal(sent.status, 201);
  const retry = await f.call(alice, 'messages', ciphertext); assert.equal(retry.status, 200); assert.equal(retry.data.message.seq, sent.data.message.seq);
  const inbox = await f.call(bob, `messages?conversationId=${id}`); assert.equal(inbox.data.messages.length, 1);
  assert.equal(openMessage(inbox.data.messages[0], keys.bob, { id: alice.userId, publicKey: keys.alice.publicKey }, bob.userId), plain.text);
  const stored = await f.db.prepare('SELECT * FROM messages').all(); assert.ok(!JSON.stringify(stored).includes(plain.text));
  const listing = await f.call(bob, 'conversations'); assert.equal(listing.data.conversations[0].unread, 1); assert.equal(listing.data.conversations[0].peer.id, alice.userId);
  await f.call(bob, 'receipts', { conversationId: id, upto: sent.data.message.seq, read: true });
  const aliceListing = await f.call(alice, 'conversations'); assert.equal(aliceListing.data.conversations[0].peerReadSeq, sent.data.message.seq);
});
test('third members cannot read, write, acknowledge, or discover another pair’s conversation', async t => {
  const f = await fixture(t); await f.members(); const id = await f.conversation();
  assert.equal((await f.call(carol, `messages?conversationId=${id}`)).status, 404);
  const e = sealMessage({ v: 1, id: crypto.randomUUID(), conversationId: id, senderId: 'carol', recipientId: 'bob', text: 'unauthorized' }, keys.carol, keys.bob.publicKey);
  assert.equal((await f.call(carol, 'messages', e)).status, 404);
  assert.equal((await f.call(carol, 'receipts', { conversationId: id, upto: 99999999, read: true })).status, 404);
  assert.equal((await f.call(carol, 'conversations')).data.conversations.length, 0);
});
test('ownership cannot be forged in the encrypted message API; key replacement is blocked', async t => {
  const f = await fixture(t); await f.members(); const id = await f.conversation();
  const e = sealMessage({ v: 1, id: crypto.randomUUID(), conversationId: id, senderId: 'alice', recipientId: 'bob', text: 'sender bound' }, keys.alice, keys.bob.publicKey);
  const r = await f.call(alice, 'messages', { ...e, senderId: 'carol' }); assert.equal(r.data.message.senderId, 'alice');
  assert.equal((await f.call(bob, 'messages', e)).status, 409);
  assert.equal((await f.call(alice, 'join', { name: 'Alice', handle: 'alice', publicKey: keys.other.publicKey })).status, 409);
});
test('revoking membership stops both sending and loading that conversation', async t => {
  const f = await fixture(t); await f.members(); const id = await f.conversation();
  assert.equal((await f.call(alice, 'members/revoke', { id: bob.userId })).status, 200);
  assert.equal((await f.call(bob, 'conversations')).status, 403);
  assert.equal((await f.call(alice, `messages?conversationId=${id}`)).status, 404);
  assert.equal((await f.call(alice, 'conversations', { peerId: bob.userId })).status, 404);
});
test('history pagination and forward cursors preserve more than one page of messages', async t => {
  const f = await fixture(t); await f.members(); const id = await f.conversation();
  const data = Array.from({ length: 205 }, (_, n) => { const p = { v: 1, id: crypto.randomUUID(), conversationId: id, senderId: 'alice', recipientId: 'bob', text: `message ${n}` }; return sealMessage(p, keys.alice, keys.bob.publicKey); });
  for (let start = 0; start < data.length; start += 40) await f.db.batch(data.slice(start, start + 40).map((e, offset) => f.db.prepare('INSERT INTO messages (id,conversation_id,sender_id,nonce,ciphertext,created_at) VALUES (?,?,?,?,?,?)').bind(e.id,id,'alice',e.nonce,e.ciphertext,start+offset)));
  const latest = await f.call(bob, `messages?conversationId=${id}`); assert.equal(latest.data.messages.length, 100); assert.equal(latest.data.hasMore, true);
  const older = await f.call(bob, `messages?conversationId=${id}&before=${latest.data.messages[0].seq}`); assert.equal(older.data.messages.length, 100);
  let after = 0; const received = [];
  for (let i=0;i<3;i++) { const r = await f.call(bob, `messages?conversationId=${id}&after=${after}`); received.push(...r.data.messages); after = r.data.messages.at(-1).seq; }
  assert.equal(received.length, 205); assert.equal(new Set(received.map(m => m.id)).size, 205);
});
