"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Bell, Check, CheckCheck, ChevronRight, Copy, Download, KeyRound, LockKeyhole, LogOut, MessageCircle, Plus, Search, Send, Settings, ShieldCheck, Smartphone, Sparkles, Upload, UserPlus, Users, WifiOff, X } from "lucide-react";
import { createIdentity, openMessage, protectIdentity, safetyNumber, sealMessage, unlockIdentity } from "../lib/crypto-core";
import type { Identity, KeyBackup } from "../lib/crypto-core";
import { deviceDelete, deviceGet, devicePut, pendingMessages } from "../lib/device-store";
import type { Bootstrap, Conversation, Envelope, Invitation, Member, Message } from "../lib/chat-types";

type Queued = Envelope & { queuedAt?: number; failure?: string };
type Panel = "invite" | "people" | "settings" | "privacy" | "verify" | "devices" | null;
const ANDROID_APK = "/downloads/shadowchat-android-v0.2.0.apk";
class APIError extends Error { readonly status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
async function api<T>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(`/api/${path}`, { method: data === undefined ? "GET" : "POST", headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data), cache: "no-store" });
  if (r.status === 401) throw new APIError("Your sign-in has expired. Reload to sign in again.", 401);
  let value: unknown; try { value = await r.json(); } catch { throw new APIError("Could not reach ShadowChat. Check your connection and reload.", r.status); }
  if (!r.ok) { const detail = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "Could not complete this request."; throw new APIError(detail, r.status); }
  return value as T;
}
const time = (n: number) => new Date(n).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const initial = (s: string) => s.trim().slice(0, 1).toUpperCase();
function Brand({ small = false }: { small?: boolean }) { return <div className={`brand ${small ? "small" : ""}`}><span className="brand-icon"><MessageCircle size={small ? 23 : 29} strokeWidth={2.2} /><i /></span>{!small && <span>Shadow<span className="brand-light">Chat</span><small>BY SHADOWNET</small></span>}</div>; }
function Avatar({ name, className = "" }: { name: string; className?: string }) { return <span className={`avatar ${className}`} aria-hidden="true">{initial(name)}</span>; }
function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); const el = ref.current; return () => el?.close(); }, []);
  return <dialog ref={ref} className={`modal ${wide ? "wide" : ""}`} aria-labelledby="modal-title" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button></div>{children}</dialog>;
}

