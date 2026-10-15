import type { KeyBackup } from "./crypto-core";
import type { Envelope } from "./chat-types";
type Stored = KeyBackup | (Envelope & { queuedAt?: number; failure?: string }) | string;
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const r = indexedDB.open("shadowchat-device", 1); r.onupgradeneeded = () => r.result.createObjectStore("device"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error("Browser storage is unavailable. Enable storage to keep your encrypted device key.")); });
}
export async function deviceGet<T extends Stored>(key: string): Promise<T | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const r = db.transaction("device").objectStore("device").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
export async function devicePut(key: string, value: Stored): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("device", "readwrite"); tx.objectStore("device").put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
export async function deviceDelete(key: string): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("device", "readwrite"); tx.objectStore("device").delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
export async function pendingMessages(accountId: string): Promise<Envelope[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const result: Envelope[] = []; const r = db.transaction("device").objectStore("device").openCursor(); r.onsuccess = () => { const c = r.result; if (!c) { resolve(result); return; } if (String(c.key).startsWith(`outbox:${accountId}:`)) result.push(c.value); c.continue(); }; r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
