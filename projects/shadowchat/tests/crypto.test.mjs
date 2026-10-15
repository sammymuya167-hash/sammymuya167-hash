import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createIdentity, sealMessage, openMessage, protectIdentity, unlockIdentity, safetyNumber, validPublicKey, b64, unb64 } from '../lib/crypto-core.ts';
const alice = createIdentity(), bob = createIdentity(), mallory = createIdentity();
const plain = text => ({ v: 1, id: crypto.randomUUID(), conversationId: crypto.randomUUID(), senderId: 'alice', recipientId: 'bob', text });
test('both intended endpoints can read the same authenticated ciphertext', () => {
  const p = plain('Hello, Nairobi 👋🏾\nA real private conversation.');
  const m = { ...sealMessage(p, alice, bob.publicKey), senderId: 'alice' };
  assert.equal(openMessage(m, bob, { id: 'alice', publicKey: alice.publicKey }, 'bob'), p.text);
  assert.equal(openMessage(m, alice, { id: 'bob', publicKey: bob.publicKey }, 'alice'), p.text);
  assert.ok(!m.ciphertext.includes('Nairobi'));
});
test('a third party cannot decrypt; tampered content fails authentication', () => {
  const m = { ...sealMessage(plain('private'), alice, bob.publicKey), senderId: 'alice' };
  assert.throws(() => openMessage(m, mallory, { id: 'alice', publicKey: alice.publicKey }, 'bob'));
  const bad = unb64(m.ciphertext); bad[10] ^= 1;
  assert.throws(() => openMessage({ ...m, ciphertext: b64(bad) }, bob, { id: 'alice', publicKey: alice.publicKey }, 'bob'));
});
test('message identity, conversation and sender cannot be substituted', () => {
  const m = { ...sealMessage(plain('bound to this chat'), alice, bob.publicKey), senderId: 'alice' };
  for (const change of [{ id: crypto.randomUUID() }, { conversationId: crypto.randomUUID() }, { senderId: 'mallory' }]) assert.throws(() => openMessage({ ...m, ...change }, bob, { id: 'alice', publicKey: alice.publicKey }, 'bob'));
});
test('random nonces differ even for identical message content', () => {
  const p = plain('same'); const a = sealMessage(p, alice, bob.publicKey), b = sealMessage(p, alice, bob.publicKey);
  assert.notEqual(a.nonce, b.nonce); assert.notEqual(a.ciphertext, b.ciphertext);
});
test('invalid and low-order public keys are rejected', () => {
  assert.equal(validPublicKey(bob.publicKey), true);
  assert.equal(validPublicKey(b64(new Uint8Array(32))), false);
  const one = new Uint8Array(32); one[0] = 1; assert.equal(validPublicKey(b64(one)), false);
  assert.equal(validPublicKey('not a key'), false);
});
test('passphrase protected backup restores only to its account and key', async () => {
  const saved = await protectIdentity(alice, 'alice', 'a long and private test passphrase');
  assert.ok(!JSON.stringify(saved).includes(b64(alice.secretKey)));
  const restored = await unlockIdentity(saved, 'alice', 'a long and private test passphrase');
  assert.equal(restored.publicKey, alice.publicKey); assert.deepEqual(restored.secretKey, alice.secretKey);
  await assert.rejects(unlockIdentity(saved, 'alice', 'wrong passphrase'));
  await assert.rejects(unlockIdentity(saved, 'mallory', 'a long and private test passphrase'));
  await assert.rejects(unlockIdentity({ ...saved, publicKey: bob.publicKey }, 'alice', 'a long and private test passphrase'));
  await assert.rejects(protectIdentity(alice, 'alice', 'short'));
});
test('both endpoints calculate the same safety number; changed identity changes it', async () => {
  assert.equal(await safetyNumber(alice.publicKey, bob.publicKey), await safetyNumber(bob.publicKey, alice.publicKey));
  assert.notEqual(await safetyNumber(alice.publicKey, bob.publicKey), await safetyNumber(alice.publicKey, mallory.publicKey));
});
test('vendored encryption implementation is byte identical to its fetched upstream blob', () => {
  const content = readFileSync(new URL('../lib/vendor/nacl-fast.cjs', import.meta.url));
  assert.equal(createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex'), '7ea5fb5883289b49f8d543f2d48af7132c3c6a6d');
});
