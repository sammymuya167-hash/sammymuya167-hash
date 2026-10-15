import nacl from "./vendor/nacl-fast.cjs";
import type { Envelope, Message, PlainMessage } from "./chat-types";

export type Identity = { publicKey: string; secretKey: Uint8Array };
export type KeyBackup = { format: "shadowchat-key-v1"; accountId: string; publicKey: string; salt: string; iv: string; encryptedKey: string; iterations: 600000 };
const utf8 = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function b64(bytes: Uint8Array): string { let s = ""; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); }
export function unb64(s: string): Uint8Array { return Uint8Array.from(atob(s), x => x.charCodeAt(0)); }
export function validPublicKey(s: unknown): s is string {
  if (typeof s !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(s)) return false;
  try { const p = unb64(s); return p.length === 32 && b64(p) === s && nacl.scalarMult(new Uint8Array(32).fill(7), p).some(x => x !== 0); } catch { return false; }
}
export function createIdentity(): Identity { const pair = nacl.box.keyPair(); return { publicKey: b64(pair.publicKey), secretKey: pair.secretKey }; }
export function sealMessage(input: PlainMessage, identity: Identity, recipientPublicKey: string): Envelope {
  if (!validPublicKey(recipientPublicKey) || !input.text.trim() || input.text.length > 4000) throw new Error("Message or contact key is invalid.");
  const encoded = utf8.encode(JSON.stringify(input));
  if (encoded.length > 15000) throw new Error("This message is too large. Split it into two messages.");
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(encoded, nonce, unb64(recipientPublicKey), identity.secretKey);
  return { id: input.id, conversationId: input.conversationId, nonce: b64(nonce), ciphertext: b64(ciphertext) };
}
export function openMessage(message: Message | (Envelope & { senderId: string }), identity: Identity, peer: { id: string; publicKey: string }, myId: string): string {
  if (!validPublicKey(peer.publicKey)) throw new Error("Contact key is invalid.");
  const plaintext = nacl.box.open(unb64(message.ciphertext), unb64(message.nonce), unb64(peer.publicKey), identity.secretKey);
  if (!plaintext) throw new Error("Message authentication failed.");
  const data: PlainMessage = JSON.parse(decoder.decode(plaintext));
  const expectedRecipient = message.senderId === myId ? peer.id : myId;
  if (data.v !== 1 || data.id !== message.id || data.conversationId !== message.conversationId || data.senderId !== message.senderId || data.recipientId !== expectedRecipient || ![myId, peer.id].includes(message.senderId) || typeof data.text !== "string" || data.text.length > 4000) throw new Error("Message context does not match.");
  return data.text;
}
async function wrappingKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", utf8.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: new Uint8Array(salt), iterations: 600000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function protectIdentity(identity: Identity, accountId: string, passphrase: string): Promise<KeyBackup> {
  if (passphrase.trim().length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  const salt = nacl.randomBytes(16), iv = nacl.randomBytes(12);
  const key = await wrappingKey(passphrase, salt);
  const aad = utf8.encode(JSON.stringify(["shadowchat-key-v1", accountId, identity.publicKey]));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(iv), additionalData: aad }, key, new Uint8Array(identity.secretKey));
  return { format: "shadowchat-key-v1", accountId, publicKey: identity.publicKey, salt: b64(salt), iv: b64(iv), encryptedKey: b64(new Uint8Array(encrypted)), iterations: 600000 };
}
export async function unlockIdentity(raw: unknown, accountId: string, passphrase: string): Promise<Identity> {
  const backup = raw as KeyBackup;
  if (!backup || backup.format !== "shadowchat-key-v1" || backup.accountId !== accountId || backup.iterations !== 600000 || !validPublicKey(backup.publicKey) || typeof backup.salt !== "string" || typeof backup.iv !== "string" || typeof backup.encryptedKey !== "string") throw new Error("This is not a key backup for this account.");
  const salt = unb64(backup.salt), iv = unb64(backup.iv), encrypted = unb64(backup.encryptedKey);
  if (salt.length !== 16 || iv.length !== 12 || encrypted.length !== 48) throw new Error("Key backup is damaged.");
  try {
    const key = await wrappingKey(passphrase, salt);
    const secretKey = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv), additionalData: utf8.encode(JSON.stringify([backup.format, accountId, backup.publicKey])) }, key, new Uint8Array(encrypted)));
    if (b64(nacl.box.keyPair.fromSecretKey(secretKey).publicKey) !== backup.publicKey) { secretKey.fill(0); throw new Error("Key mismatch"); }
    return { publicKey: backup.publicKey, secretKey };
  } catch { throw new Error("Could not unlock this key. Check your passphrase and backup."); }
}
export async function safetyNumber(a: string, b: string): Promise<string> {
  const pair = [a, b].sort();
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", utf8.encode(JSON.stringify(["shadowchat-safety-v1", ...pair]))));
  return Array.from(hash, x => x.toString(16).padStart(2, "0")).join("").match(/.{1,4}/g)!.join(" ");
}
