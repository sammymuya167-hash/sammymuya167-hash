"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  BookOpen,
  Settings2,
  Globe,
  Upload,
  FileText,
  Trash2,
  ArrowUpRight,
  Check,
  Copy,
  Lock,
  Plus,
} from "lucide-react";
import { Modal, Avatar } from "./ui";
import { api } from "../../lib/api-client";
import type { Bot, KnowledgeDocument } from "../../lib/contracts";
export function BotEditor({
  bot,
  initialTab = "settings",
  onClose,
  onSaved,
  onPreview,
  notify,
}: {
  bot: Bot | null;
  initialTab?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onPreview: (b: Bot) => void;
  notify: (m: string) => void;
}) {
  const [current, setCurrent] = useState<Bot | null>(bot);
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [remove, setRemove] = useState(false);
  const [form, setForm] = useState({
    name: bot?.name || "",
    description: bot?.description || "",
    system_prompt:
      bot?.system_prompt ||
      "You are a thoughtful, helpful assistant. Give clear, practical answers. Use the knowledge provided and be honest when you are unsure.",
    greeting: bot?.greeting || "Hi there! How can I help you today?",
    color: bot?.color || "purple",
    is_public: !!bot?.is_public,
  });
  async function loadDocs() {
    if (!current) return;
    setDocsLoading(true);
    try {
      const result = await api<{ documents: KnowledgeDocument[] }>(
        `/api/bots/${current.id}/documents`,
      );
      setDocs(result.documents);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDocsLoading(false);
    }
  }
  useEffect(() => {
    if (current && tab === "knowledge") void loadDocs();
  }, [current?.id, tab]);
  function field(key: string, value: string | boolean) {
    setForm((v) => ({ ...v, [key]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ bot: Bot }>(
        current ? `/api/bots/${current.id}` : "/api/bots",
        current ? "PATCH" : "POST",
        form,
      );
      setCurrent(result.bot);
      await onSaved();
      notify(
        current
          ? "Assistant updated."
          : "Your assistant is ready. Add some knowledge next.",
      );
      if (!current) setTab("knowledge");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !current) return;
    setError("");
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setError("Choose a text (.txt) or Markdown (.md) file.");
      return;
    }
    if (file.size > 50000) {
      setError("Keep each file under 50 KB.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      await api(`/api/bots/${current.id}/documents`, "POST", {
        name: file.name,
        content,
      });
      await loadDocs();
      await onSaved();
      notify("Knowledge added and ready to use.");
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "The file must contain valid UTF-8 text."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteDoc(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/bots/${current?.id}/documents/${id}`, "DELETE");
      await loadDocs();
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteBot() {
    setBusy(true);
    try {
      await api(`/api/bots/${current?.id}`, "DELETE");
      await onSaved();
      notify("Assistant and its conversations deleted.");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const share = current
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/chat/${current.id}`
    : "";
  return (
    <Modal
      wide
      title={current ? "Assistant studio" : "Create an assistant"}
      onClose={busy ? () => {} : onClose}
    >
      <div className="editor-title">
        <Avatar color={form.color} />
        <div>
          <h2>{form.name || "Something great starts here."}</h2>
          <p className="muted">
            A purpose, a personality, and a little of your knowledge.
          </p>
        </div>
        {current && (
          <button
            className="secondary compact"
            disabled={busy}
            onClick={() => onPreview(current)}
          >
            Preview
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <div className="tabs">
        {[
          { id: "settings", name: "Configuration", icon: Settings2 },
          { id: "knowledge", name: "Knowledge", icon: BookOpen },
          { id: "share", name: "Share", icon: Globe },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            disabled={!current && t.id !== "settings"}
            onClick={() => {
              setTab(t.id);
              setError("");
            }}
          >
            <t.icon size={15} />
            {t.name}
            {t.id === "knowledge" && docs.length > 0 && (
              <small>{docs.length}</small>
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "settings" && (
        <form className="form editor-form" onSubmit={save}>
          <div className="form-row">
            <label>
              Assistant name
              <input
                required
                maxLength={70}
                placeholder="e.g. Customer Care"
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                disabled={busy}
              />
            </label>
            <div className="color-field">
              <span>Accent color</span>
              <div className="color-choices">
                {["purple", "green", "blue", "orange"].map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`color-dot ${c} ${form.color === c ? "selected" : ""}`}
                    aria-label={`${c} accent`}
                    aria-pressed={form.color === c}
                    onClick={() => field("color", c)}
                  >
                    {form.color === c && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label>
            Short description
            <input
              maxLength={240}
              placeholder="What will your assistant help people do?"
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            System instructions
            <span className="field-hint">
              Give your assistant a role, a tone, and clear boundaries.
            </span>
            <textarea
              className="prompt-input"
              rows={6}
              required
              maxLength={6000}
              value={form.system_prompt}
              onChange={(e) => field("system_prompt", e.target.value)}
              disabled={busy}
            />
            <span className="char-count">
              {form.system_prompt.length.toLocaleString()} / 6,000
            </span>
          </label>
          <label>
            Welcome message
            <textarea
              rows={2}
              required
              maxLength={500}
              value={form.greeting}
              onChange={(e) => field("greeting", e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="switch-label">
            <span className="switch-copy">
              <Globe size={17} />
              <span>
                Make this assistant public
                <small>Anyone with the link can chat after signing in.</small>
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => field("is_public", e.target.checked)}
              disabled={busy}
            />
          </label>
          {form.is_public && (
            <p className="small-warning">
              Public answers may reveal uploaded knowledge. Only add content you
              intend to share.
            </p>
          )}
          <div className="form-footer">
            {current ? (
              <button
                type="button"
                className="danger-link"
                onClick={() => setRemove(true)}
                disabled={busy}
              >
                <Trash2 size={14} />
                Delete assistant
              </button>
            ) : (
              <span className="muted small">
                <Lock size={13} /> Private by default
              </span>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : current ? "Save changes" : "Create assistant"}
              <Plus size={16} />
            </button>
          </div>
          {remove && (
            <div className="confirm-box">
              <strong>Delete {current?.name}?</strong>
              <p>
                Its documents and all associated chats will be permanently
                removed.
              </p>
              <button
                type="button"
                className="secondary compact"
                onClick={() => setRemove(false)}
              >
                Keep assistant
              </button>
              <button
                type="button"
                className="danger compact"
                onClick={deleteBot}
                disabled={busy}
              >
                Delete permanently
              </button>
            </div>
          )}
        </form>
      )}
      {tab === "knowledge" && (
        <div className="knowledge-content">
          <div className="section-title">
            <div>
              <h3>Good answers start with good knowledge.</h3>
              <p className="muted">
                Add the documents your assistant should know.
              </p>
            </div>
            <span className="badge">{docs.length} / 20 files</span>
          </div>
          <label className={`upload-zone ${busy ? "disabled" : ""}`}>
            <input
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span className="upload-icon">
              <Upload size={22} />
            </span>
            <strong>
              {busy
                ? "Working on your knowledge…"
                : "Choose a document to upload"}
            </strong>
            <span>Text or Markdown · up to 50 KB per file</span>
            <span className="secondary compact">
              Browse files
              <Plus size={14} />
            </span>
          </label>
          <div className="doc-list">
            {docsLoading && <p className="muted">Loading documents…</p>}
            {!docsLoading && !docs.length && (
              <div className="empty-inline">
                <BookOpen size={20} />
                <p>No documents yet. A small FAQ is a great place to start.</p>
              </div>
            )}
            {docs.map((d) => (
              <div className="doc-row" key={d.id}>
                <span className="file-icon">
                  <FileText size={19} />
                </span>
                <div>
                  <strong>{d.name}</strong>
                  <small>
                    {(d.bytes / 1000).toFixed(1)} KB <span>·</span>{" "}
                    {d.chunk_count} searchable{" "}
                    {d.chunk_count === 1 ? "chunk" : "chunks"}
                  </small>
                </div>
                <span className="ready-dot">Ready</span>
                <button
                  className="icon-button"
                  aria-label={`Delete ${d.name}`}
                  onClick={() => deleteDoc(d.id)}
                  disabled={busy}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="info-note">
            <BookOpen size={17} />
            <p>
              Documents are split into overlapping chunks. Relevant excerpts are
              included with each question and shown as sources. This version
              uses keyword search; it may miss synonyms or differently phrased
              answers.
            </p>
          </div>
        </div>
      )}
      {tab === "share" && (
        <div className="share-content">
          <span
            className={`share-symbol ${current?.is_public ? "public" : ""}`}
          >
            {current?.is_public ? <Globe size={29} /> : <Lock size={29} />}
          </span>
          <h3>
            {current?.is_public
              ? "Ready for a conversation."
              : "A space just for you."}
          </h3>
          <p className="muted">
            {current?.is_public
              ? "Share this link so people can meet your assistant. Their conversations stay private to their own accounts."
              : "Your assistant is private. Enable public access in Configuration and save to let others chat with it."}
          </p>
          <label className="form-label">Assistant link</label>
          <div className="copy-field">
            <input readOnly value={share} aria-label="Assistant link" />
            <button
              className="icon-button"
              aria-label="Copy assistant link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(share);
                  notify("Assistant link copied.");
                } catch {
                  setError("Select and copy the link above.");
                }
              }}
            >
              <Copy size={17} />
            </button>
          </div>
          <button
            className="primary"
            onClick={() => current && onPreview(current)}
          >
            Open chat
            <ArrowUpRight size={16} />
          </button>
          <p className="small muted">
            {current?.is_public
              ? "Public knowledge is visible through answers and retrieved excerpts."
              : "Only your signed-in account can open this chat."}
          </p>
        </div>
      )}
    </Modal>
  );
}
