import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createIdentity, sealMessage, openMessage } from '../lib/crypto-core.ts';
const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { Miniflare } = require('miniflare');
test('production Worker, routes and D1 work together', async t => {
  const mf = new Miniflare({ modules: ['index.js', ...readdirSync('dist/server', {recursive:true}).filter(p=>p.endsWith('.js') && p !== 'index.js')].map(p=>({type:'ESModule',path:resolve('dist/server',p)})), modulesRoot: resolve('dist/server'), modulesRules: [{ type: 'ESModule', include: ['**/*.js', '**/*.mjs'], fallthrough: true }], compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], assets: { directory: resolve('dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true } } });
  t.after(() => mf.dispose()); const db = await mf.getD1Database('DB');
  for (const s of readFileSync('drizzle/0000_square_reavers.sql','utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean)) await db.prepare(s).run();
  const identities = { alice: createIdentity(), bob: createIdentity() };
  const headers = id => id ? { 'oai-authenticated-user-id': id, 'oai-authenticated-user-email': `${id}@example.test`, 'oai-authenticated-user-full-name': id, 'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8' } : {};
  const request = (id, path, data) => mf.dispatchFetch(`https://shadowchat.test${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { ...headers(id), Origin: 'https://shadowchat.test', 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'manual' });
  let chatId;
  await t.test('private page and API require hosted identity', async () => {
    assert.equal((await request(null,'/api/bootstrap')).status,401);
    const anonymous=await request(null,'/'); assert.ok([302,307].includes(anonymous.status));
    const page=await request('alice','/'); assert.equal(page.status,200); const html=await page.text(); assert.match(html,/ShadowChat/); assert.match(html,/Opening your private space/);
    assert.equal(page.headers.get('Cache-Control'),'private, no-store'); assert.match(page.headers.get('Content-Security-Policy'),/object-src 'none'/);
  });
  await t.test('production account and email-bound invitation routes work',async()=>{
    const owner=await request('alice','/api/join',{name:'Alice',handle:'alice',publicKey:identities.alice.publicKey}); assert.equal(owner.status,201);
    const i=await request('alice','/api/invitations',{email:'bob@example.test'}); const invite=await i.json(); assert.equal(i.status,201);
    const b=await request('bob','/api/join',{name:'Bob',handle:'bob',publicKey:identities.bob.publicKey,token:invite.token}); assert.equal(b.status,201);
    const c=await request('alice','/api/conversations',{peerId:'bob'}); assert.equal(c.status,201); chatId=(await c.json()).id;
  });
  await t.test('browser-compatible encryption survives production routing and storage',async()=>{
    const p={v:1,id:crypto.randomUUID(),conversationId:chatId,senderId:'alice',recipientId:'bob',text:'A private hello through the production Worker.'};
    const e=sealMessage(p,identities.alice,identities.bob.publicKey);
    assert.equal((await request('alice','/api/messages',e)).status,201);
    const inbox=await request('bob',`/api/messages?conversationId=${chatId}`); assert.equal(inbox.status,200); const payload=await inbox.json();
    assert.equal(openMessage(payload.messages[0],identities.bob,{id:'alice',publicKey:identities.alice.publicKey},'bob'),p.text);
    const other=await request('outsider',`/api/messages?conversationId=${chatId}`); assert.equal(other.status,403);
  });
  await t.test('install assets are served and the service worker never caches conversations',async()=>{
    const m=await mf.dispatchFetch('https://shadowchat.test/manifest.webmanifest'); assert.equal(m.status,200); const manifest=await m.json(); assert.equal(manifest.short_name,'ShadowChat');
    const icon=await mf.dispatchFetch('https://shadowchat.test/icon-192.png'); assert.equal(icon.status,200); assert.match(icon.headers.get('Content-Type'),/image\/png/);
    const sw=await mf.dispatchFetch('https://shadowchat.test/sw.js'); assert.equal(sw.status,200); const code=await sw.text(); assert.ok(!code.includes('caches.open')); assert.ok(!code.includes('cache.put'));
  });
});