export default function ShadowChat() {
  const [boot, setBoot] = useState<Bootstrap | null>(null), [fatal, setFatal] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null), identityRef = useRef<Identity | null>(null);
  const [backup, setBackup] = useState<KeyBackup | null>(null), [storageReady, setStorageReady] = useState(false);
  const [passphrase, setPassphrase] = useState(""), [confirm, setConfirm] = useState(""), [name, setName] = useState(""), [handle, setHandle] = useState(""), [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [toast, setToast] = useState("");
  const [chats, setChats] = useState<Conversation[]>([]), [members, setMembers] = useState<Member[]>([]), [activeId, setActiveId] = useState<string | null>(null), activeRef = useRef<string | null>(null);
  const [byChat, setByChat] = useState<Record<string, Message[]>>({}), messagesRef = useRef<Record<string, Message[]>>({});
  const [hasOlder, setHasOlder] = useState<Record<string, boolean>>({}), [outbox, setOutbox] = useState<Queued[]>([]);
  const [draft, setDraft] = useState(""), [search, setSearch] = useState(""), [unreadOnly, setUnreadOnly] = useState(false);
  const [panel, setPanel] = useState<Panel>(null), [online, setOnline] = useState(true), [syncError, setSyncError] = useState("");
  const [inviteEmail, setInviteEmail] = useState(""), [inviteLink, setInviteLink] = useState(""), [invitations, setInvitations] = useState<Invitation[]>([]);
  const [number, setNumber] = useState(""), [verified, setVerified] = useState<Record<string, string>>({}), [pins, setPins] = useState<Record<string, string>>({});
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default"), [showRelease, setShowRelease] = useState(false), [backedUp, setBackedUp] = useState(false);
  const syncBusy = useRef(false), flushBusy = useRef(false), bottom = useRef<HTMLDivElement>(null), seen = useRef<Record<string, number>>({}), lastActivity = useRef(Date.now());
  const me = boot?.member, active = chats.find(c => c.id === activeId) ?? null;
  identityRef.current = identity; activeRef.current = activeId; messagesRef.current = byChat;

  const lock = useCallback(() => {
    identityRef.current?.secretKey.fill(0); identityRef.current = null;
    setIdentity(null); setDraft(""); setByChat({}); messagesRef.current = {}; setChats([]); setMembers([]); setOutbox([]); setPassphrase(""); setConfirm(""); setPanel(null); setError("");
  }, []);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 5000); return () => clearTimeout(t); }, [toast]);
  const load = useCallback(async () => {
    try {
      setFatal(""); const b = await api<Bootstrap>("bootstrap"); setBoot(b); setName(b.user.name.includes("@") ? "" : b.user.name);
      const saved = b.member ? await deviceGet<KeyBackup>(`key:${b.user.id}:${b.member.publicKey}`) : undefined; setBackup(saved ?? null); setBackedUp(Boolean(await deviceGet(`backedup:${b.user.id}`))); setStorageReady(true);
    } catch (e) { setFatal(e instanceof Error ? e.message : "Could not open ShadowChat."); }
  }, []);
  useEffect(() => {
    void load(); const token = new URLSearchParams(location.hash.slice(1)).get("invite"); if (token) { setInviteCode(token); history.replaceState(null, "", location.pathname); }
    setOnline(navigator.onLine); setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener("online", up); window.addEventListener("offline", down);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [load]);
  useEffect(() => {
    if (!identity) return; lastActivity.current = Date.now();
    const touch = () => { lastActivity.current = Date.now(); };
    for (const event of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(event, touch, { passive: true });
    const t = setInterval(() => { if (Date.now() - lastActivity.current >= 10 * 60000) { lock(); notify("ShadowChat locked after 10 minutes of inactivity."); } }, 15000);
    const hide = () => { if (document.visibilityState === "visible" && Date.now() - lastActivity.current >= 10 * 60000) lock(); };
    document.addEventListener("visibilitychange", hide);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", hide); for (const event of ["pointerdown", "keydown", "touchstart"]) window.removeEventListener(event, touch); };
  }, [identity, lock, notify]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [activeId, byChat[activeId ?? ""]?.length, outbox.length]);
  useEffect(() => { setDraft(""); }, [activeId]);

  const updateMessages = useCallback((id: string, data: Message[]) => {
    setByChat(old => { const map = new Map((old[id] ?? []).map(m => [m.id, m])); for (const m of data) map.set(m.id, m); const next = { ...old, [id]: [...map.values()].sort((a, b) => a.seq - b.seq) }; messagesRef.current = next; return next; });
  }, []);
  const sync = useCallback(async () => {
    if (!identityRef.current || !me || syncBusy.current || !navigator.onLine) return;
    syncBusy.current = true;
    try {
      const data = await api<{ conversations: Conversation[] }>("conversations");
      if (!identityRef.current) return;
      setChats(data.conversations);
      const nextPins: Record<string, string> = {}, nextVerified: Record<string, string> = {};
      for (const c of data.conversations) {
        const stored = await deviceGet<string>(`pin:${me.id}:${c.peer.id}`);
        if (!stored) await devicePut(`pin:${me.id}:${c.peer.id}`, c.peer.publicKey);
        nextPins[c.peer.id] = stored ?? c.peer.publicKey;
        const v = await deviceGet<string>(`verified:${me.id}:${c.peer.id}`); if (v) nextVerified[c.peer.id] = v;
        if (seen.current[c.id] !== undefined && c.last && c.last.seq > seen.current[c.id] && c.last.senderId !== me.id && document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("ShadowChat", { body: "You have a new encrypted message.", icon: "/icon-192.png", tag: "shadowchat-message" });
        seen.current[c.id] = c.last?.seq ?? 0;
      }
      setPins(nextPins); setVerified(nextVerified);
      const id = activeRef.current, selected = data.conversations.find(c => c.id === id);
      if (id && !selected) setActiveId(null);
      if (id && selected) {
        const existing = messagesRef.current[id], after = existing?.length ? Math.max(...existing.map(m => m.seq)) : null;
        const result = await api<{ messages: Message[]; hasMore: boolean; peerReadSeq: number; peerDeliveredSeq: number }>(`messages?conversationId=${id}${after !== null ? `&after=${after}` : ""}`);
        if (!identityRef.current) return;
        updateMessages(id, result.messages); if (after === null) setHasOlder(p => ({ ...p, [id]: result.hasMore }));
        setChats(p => p.map(c => c.id === id ? { ...c, peerReadSeq: result.peerReadSeq, peerDeliveredSeq: result.peerDeliveredSeq } : c));
        if (nextPins[selected.peer.id] === selected.peer.publicKey) {
          const all = [...(existing ?? []), ...result.messages];
          for (const m of result.messages) openMessage(m, identityRef.current, selected.peer, me.id);
          if (all.length) await api("receipts", { conversationId: id, upto: Math.max(...all.map(m => m.seq)), read: !document.hidden && activeRef.current === id });
        }
      }
      setSyncError("");
    } catch (e) {
      if (e instanceof APIError && e.status === 403) { lock(); void load(); }
      setSyncError(e instanceof Error ? e.message : "Could not sync messages.");
    } finally { syncBusy.current = false; }
  }, [me, updateMessages, lock, load]);
  const flush = useCallback(async () => {
    if (!me || !identityRef.current || !navigator.onLine || flushBusy.current) return;
    flushBusy.current = true;
    try {
      const pending: Queued[] = await pendingMessages(me.id);
      for (const q of pending) {
        if (!identityRef.current || !navigator.onLine) break; if (q.failure) continue;
        try { const r = await api<{ message: Message }>("messages", { id: q.id, conversationId: q.conversationId, nonce: q.nonce, ciphertext: q.ciphertext }); await deviceDelete(`outbox:${me.id}:${q.id}`); if (identityRef.current) updateMessages(q.conversationId, [r.message]); }
        catch (e) { if (e instanceof APIError && [400, 403, 404, 409].includes(e.status)) await devicePut(`outbox:${me.id}:${q.id}`, { ...q, failure: e.message }); break; }
      }
      if (identityRef.current) setOutbox(await pendingMessages(me.id));
    } catch (e) { setSyncError(e instanceof Error ? e.message : "Could not access the message queue."); }
    finally { flushBusy.current = false; }
  }, [me, updateMessages]);
  useEffect(() => { if (!identity) return; void sync(); void flush(); const t = setInterval(() => { void sync(); void flush(); }, 2500); const visible = () => { if (!document.hidden) { void sync(); void flush(); } }; document.addEventListener("visibilitychange", visible); return () => { clearInterval(t); document.removeEventListener("visibilitychange", visible); }; }, [identity, sync, flush, activeId, online]);
  useEffect(() => {
    if (!identity || !boot) return;
    try { if (localStorage.getItem(`shadowchat-release:${boot.user.id}`) !== boot.release) setShowRelease(true); } catch { setShowRelease(true); }
  }, [identity, boot]);
  useEffect(() => {
    if (!identity || !panel) return; setError("");
    if (["people", "invite"].includes(panel)) void api<{ members: Member[] }>("members").then(r => setMembers(r.members)).catch(e => setError(e.message));
    if (panel === "invite" && me?.role === "owner") void api<{ invitations: Invitation[] }>("invitations").then(r => setInvitations(r.invitations)).catch(e => setError(e.message));
    if (panel === "verify" && active && identity) void safetyNumber(identity.publicKey, active.peer.publicKey).then(setNumber);
  }, [panel, identity, me?.role, active?.peer.id]);

  async function enter(event: FormEvent) {
    event.preventDefault(); if (!boot || busy) return; setBusy(true); setError("");
    let created: Identity | null = null;
    try {
      if (boot.member) {
        if (!backup) throw new Error("Restore your encrypted key backup to unlock this browser.");
        const unlocked = await unlockIdentity(backup, boot.user.id, passphrase);
        if (unlocked.publicKey !== boot.member.publicKey) { unlocked.secretKey.fill(0); throw new Error("This key does not match your registered identity."); }
        setIdentity(unlocked);
      } else {
        if (passphrase !== confirm) throw new Error("Your passphrases do not match.");
        created = createIdentity(); const protectedKey = await protectIdentity(created, boot.user.id, passphrase);
        // Keep a recoverable encrypted key before registering its public identity.
        // Distinct key slots prevent simultaneous enrolment in two tabs from
        // overwriting the private key that wins server-side registration.
        await devicePut(`key:${boot.user.id}:${created.publicKey}`, protectedKey);
        const match = inviteCode.match(/[a-f0-9]{64}/), token = match?.[0] ?? "";
        const r = await api<{ member: Member }>("join", { handle, name, publicKey: created.publicKey, token });
        setBackup(protectedKey); setBoot({ ...boot, member: r.member, initialized: true }); setIdentity(created); created = null;
      }
      setPassphrase(""); setConfirm(""); lastActivity.current = Date.now();
    } catch (e) { created?.secretKey.fill(0); setError(e instanceof Error ? e.message : "Could not unlock ShadowChat."); }
    finally { setBusy(false); }
  }
  async function restore(file: File | undefined) {
    if (!file || !boot) return; setBusy(true); setError("");
    try {
      if (file.size > 16000) throw new Error("Choose your small ShadowChat key backup file.");
      const data = JSON.parse(await file.text()); const key = await unlockIdentity(data, boot.user.id, passphrase);
      if (key.publicKey !== boot.member?.publicKey) { key.secretKey.fill(0); throw new Error("This backup does not match your account."); }
      await devicePut(`key:${boot.user.id}:${key.publicKey}`, data); setBackup(data); setIdentity(key); setPassphrase("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restore this backup."); } finally { setBusy(false); }
  }
  function exportBackup() {
    if (!backup || !me) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `shadowchat-${me.handle}-encrypted-key.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 3000); setBackedUp(true); void devicePut(`backedup:${me.id}`, "yes").catch(() => {}); notify("Encrypted key downloaded. Keep it somewhere private.");
  }
  async function startChat(peer: Member) {
    setBusy(true); setError("");
    try { const r = await api<{ id: string }>("conversations", { peerId: peer.id }); setActiveId(r.id); activeRef.current = r.id; setPanel(null); await sync(); } catch (e) { setError(e instanceof Error ? e.message : "Could not start chat."); } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !identity || !me || !active || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      if (!pins[active.peer.id] || pins[active.peer.id] !== active.peer.publicKey) throw new Error("Contact key changed or is still loading. Messaging is paused.");
      const id = crypto.randomUUID(), q: Queued = { ...sealMessage({ v: 1, id, conversationId: active.id, senderId: me.id, recipientId: active.peer.id, text: draft.trim() }, identity, active.peer.publicKey), queuedAt: Date.now() };
      await devicePut(`outbox:${me.id}:${id}`, q); setOutbox(await pendingMessages(me.id)); if (activeRef.current === active.id) setDraft(""); void flush();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not encrypt this message."); } finally { setBusy(false); }
  }
  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const r = await api<{ token: string }>("invitations", { email: inviteEmail }); setInviteLink(`${location.origin}/#invite=${r.token}`); const list = await api<{ invitations: Invitation[] }>("invitations"); setInvitations(list.invitations); } catch (e) { setError(e instanceof Error ? e.message : "Could not create invitation."); } finally { setBusy(false); }
  }
  async function revoke(id: string, invitation = false) {
    if (!window.confirm(invitation ? "Revoke this invitation?" : "Remove this person's access? They will keep any messages already downloaded.")) return;
    setBusy(true); setError("");
    try { await api(invitation ? "invitations/revoke" : "members/revoke", { id }); const [m, i] = await Promise.all([api<{ members: Member[] }>("members"), api<{ invitations: Invitation[] }>("invitations")]); setMembers(m.members); setInvitations(i.invitations); await sync(); notify("Access updated."); } catch (e) { setError(e instanceof Error ? e.message : "Could not update access."); } finally { setBusy(false); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); notify("Copied to clipboard."); } catch { notify("Clipboard is unavailable. Select and copy the text manually."); } }
  async function older() {
    if (!active || !byChat[active.id]?.length) return; setBusy(true);
    try { const r = await api<{ messages: Message[]; hasMore: boolean }>(`messages?conversationId=${active.id}&before=${Math.min(...byChat[active.id].map(m => m.seq))}`); updateMessages(active.id, r.messages); setHasOlder(p => ({ ...p, [active.id]: r.hasMore })); } catch (e) { setError(e instanceof Error ? e.message : "Could not load messages."); } finally { setBusy(false); }
  }
  const visibleChats = chats.filter(c => (!unreadOnly || c.unread > 0) && `${c.peer.name} ${c.peer.handle}`.toLowerCase().includes(search.toLowerCase()));
  const messageViews = useMemo(() => {
    if (!identity || !active || !me) return [];
    const server = byChat[active.id] ?? [], ids = new Set(server.map(x => x.id));
    const pending: (Message & { queued?: boolean; failure?: string })[] = outbox.filter(q => q.conversationId === active.id && !ids.has(q.id)).map(q => ({ ...q, seq: Number.MAX_SAFE_INTEGER, createdAt: q.queuedAt ?? Date.now(), senderId: me.id, queued: true }));
    return [...server, ...pending].map(m => { try { if (pins[active.peer.id] !== active.peer.publicKey) throw new Error(); return { ...m, text: openMessage(m, identity, active.peer, me.id), invalid: false }; } catch { return { ...m, text: "This message could not be authenticated.", invalid: true }; } });
  }, [identity, active, me, byChat, outbox, pins]);

  if (!boot || !storageReady || !identity || me?.status === "revoked") return <main className="entry">
    <section className="entry-story"><Brand /><div className="entry-copy"><span className="eyebrow"><span className="live-dot" /> A SPACE FOR YOUR INNER CIRCLE</span><h1>Good conversations<br />deserve a <em>private space.</em></h1><p>Just you, your people, and the things<br className="desktop-only" /> you actually want to say.</p><div className="orbit-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="orb-center"><LockKeyhole size={44} /></div><div className="orbit-note note-one"><MessageCircle size={18} /><span>Your people. Your space.</span></div><div className="orbit-note note-two"><ShieldCheck size={18} /><span>By invitation only</span></div><span className="orbit-spark spark-one" /><span className="orbit-spark spark-two" /></div></div><div className="entry-footer"><LockKeyhole size={14} /> Private by invitation <span>·</span> Built by SHADOWNET</div></section>
    <section className="entry-form"><div className="entry-mobile-brand"><Brand /></div><div className="onboarding-card">
      {fatal ? <><span className="welcome-icon"><WifiOff /></span><h2>Let’s reconnect.</h2><p className="muted">{fatal}</p><button className="primary full" onClick={() => void load()}>Try again</button></> : !boot || !storageReady ? <><div className="loading-orb" /><h2>Opening your private space…</h2><p className="muted">Checking your account and device.</p></> : me?.status === "revoked" ? <><span className="welcome-icon"><LockKeyhole /></span><h2>Access removed</h2><p className="muted">The owner has removed this account from the circle.</p><a className="text-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></> : <>
        <span className="section-label">SHADOWCHAT / {me ? "WELCOME BACK" : "GET STARTED"}</span><h2>{me ? `Hello, ${me.name.split(" ")[0]}.` : boot.initialized ? "You’re invited." : "Make room for your people."}</h2><p className="muted">{me ? backup ? "Unlock this browser to pick up the conversation." : "Use your existing encrypted key to see the same conversations on this device." : "Choose your name and protect your private message key."}</p>
        {me && !backup && <div className="device-restore-note"><Smartphone size={18} /><div><strong>Already using ShadowChat on another screen?</strong><p>On that device, open Settings and save your encrypted recovery key. Bring that file here, enter the same passphrase below, then choose Restore encrypted key. Use the same ChatGPT account on both devices.</p></div></div>}<form onSubmit={enter} className="setup-form">
          {!me && <><label htmlFor="display-name">Your name</label><input id="display-name" autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} maxLength={50} required placeholder="What should we call you?" /><label htmlFor="username">Username</label><div className="input-prefix"><span>@</span><input id="username" value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} pattern="[a-z][a-z0-9_]{2,23}" minLength={3} maxLength={24} autoCapitalize="none" autoComplete="username" required placeholder="your_name" /></div>{boot.initialized && <><label htmlFor="invite-code">Invitation code or link</label><input id="invite-code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} autoCapitalize="none" required placeholder="Paste the invitation from your friend" /></>}</>}
          <label htmlFor="passphrase">{me ? "Your key passphrase" : "Create a key passphrase"}</label><input id="passphrase" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} minLength={me ? undefined : 12} autoComplete={me ? "current-password" : "new-password"} required placeholder={me ? "Enter your passphrase" : "At least 12 characters"} />
          {!me && <><label htmlFor="confirm-passphrase">Confirm passphrase</label><input id="confirm-passphrase" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" minLength={12} required placeholder="Enter the same passphrase again" /></>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {me && !backup ? <label className={`primary full file-button ${busy ? "disabled" : ""}`}><Upload size={17} />{busy ? "Restoring…" : "Restore encrypted key"}<input type="file" accept="application/json,.json" disabled={busy || !passphrase} onChange={e => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label> : <button className="primary full" disabled={busy}>{busy ? "One moment…" : me ? "Unlock ShadowChat" : boot.initialized ? "Accept invitation" : "Create my private space"}<ArrowUpRight size={18} /></button>}
        </form>
        {me && backup && <label className="text-link file-button">Restore a different encrypted backup<input type="file" accept="application/json,.json" disabled={busy || !passphrase} onChange={e => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label>}<div className="key-note"><KeyRound size={18} /><p>Your passphrase stays on this device. Save an encrypted key backup after joining. We cannot reset a lost message key.</p></div><div className="signed-as">Signed in as <strong>{boot.user.email}</strong><a href="/signout-with-chatgpt?return_to=%2F" target="_top">Switch account</a></div>
      </>}
    </div><span className="entry-version">SHADOWCHAT V0.2 · ONE ACCOUNT, EVERY SCREEN</span><a className="entry-apk-link" href={ANDROID_APK} download><Smartphone size={13} />Download the Android APK</a></section>{toast && <div className="toast" role="status">{toast}</div>}
  </main>;

  return <main className={`messenger ${activeId ? "chat-is-open" : ""}`}>
    <nav className="nav-rail" aria-label="Main navigation"><Brand small /><div className="rail-links"><button className={!panel ? "rail-button selected" : "rail-button"} onClick={() => setPanel(null)} aria-label="Conversations" title="Conversations"><MessageCircle size={23} /><span className="rail-pip" /></button><button className={`rail-button ${panel === "people" ? "selected" : ""}`} onClick={() => setPanel("people")} aria-label="Your people" title="Your people"><Users size={23} /></button><button className={`rail-button ${panel === "privacy" ? "selected" : ""}`} onClick={() => setPanel("privacy")} aria-label="Privacy information" title="Privacy"><ShieldCheck size={23} /></button></div><div className="rail-bottom"><button className="rail-button" onClick={() => setPanel("settings")} aria-label="Settings" title="Settings"><Settings size={22} /></button><button className="my-avatar" onClick={() => setPanel("settings")} aria-label="Your profile">{initial(me!.name)}</button></div></nav>
    <aside className="chat-sidebar"><div className="sidebar-brand"><span>Shadow<span>Chat</span><small>BY SHADOWNET</small></span><span className="private-tag"><LockKeyhole size={11} /> PRIVATE</span><button className="mobile-profile-button" onClick={() => setPanel("settings")} aria-label="Your profile and settings"><Avatar name={me!.name} /></button></div><div className="sidebar-heading"><h1>Conversations<span>{chats.length.toString().padStart(2, "0")}</span></h1><button className="square-button" onClick={() => setPanel("people")} aria-label="New conversation"><Plus size={21} /></button></div><label className="search-field"><Search size={17} /><input aria-label="Search conversations" placeholder="Search your conversations" value={search} onChange={e => setSearch(e.target.value)} /><kbd>⌕</kbd></label><div className="chat-filters"><button className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>All chats</button><button className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>Unread{chats.reduce((n, c) => n + c.unread, 0) > 0 && <span>{chats.reduce((n, c) => n + c.unread, 0)}</span>}</button></div><div className="conversation-list">
      {visibleChats.map(c => <button key={c.id} className={`conversation-item ${activeId === c.id ? "active" : ""}`} onClick={() => { setActiveId(c.id); setError(""); }}><Avatar name={c.peer.name} /><span className="conversation-copy"><strong>{c.peer.name}<time>{time(c.updatedAt)}</time></strong><span>{c.last ? c.last.senderId === me!.id ? "You sent an encrypted message" : "Encrypted message" : "Say your first hello"}{c.unread > 0 && <b>{c.unread}</b>}</span></span></button>)}
      {!visibleChats.length && <div className="sidebar-empty"><span><MessageCircle size={25} /></span><h3>{chats.length ? "No conversations found" : "A quiet start."}</h3><p>{chats.length ? "Try a different search or filter." : "Your conversations will appear here. Bring someone into your circle."}</p><button className="text-link" onClick={() => setPanel(me!.role === "owner" ? "invite" : "people")}>{me!.role === "owner" ? "Invite your first person" : "Find your people"}<ChevronRight size={15} /></button></div>}
    </div><div className="sidebar-bottom"><div className="connection"><span className={`live-dot ${!online ? "offline" : ""}`} />{online ? syncError ? "Reconnecting…" : "Connected" : "Offline · messages will queue"}<span>v{boot.release}</span></div><button className="circle-invite" onClick={() => setPanel(me!.role === "owner" ? "invite" : "people")}><span><UserPlus size={20} /></span><span><strong>Your circle, your choice.</strong><small>{me!.role === "owner" ? "Invite someone you trust" : "Meet the approved members"}</small></span><ArrowUpRight size={17} /></button></div></aside>
    <section className="chat-main" aria-label={active ? `Conversation with ${active.peer.name}` : "Welcome to ShadowChat"}>
      <header className="main-header">{active ? <><button className="icon-button back-chat" onClick={() => setActiveId(null)} aria-label="Back to conversations"><ArrowLeft size={21} /></button><Avatar name={active.peer.name} /><span className="header-person"><strong>{active.peer.name}</strong><small>@{active.peer.handle}</small></span><button className="encryption-chip" onClick={() => setPanel("verify")}><LockKeyhole size={13} />Encrypted chat<ChevronRight size={13} /></button></> : <><span className="header-breadcrumb">Your space <span>/</span> Conversations</span><span className="header-date">{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></>}<button className="icon-button header-lock" onClick={lock} aria-label="Lock ShadowChat" title="Lock ShadowChat"><LockKeyhole size={19} /></button><button className="icon-button mobile-settings" onClick={() => setPanel("settings")} aria-label="Settings"><Settings size={19} /></button></header>
      {showRelease && <div className="release-banner"><Sparkles size={16} /><span><strong>ShadowChat for Android is here.</strong> Use the same account and recovery key to keep your conversations in sync.</span><a className="release-download" href={ANDROID_APK} download><Download size={13} />Get APK</a><button aria-label="Dismiss update" onClick={() => { setShowRelease(false); try { localStorage.setItem(`shadowchat-release:${me!.id}`, boot.release); } catch {} }}><X size={16} /></button></div>}
      {!backedUp && <div className="backup-banner"><KeyRound size={15} /><span>Keep your conversations yours. Save your encrypted recovery key.</span><button onClick={exportBackup}>Save key<Download size={13} /></button></div>}
      {(syncError || error) && <div className="sync-error" role="status">{error || syncError}<button onClick={() => { setError(""); void sync(); }}>Retry</button></div>}
      {active ? <><div className="message-scroll"><div className="conversation-start"><span><LockKeyhole size={15} /></span><p>Only you and {active.peer.name.split(" ")[0]} hold the keys to this conversation.</p><button onClick={() => setPanel("verify")}>Compare safety numbers</button></div>{hasOlder[active.id] && <button className="load-older" disabled={busy} onClick={() => void older()}>Load earlier messages</button>}{!messageViews.length && <div className="first-message"><span>✦</span><h2>Every conversation<br />starts with a hello.</h2><p>Send {active.peer.name.split(" ")[0]} your first message.</p></div>}
        {messageViews.map((m, i) => { const mine = m.senderId === me!.id, date = new Date(m.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), previous = i ? new Date(messageViews[i - 1].createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null; const queued = "queued" in m && m.queued, failure = "failure" in m && typeof m.failure === "string" ? m.failure : ""; return <div key={m.id}>{date !== previous && <div className="date-separator"><span>{date}</span></div>}<div className={`message-row ${mine ? "mine" : "theirs"}`}><div className={`message-bubble ${m.invalid ? "invalid-message" : ""}`}><p>{m.text}</p><span className="message-meta">{time(m.createdAt)}{mine && <span aria-label={failure ? "Failed to send" : queued ? "Queued" : m.seq <= active.peerReadSeq ? "Read" : m.seq <= active.peerDeliveredSeq ? "Delivered" : "Sent"}>{failure ? "Failed" : queued ? "Queued" : m.seq <= active.peerReadSeq ? <CheckCheck className="read-receipt" size={15} /> : m.seq <= active.peerDeliveredSeq ? <CheckCheck size={15} /> : <Check size={15} />}</span>}</span></div></div>{failure && <div className="failed-message">{failure}<button onClick={() => { const q = outbox.find(x => x.id === m.id); if (q) void devicePut(`outbox:${me!.id}:${q.id}`, { ...q, failure: undefined }).then(() => flush()); }}>Retry</button><button onClick={() => void deviceDelete(`outbox:${me!.id}:${m.id}`).then(async () => setOutbox(await pendingMessages(me!.id)))}>Discard</button></div>}</div>; })}<div ref={bottom} /></div><form className="composer" onSubmit={send}><div className="composer-input"><textarea aria-label="Message" placeholder="Write something just for them…" value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} rows={1} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button className="send-button" disabled={busy || !draft.trim() || pins[active.peer.id] !== active.peer.publicKey} aria-label="Send message"><Send size={19} /></button></div><div className="composer-footer"><span><LockKeyhole size={11} />Encrypted on your device</span><span>{draft.length ? `${draft.length}/4000 · ` : ""}Enter to send · Shift + Enter for a new line</span></div></form></> : <div className="welcome-main"><span className="welcome-eyebrow"><span className="live-dot" /> YOUR OWN LITTLE CORNER OF THE INTERNET</span><div className="welcome-illustration" aria-hidden="true"><span className="illustration-ring ring-a" /><span className="illustration-ring ring-b" /><div className="illustration-bubble bubble-a"><span /><span /><span /></div><div className="illustration-bubble bubble-b"><LockKeyhole size={34} /></div><i className="tiny-star star-a">✦</i><i className="tiny-star star-b">✧</i><span className="floating-pill"><ShieldCheck size={13} /> Invite-only</span></div><h2>Your people.<br /><em>Your private space.</em></h2><p>Less noise. More real conversations.<br />Start a chat with someone in your circle.</p><button className="primary" onClick={() => setPanel(me!.role === "owner" ? "invite" : "people")}>{me!.role === "owner" ? <UserPlus size={18} /> : <MessageCircle size={18} />}{me!.role === "owner" ? "Invite someone" : "Start a conversation"}<ArrowUpRight size={17} /></button><button className="quiet-link" onClick={() => setPanel("privacy")}>How your privacy works<ChevronRight size={14} /></button><div className="welcome-features"><span><LockKeyhole size={17} />Encrypted messages</span><i /><span><Users size={17} />Approved people</span><i /><span><KeyRound size={17} />Your keys, your device</span></div></div>}
      <footer className="main-footer"><span>MADE FOR CONVERSATIONS THAT MATTER</span><span>SHADOWNET <i>✦</i></span></footer>
    </section>
    {panel && <Modal title={{ invite: "Bring someone into your circle", people: "Your people", settings: "Make yourself at home", privacy: "A little clarity on privacy", verify: "Verify this conversation", devices: "Your chats, on every screen" }[panel]} close={() => { setPanel(null); setError(""); setInviteLink(""); }}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {panel === "invite" && <><div className="modal-intro"><span className="welcome-icon"><UserPlus /></span><p>Good company starts with an invitation. Only the person signed in with the email below can accept it.</p></div><form onSubmit={invite} className="setup-form"><label htmlFor="invite-email">Their sign-in email</label><input id="invite-email" type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteLink(""); }} placeholder="friend@example.com" required autoComplete="email" /><button className="primary full" disabled={busy}>{busy ? "Creating…" : "Create private invitation"}<UserPlus size={17} /></button></form>{inviteLink && <div className="invite-result"><strong>Your invitation is ready</strong><p>First allow this email through this private app’s Share controls. Then send them the link below. It expires in 48 hours and can be used once.</p><div className="copy-field"><input readOnly value={inviteLink} aria-label="Invitation link" onFocus={e => e.currentTarget.select()} /><button className="icon-button" aria-label="Copy invitation link" onClick={() => void copy(inviteLink)}><Copy size={17} /></button></div></div>}<div className="section-heading"><h3>Recent invitations</h3><span>{invitations.length}</span></div>{!invitations.length && <p className="muted small-text">Your first invitation starts here.</p>}{invitations.map(i => <div className="invitation-row" key={i.id}><span><strong>{i.email}</strong><small>{i.claimed ? "Accepted" : i.revoked ? "Revoked" : i.expiresAt < Date.now() ? "Expired" : "Waiting to be accepted"}</small></span>{!i.claimed && !i.revoked && i.expiresAt > Date.now() && <button className="subtle-button" disabled={busy} onClick={() => void revoke(i.id, true)}>Revoke</button>}</div>)}</>}
      {panel === "people" && <><p className="muted">Everyone here has been approved to join this private space.</p><div className="people-list">{members.filter(m => m.id !== me!.id).map(p => <div className="person-row" key={p.id}><Avatar name={p.name} /><span><strong>{p.name}</strong><small>@{p.handle}{p.status === "revoked" ? " · access removed" : ""}</small></span>{p.status === "active" && <button className="square-button" disabled={busy} onClick={() => void startChat(p)} aria-label={`Message ${p.name}`}><MessageCircle size={18} /></button>}{me!.role === "owner" && p.status === "active" && <button className="subtle-button danger" disabled={busy} onClick={() => void revoke(p.id)}>Remove</button>}</div>)}{members.filter(m => m.id !== me!.id).length === 0 && <div className="small-empty"><Users size={30} /><h3>Just you, for now.</h3><p>{me!.role === "owner" ? "Invite someone you trust to start your first conversation." : "The owner will bring more people into your circle."}</p></div>}</div>{me!.role === "owner" && <button className="primary full" onClick={() => setPanel("invite")}><UserPlus size={17} />Invite someone</button>}</>}
      {panel === "settings" && <><div className="profile-card"><Avatar name={me!.name} /><span><strong>{me!.name}</strong><small>@{me!.handle} · {me!.role === "owner" ? "Space owner" : "Member"}</small></span></div><div className="settings-list"><button onClick={() => setPanel("privacy")}><span className="setting-icon"><ShieldCheck size={19} /></span><span><strong>Privacy and security</strong><small>How your messages and keys are protected</small></span><ChevronRight size={17} /></button><button onClick={exportBackup}><span className="setting-icon"><Download size={19} /></span><span><strong>Save encrypted recovery key</strong><small>Restore your identity on a new browser</small></span><ChevronRight size={17} /></button><button onClick={lock}><span className="setting-icon"><LockKeyhole size={19} /></span><span><strong>Lock ShadowChat</strong><small>Also locks after 10 minutes of inactivity</small></span><ChevronRight size={17} /></button><button disabled={notificationPermission === "unsupported" || notificationPermission === "granted"} onClick={() => { void Notification.requestPermission().then(p => { setNotificationPermission(p); if (p === "granted") notify("Private alerts enabled while ShadowChat is open."); }); }}><span className="setting-icon"><Bell size={19} /></span><span><strong>Private message alerts</strong><small>{notificationPermission === "unsupported" ? "Not supported by this browser" : notificationPermission === "granted" ? "Enabled while this app is open" : notificationPermission === "denied" ? "Allow notifications in browser settings" : "No message text in notifications"}</small></span><ChevronRight size={17} /></button><a href={ANDROID_APK} download><span className="setting-icon"><Download size={19} /></span><span><strong>Download Android APK</strong><small>ShadowChat 0.2.0 · same live conversations</small></span><ChevronRight size={17} /></a><button onClick={() => setPanel("devices")}><span className="setting-icon"><Smartphone size={19} /></span><span><strong>Use the same chats on another device</strong><small>One account and one encrypted recovery key</small></span><ChevronRight size={17} /></button><a href="/signout-with-chatgpt?return_to=%2F" target="_top" onClick={lock}><span className="setting-icon"><LogOut size={19} /></span><span><strong>Sign out</strong><small>Keep your encrypted key on this browser</small></span><ChevronRight size={17} /></a></div><p className="settings-footnote">ShadowChat {boot.release} · by SHADOWNET<br />The Android APK opens this live app in your Android browser. Messages sync while each screen is open and online.</p></>}
      {panel === "devices" && <><div className="privacy-hero"><Smartphone size={33} /><h3>One account.<br />The same conversations.</h3></div><ol className="device-sync-steps"><li><strong>Use the same sign-in</strong><p>Sign in with the same ChatGPT account on your phone and on the web.</p></li><li><strong>Save your encrypted recovery key</strong><p>On the device where your chats already work, open Settings and download the encrypted key.</p></li><li><strong>Restore it once on the other device</strong><p>Transfer the encrypted file privately. On the new device, enter the original passphrase and select Restore encrypted key.</p></li><li><strong>Continue the conversation anywhere</strong><p>Both screens use one account and one message service. New messages appear on the other screen while it is open and online, normally within a few seconds.</p></li></ol><button className="primary full" onClick={exportBackup}><Download size={17} />Save my encrypted recovery key</button><a className="secondary full" href={ANDROID_APK} download><Smartphone size={17} />Download Android APK</a><p className="small-text muted">The APK uses your Android browser’s existing profile. Keep the same browser to reuse its sign-in and key. Messages are not copied into a separate Android database. Background push is not included.</p></>}
      {panel === "privacy" && <><div className="privacy-hero"><ShieldCheck size={33} /><h3>Private conversations,<br />clear expectations.</h3></div><div className="privacy-list"><section><LockKeyhole size={20} /><div><h3>Message content stays encrypted</h3><p>Your browser encrypts text before upload using the established NaCl encryption library. The server stores encrypted content and does not receive your private key.</p></div></section><section><KeyRound size={20} /><div><h3>Your identity lives with you</h3><p>Your device key is protected by your passphrase. Save the encrypted backup. Losing both your device key and backup means losing access to your message history.</p></div></section><section><Users size={20} /><div><h3>A small, approved circle</h3><p>Only approved members can exchange messages. The service still sees usernames, who talks to whom, and message times. Removing a member cannot erase copies they already received.</p></div></section><section><ShieldCheck size={20} /><div><h3>Verify people you trust</h3><p>Compare safety numbers in person or through another trusted channel. A first connection has not been independently verified until you do.</p></div></section></div><div className="privacy-limit"><strong>A first release, not an audited secure messenger.</strong><p>This version does not provide forward secrecy or protect a compromised device or altered app code. It has not had an independent security audit. Keep highly sensitive conversations in an established, audited messenger.</p></div></>}
      {panel === "verify" && active && <><div className="modal-intro"><span className="welcome-icon"><ShieldCheck /></span><p>Compare these numbers with {active.peer.name} in person or using another trusted channel. You should both see the same numbers.</p></div><div className="safety-number">{number || "Calculating…"}</div>{pins[active.peer.id] !== active.peer.publicKey && <p className="form-error">This contact’s key changed. Messaging is paused.</p>}<button className="secondary full" onClick={() => void copy(number)} disabled={!number}><Copy size={16} />Copy safety number</button><button className="primary full" disabled={!number || pins[active.peer.id] !== active.peer.publicKey} onClick={() => { void devicePut(`verified:${me!.id}:${active.peer.id}`, number).then(() => { setVerified(v => ({ ...v, [active.peer.id]: number })); notify("Safety number marked as compared on this device."); }); }}><Check size={17} />{verified[active.peer.id] === number ? "Compared on this device" : "I compared these numbers"}</button><p className="small-text muted">Only mark this after comparing. The server cannot perform this verification for you.</p></>}
    </Modal>}{toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </main>;
}
