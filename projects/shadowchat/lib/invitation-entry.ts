// Keep invitation capabilities in this tab while hosted sign-in navigates away.
// The auth return URL stays token-free; tokens never enter HTTP query strings.
type InvitationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const SLOT = "shadowchat-pending-invitation";
const MAX_AGE = 48 * 3600000;
const validToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function pendingInvitation(hash: string, storage?: InvitationStorage, now = Date.now()): string {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("invite");
  if (validToken(token)) {
    try { storage?.setItem(SLOT, JSON.stringify({ token, expiresAt: now + MAX_AGE })); } catch { /* Pasting the original link after sign-in still works. */ }
    return token;
  }
  try {
    const saved = JSON.parse(storage?.getItem(SLOT) ?? "null");
    if (saved && validToken(saved.token) && Number.isFinite(saved.expiresAt) && saved.expiresAt > now && saved.expiresAt <= now + MAX_AGE) return saved.token;
    storage?.removeItem(SLOT);
  } catch { /* Storage is optional until identity setup. */ }
  return "";
}

export function clearPendingInvitation(storage?: InvitationStorage) {
  try { storage?.removeItem(SLOT); } catch { /* No retained token to clear. */ }
}
