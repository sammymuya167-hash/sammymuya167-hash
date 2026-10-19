"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  LayoutGrid,
  Bot as BotIcon,
  MessageSquare,
  BookOpen,
  Settings2,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Search,
  Sparkles,
  ChevronRight,
  Globe,
  Lock,
  LogOut,
  Menu,
  X,
  Square,
  Copy,
  Check,
  Trash2,
  CornerDownLeft,
  FileText,
  ExternalLink,
  ShieldCheck,
  Info,
  RefreshCw,
} from "lucide-react";
import { Avatar, Brand, Text, Modal } from "../components/shadowbot/ui";
import { Auth } from "../components/shadowbot/auth";
import { BotEditor } from "../components/shadowbot/bot-editor";
import { api } from "../lib/api-client";
import { readSSE } from "../lib/sse";
import type {
  User,
  Bot,
  Conversation,
  Message,
  Source,
  ProviderInfo,
} from "../lib/contracts";
type Boot = {
  user: User | null;
  publicBots: Bot[];
  bots: Bot[];
  conversations: Conversation[];
  provider: ProviderInfo;
};
type Page = "overview" | "bots" | "history" | "knowledge" | "settings" | "chat";
const nav = [
  { id: "overview", name: "Overview", icon: LayoutGrid },
  { id: "bots", name: "My assistants", icon: BotIcon },
  { id: "history", name: "Conversations", icon: MessageSquare },
  { id: "knowledge", name: "Knowledge", icon: BookOpen },
] as const;
export default function ShadowBot({ initialBotId }: { initialBotId?: string }) {
  const [data, setData] = useState<Boot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<Page>(initialBotId ? "chat" : "overview");
  const [auth, setAuth] = useState(false);
  const [editor, setEditor] = useState<{
    bot: Bot | null;
    tab?: string;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [mobile, setMobile] = useState(false);
  const [bot, setBot] = useState<Bot | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoaded = useRef(false);
  const navigateSeq = useRef(0);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  }, []);
  const refresh = useCallback(async () => {
    const result = await api<Boot>("/api/bootstrap");
    setData(result);
    setLoadError("");
  }, []);
  useEffect(() => {
    void refresh().catch((e) => setLoadError(e.message));
    return () => {
      abortRef.current?.abort();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (!data || !initialBotId || initialLoaded.current) return;
    initialLoaded.current = true;
    void openBot(initialBotId);
  }, [data, initialBotId]);
  useEffect(() => {
    if (page === "chat")
      bottomRef.current?.scrollIntoView({
        behavior: streaming ? "instant" : "smooth",
        block: "end",
      });
  }, [messages, page, streaming]);
  function go(next: Page) {
    if (streaming) {
      notify("Stop the current response before leaving this chat.");
      return;
    }
    navigateSeq.current++;
    setPage(next);
    setSearch("");
    setMobile(false);
    window.history.replaceState({}, "", "/");
  }
  function create() {
    if (!data?.user) {
      setAuth(true);
      return;
    }
    setEditor({ bot: null });
  }
  async function openBot(id: string) {
    if (streaming) return;
    const seq = ++navigateSeq.current;
    setPage("chat");
    setMobile(false);
    setChatLoading(true);
    setChatError("");
    setConversationId(null);
    setMessages([]);
    try {
      const result = await api<{ bot: Bot }>(`/api/bots/${id}`);
      if (seq !== navigateSeq.current) return;
      setBot(result.bot);
      window.history.replaceState({}, "", `/chat/${id}`);
    } catch (e) {
      if (seq === navigateSeq.current) {
        setBot(null);
        setChatError((e as Error).message);
      }
    } finally {
      if (seq === navigateSeq.current) setChatLoading(false);
    }
  }
  async function openConversation(id: string) {
    if (streaming) {
      notify("Stop the current response first.");
      return;
    }
    const seq = ++navigateSeq.current;
    setPage("chat");
    setMobile(false);
    setChatLoading(true);
    setChatError("");
    try {
      const result = await api<{
        bot: Bot;
        messages: Message[];
        conversation: { id: string };
      }>(`/api/conversations/${id}`);
      if (seq !== navigateSeq.current) return;
      setBot(result.bot);
      setConversationId(result.conversation.id);
      setMessages(result.messages);
      window.history.replaceState({}, "", `/chat/${result.bot.id}`);
    } catch (e) {
      if (seq === navigateSeq.current) {
        setBot(null);
        setMessages([]);
        setChatError((e as Error).message);
      }
    } finally {
      if (seq === navigateSeq.current) setChatLoading(false);
    }
  }
  async function send(e?: FormEvent, text?: string) {
    e?.preventDefault();
    const content = (text ?? input).trim();
    if (!content || !bot || streaming) return;
    if (!data?.user) {
      setInput(content);
      setAuth(true);
      return;
    }
    if (!data.provider.ready) {
      setChatError("AI is not configured yet. Check Workspace settings.");
      return;
    }
    setInput("");
    setChatError("");
    setStreaming(true);
    const requestId = crypto.randomUUID();
    const placeholderId = "pending-" + requestId;
    const optimistic: Message = {
      id: requestId,
      role: "user",
      content,
      sources: [],
      status: "complete",
    };
    setMessages((m) => [
      ...m,
      optimistic,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        sources: [],
        status: "streaming",
      },
    ]);
    let assistantId = placeholderId;
    let meta = false;
    let finalized = false;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: bot.id,
          conversationId,
          content,
          requestId,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = (await response.json()) as { error: string };
        throw new Error(error.error);
      }
      if (!response.body)
        throw new Error("The streaming connection is unavailable.");
      for await (const frame of readSSE(response.body)) {
        const value = JSON.parse(frame.data) as {
          conversationId?: string;
          assistantId?: string;
          sources?: Source[];
          text?: string;
          message?: string;
          status?: Message["status"];
        };
        if (frame.event === "meta") {
          meta = true;
          assistantId = value.assistantId!;
          setConversationId(value.conversationId!);
          setMessages((m) =>
            m.map((v) =>
              v.id === placeholderId
                ? { ...v, id: assistantId, sources: value.sources || [] }
                : v,
            ),
          );
        }
        if (frame.event === "delta")
          setMessages((m) =>
            m.map((v) =>
              v.id === assistantId
                ? { ...v, content: v.content + (value.text || "") }
                : v,
            ),
          );
        if (frame.event === "error")
          setChatError(value.message || "Something interrupted the response.");
        if (frame.event === "done") {
          finalized = true;
          setMessages((m) =>
            m.map((v) =>
              v.id === assistantId
                ? { ...v, status: value.status || "complete" }
                : v,
            ),
          );
        }
      }
      if (!finalized)
        throw new Error("The connection ended before the response was saved.");
    } catch (e) {
      const stopped = controller.signal.aborted;
      if (!stopped) setChatError((e as Error).message);
      setMessages((m) =>
        meta
          ? m.map((v) =>
              v.id === assistantId
                ? { ...v, status: stopped ? "stopped" : "failed" }
                : v,
            )
          : m.filter((v) => v.id !== placeholderId && v.id !== requestId),
      );
      if (!meta) setInput(content);
    } finally {
      abortRef.current = null;
      setStreaming(false);
      await refresh().catch(() => {});
    }
  }
  async function removeConversation() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api(`/api/conversations/${deleteId}`, "DELETE");
      if (conversationId === deleteId) {
        setConversationId(null);
        setMessages([]);
      }
      setDeleteId(null);
      await refresh();
      notify("Conversation deleted.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  async function logout() {
    if (streaming) return;
    try {
      await api("/api/auth/logout", "POST");
      setMessages([]);
      setBot(null);
      setConversationId(null);
      go("overview");
      await refresh();
      notify("Signed out.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const allBots = [
    ...(data?.bots || []),
    ...(data?.publicBots || []).filter(
      (b) => !data?.bots.some((v) => v.id === b.id),
    ),
  ];
  const displayBots = (page === "bots" ? data?.bots || [] : allBots).filter(
    (b) =>
      (b.name + " " + b.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const docsCount = (data?.bots || []).reduce(
    (n, b) => n + (b.document_count || 0),
    0,
  );
  const titles: Record<Page, string> = {
    overview: "Overview",
    bots: "My assistants",
    history: "Conversations",
    knowledge: "Knowledge",
    settings: "Workspace settings",
    chat: bot?.name || "Conversation",
  };
  const owner = !!data?.bots.find((b) => b.id === bot?.id);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <button className="workspace-picker" onClick={() => go("overview")}>
          <span className="workspace-icon">
            S<span />
          </span>
          <span>
            SHADOWNET workspace
            <small>
              {data?.user ? "Your creative space" : "Your ideas, connected"}
            </small>
          </span>
          <ChevronRight size={14} />
        </button>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              {n.name}
              {n.id === "bots" && <small>{data?.bots.length || 0}</small>}
              {page === n.id && <i />}
            </button>
          ))}
        </nav>
        <div className="recent-heading">
          <span>RECENT CONVERSATIONS</span>
          <button
            aria-label="New conversation"
            onClick={() => openBot(bot?.id || "shadow-guide")}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="recent-list">
          {data?.conversations.slice(0, 5).map((c) => (
            <button
              key={c.id}
              className={
                conversationId === c.id && page === "chat" ? "selected" : ""
              }
              onClick={() => openConversation(c.id)}
            >
              <MessageSquare size={14} />
              <span>{c.title}</span>
            </button>
          ))}
          {!data?.conversations.length && (
            <p>
              Your next great conversation
              <br />
              will find a home here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span>
              <Sparkles size={16} /> A little knowledge. Big possibilities.
            </span>
            <p>
              Give your assistant context.
              <br />
              Let the conversation do the rest.
            </p>
            <button onClick={() => go("knowledge")}>
              Explore knowledge
              <ArrowUpRight size={13} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => go("settings")}
          >
            <Settings2 size={17} />
            Workspace settings
          </button>
          <div className="account-row">
            {data?.user ? (
              <>
                <span className="user-avatar">
                  {data.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{data.user.name}</strong>
                  <small>Personal workspace</small>
                </span>
                <button
                  className="icon-button"
                  aria-label="Sign out"
                  onClick={logout}
                  disabled={streaming}
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="user-avatar guest">S</span>
                <button className="sign-in-link" onClick={() => setAuth(true)}>
                  Make this space yours
                  <small>
                    Create an account
                    <ArrowRight size={11} />
                  </small>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb-workspace">Workspace</span>
            <ChevronRight size={13} />
            <strong>{titles[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="connection-pill">
              <i
                className={`status-dot ${data?.provider.ready ? "" : "off"}`}
              />
              {!data
                ? "Connecting…"
                : data.provider.ready
                  ? "AI connected"
                  : "AI not configured"}
            </span>
            <span className="top-divider" />
            <span className="edition">
              SHADOWNET <span>/</span> 086
            </span>
            {!data?.user && (
              <button
                className="secondary compact sign-in-top"
                onClick={() => setAuth(true)}
              >
                Sign in
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>
        </header>
        <main
          id="main-content"
          className={page === "chat" ? "chat-main" : "content"}
        >
          {loadError ? (
            <div className="state-panel">
              <Info size={30} />
              <h2>Let’s try that connection again.</h2>
              <p>{loadError}</p>
              <button
                className="primary"
                onClick={() => refresh().catch((e) => setLoadError(e.message))}
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </div>
          ) : !data ? (
            <div className="state-panel">
              <span className="loader" />
              <p>Opening your workspace…</p>
            </div>
          ) : (
            <>
              {(page === "overview" || page === "bots") && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        A LITTLE INTELLIGENCE. A LOT OF POSSIBILITY.
                      </div>
                      <h1>
                        {page === "overview" ? (
                          <>
                            Good ideas.
                            <br className="mobile-break" /> Great assistants
                            <span>.</span>
                          </>
                        ) : (
                          "Your assistants, your way."
                        )}
                      </h1>
                      <p>
                        {page === "overview"
                          ? `Welcome${data.user ? ", " + data.user.name.split(" ")[0] : ""}. Turn what you know into conversations that help.`
                          : "Give each idea a purpose, a voice, and the knowledge to back it up."}
                      </p>
                    </div>
                    <button className="primary" onClick={create}>
                      <Plus size={17} />
                      Create assistant
                    </button>
                  </div>
                  {page === "overview" && (
                    <>
                      <section className="hero">
                        <div className="hero-copy">
                          <span className="hero-kicker">
                            <span />
                            BUILT AROUND YOUR KNOWLEDGE
                          </span>
                          <h2>
                            More than an answer.
                            <br />A little of <em>your expertise.</em>
                          </h2>
                          <p>
                            Create an assistant that knows your world.
                            <br />
                            Add your documents, set the tone, and let it talk.
                          </p>
                          <button onClick={create}>
                            Build your first assistant
                            <ArrowRight size={16} />
                          </button>
                          <span className="hero-detail">
                            <Check size={12} />
                            Your prompts <span>·</span> Your knowledge{" "}
                            <span>·</span> Your style
                          </span>
                        </div>
                        <div className="hero-art" aria-hidden="true">
                          <div className="art-orbit o1" />
                          <div className="art-orbit o2" />
                          <div className="art-orbit o3" />
                          <span className="art-star s1">✦</span>
                          <span className="art-star s2">✧</span>
                          <span className="art-dot d1" />
                          <span className="art-dot d2" />
                          <span className="art-dot d3" />
                          <div className="art-tile">
                            <BotIcon size={53} strokeWidth={1.25} />
                            <i />
                            <span />
                          </div>
                          <div className="art-label label-one">
                            <span>
                              <BookOpen size={16} />
                            </span>
                            <div>
                              Your knowledge,
                              <small>beautifully connected.</small>
                            </div>
                            <Check size={13} />
                          </div>
                          <div className="art-label label-two">
                            <Sparkles size={16} />
                            <span>Thoughtful answers. Instantly.</span>
                          </div>
                          <div className="art-line" />
                        </div>
                      </section>
                      <section
                        className="stats"
                        aria-label="Workspace statistics"
                      >
                        {[
                          {
                            name: "Your assistants",
                            value: data.bots.length,
                            label: "Ready for your next idea",
                            icon: BotIcon,
                            color: "purple",
                          },
                          {
                            name: "Saved conversations",
                            value: data.conversations.length,
                            label: "Pick up where you left off",
                            icon: MessageSquare,
                            color: "green",
                          },
                          {
                            name: "Knowledge documents",
                            value: docsCount,
                            label: "A growing library of you",
                            icon: BookOpen,
                            color: "orange",
                          },
                        ].map((s) => (
                          <div className="stat-card" key={s.name}>
                            <div>
                              <span>{s.name}</span>
                              <strong>
                                {String(s.value).padStart(2, "0")}
                              </strong>
                              <small>{s.label}</small>
                            </div>
                            <span className={`stat-icon ${s.color}`}>
                              <s.icon size={21} strokeWidth={1.5} />
                            </span>
                          </div>
                        ))}
                      </section>
                    </>
                  )}
                  <section className="assistants-section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {page === "overview"
                            ? "Meet your assistants"
                            : "Your assistant collection"}
                          <span>
                            {page === "overview"
                              ? allBots.length
                              : data.bots.length}
                          </span>
                        </h2>
                        <p>
                          {page === "overview"
                            ? "Small specialists. Ready for big conversations."
                            : "Built with your knowledge. Shaped by you."}
                        </p>
                      </div>
                      <label className="search-box">
                        <Search size={15} />
                        <input
                          aria-label="Search assistants"
                          placeholder="Find an assistant…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <span>⌕</span>
                      </label>
                    </div>
                    <div className="assistant-grid">
                      {displayBots.map((b) => (
                        <AssistantCard
                          item={b}
                          key={b.id}
                          own={data.bots.some((v) => v.id === b.id)}
                          ready={data.provider.ready}
                          onEdit={(b) => setEditor({ bot: b })}
                          onOpen={openBot}
                        />
                      ))}
                      {!search && (
                        <button className="create-card" onClick={create}>
                          <span>
                            <Plus size={23} />
                          </span>
                          <strong>Your next great assistant</strong>
                          <p>A fresh idea deserves its own voice.</p>
                          <span className="create-card-link">
                            Create something new
                            <ArrowUpRight size={14} />
                          </span>
                        </button>
                      )}
                    </div>
                    {!displayBots.length && search && (
                      <div className="empty-inline">
                        <Search size={23} />
                        <p>
                          No assistants match “{search}”. Try a different name.
                        </p>
                      </div>
                    )}
                  </section>
                  {page === "overview" && (
                    <div className="bottom-note">
                      <span className="note-spark">
                        <Sparkles size={18} />
                      </span>
                      <div>
                        <strong>Start small. Make it useful.</strong>
                        <p>
                          A short FAQ, a clear instruction, a good conversation.
                          That’s all you need.
                        </p>
                      </div>
                      <button onClick={() => openBot("shadow-guide")}>
                        Ask Shadow Guide
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {page === "history" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        EVERY GOOD CONVERSATION HAS A NEXT CHAPTER
                      </span>
                      <h1>
                        Pick up where you left off<span>.</span>
                      </h1>
                      <p>
                        Your history, saved to your account. Only you can read
                        it.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => openBot("shadow-guide")}
                    >
                      <Plus size={16} />
                      New conversation
                    </button>
                  </div>
                  {!data.user ? (
                    <SignInState onSignIn={() => setAuth(true)} />
                  ) : !data.conversations.length ? (
                    <div className="state-panel soft">
                      <MessageSquare size={35} />
                      <h2>Your story starts with a hello.</h2>
                      <p>
                        Chat with an assistant and find the conversation here.
                      </p>
                      <button
                        className="primary"
                        onClick={() => openBot("shadow-guide")}
                      >
                        Meet Shadow Guide
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="history-table">
                      <div className="table-heading">
                        <span>CONVERSATION</span>
                        <span>LAST ACTIVE</span>
                        <span />
                      </div>
                      {data.conversations.map((c) => (
                        <div className="history-row" key={c.id}>
                          <button
                            className="history-open"
                            onClick={() => openConversation(c.id)}
                          >
                            <Avatar color={c.color} />
                            <span>
                              <strong>{c.title}</strong>
                              <small>{c.bot_name}</small>
                            </span>
                          </button>
                          <time>
                            {new Date(c.updated_at).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </time>
                          <button
                            className="icon-button"
                            aria-label={`Delete conversation ${c.title}`}
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {page === "knowledge" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        YOUR EXPERTISE, WITH A PLACE TO LIVE
                      </span>
                      <h1>
                        A little context goes a long way<span>.</span>
                      </h1>
                      <p>
                        Give your assistants the knowledge that makes their
                        answers yours.
                      </p>
                    </div>
                    <span className="large-label">
                      <BookOpen size={16} />
                      {docsCount} documents
                    </span>
                  </div>
                  <div className="knowledge-explainer">
                    <span className="feature-icon">
                      <BookOpen size={27} />
                    </span>
                    <div>
                      <h2>Bring the knowledge. We’ll connect the dots.</h2>
                      <p>
                        Upload a text or Markdown document to an assistant.
                        Relevant excerpts are retrieved for each question, with
                        sources you can inspect.
                      </p>
                      <div className="feature-tags">
                        <span>
                          <FileText size={12} />
                          Text & Markdown
                        </span>
                        <span>
                          <Search size={12} />
                          Keyword retrieval
                        </span>
                        <span>
                          <ShieldCheck size={12} />
                          Separate per assistant
                        </span>
                      </div>
                    </div>
                  </div>
                  {!data.user ? (
                    <SignInState onSignIn={() => setAuth(true)} />
                  ) : (
                    <section>
                      <div className="section-heading">
                        <div>
                          <h2>Assistant libraries</h2>
                          <p>
                            Each assistant has its own little world of
                            knowledge.
                          </p>
                        </div>
                        <button className="secondary compact" onClick={create}>
                          <Plus size={15} />
                          Create assistant
                        </button>
                      </div>
                      <div className="library-list">
                        {data.bots.map((b) => (
                          <button
                            key={b.id}
                            className="library-row"
                            onClick={() =>
                              setEditor({ bot: b, tab: "knowledge" })
                            }
                          >
                            <Avatar color={b.color} />
                            <span>
                              <strong>{b.name}</strong>
                              <small>
                                {b.document_count || 0} documents <span>·</span>{" "}
                                Text & Markdown
                              </small>
                            </span>
                            <span className="secondary compact">
                              Manage knowledge
                              <ArrowUpRight size={14} />
                            </span>
                          </button>
                        ))}
                        {!data.bots.length && (
                          <button className="empty-library" onClick={create}>
                            <Plus size={22} />
                            <strong>A new assistant. A fresh library.</strong>
                            <span>
                              Create your first assistant to add knowledge.
                            </span>
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                  <div className="info-note">
                    <Info size={18} />
                    <p>
                      V1 supports 20 documents per assistant, 50 KB per
                      document, and 600 chunks total. Keyword search can miss
                      synonyms. Documents published with a public assistant may
                      be revealed in answers.
                    </p>
                  </div>
                </>
              )}
              {page === "settings" && (
                <>
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">
                        A CLEAR VIEW BEHIND THE CONVERSATION
                      </span>
                      <h1>
                        Thoughtfully configured<span>.</span>
                      </h1>
                      <p>
                        Provider status, privacy, and the things this first
                        release can do.
                      </p>
                    </div>
                    <span className="badge violet">SHADOWBOT 1.0</span>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <span className="feature-icon">
                        <Sparkles size={22} />
                      </span>
                      <h2>Your AI connection</h2>
                      <p className="muted">
                        Configured securely on the server. API keys are never
                        sent to your browser.
                      </p>
                      <dl>
                        <div>
                          <dt>Status</dt>
                          <dd>
                            <i
                              className={`status-dot ${data.provider.ready ? "" : "off"}`}
                            />
                            {data.provider.ready
                              ? "Configured"
                              : "Not configured"}
                          </dd>
                        </div>
                        <div>
                          <dt>Provider</dt>
                          <dd>{data.provider.label}</dd>
                        </div>
                        <div>
                          <dt>Model</dt>
                          <dd className="model-name">{data.provider.model}</dd>
                        </div>
                        <div>
                          <dt>Retrieval</dt>
                          <dd>Keyword search · up to 4 excerpts</dd>
                        </div>
                        <div>
                          <dt>Context window</dt>
                          <dd>20 recent messages · 16K characters</dd>
                        </div>
                        <div>
                          <dt>Daily demo limit</dt>
                          <dd>40 turns / account · 200 / service</dd>
                        </div>
                      </dl>
                      <p className="small muted">
                        Configure AI_BASE_URL, AI_API_KEY, AI_MODEL and AI_LABEL
                        in the server environment to use another
                        OpenAI-compatible provider.
                      </p>
                    </section>
                    <section className="settings-card">
                      <span className="feature-icon green">
                        <ShieldCheck size={22} />
                      </span>
                      <h2>Your space stays yours</h2>
                      <p className="muted">
                        Saved conversations are scoped to your account,
                        including chats with public assistants.
                      </p>
                      <ul className="privacy-list">
                        <li>
                          <Check size={15} />
                          Owners cannot read other users’ chats.
                        </li>
                        <li>
                          <Check size={15} />
                          You can delete conversations at any time.
                        </li>
                        <li>
                          <Check size={15} />
                          Private knowledge stays with its assistant.
                        </li>
                        <li>
                          <Info size={15} />
                          The AI provider receives prompts and context.
                        </li>
                        <li>
                          <Info size={15} />
                          AI answers can be incorrect. Check sources.
                        </li>
                      </ul>
                      <div className="release-note">
                        <strong>A focused first release.</strong>
                        <p>
                          No email verification or password recovery, teams,
                          billing, tools, web search, embeddings, PDF parsing,
                          or background tasks. Credentials and account recovery
                          require operational work before a wider launch.
                        </p>
                      </div>
                      <a
                        className="text-link"
                        href="https://github.com/sammymuya167-hash/sammymuya167-hash/tree/main/projects/shadowbot"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source, architecture & setup
                        <ExternalLink size={13} />
                      </a>
                    </section>
                  </div>
                </>
              )}
              {page === "chat" && (
                <>
                  {chatLoading ? (
                    <div className="state-panel">
                      <span className="loader" />
                      <p>Opening this conversation…</p>
                    </div>
                  ) : !bot ? (
                    <div className="state-panel">
                      <Lock size={29} />
                      <h2>This assistant is out of reach.</h2>
                      <p>
                        {chatError ||
                          "It may be private or no longer available."}
                      </p>
                      {!data.user && (
                        <button
                          className="primary"
                          onClick={() => setAuth(true)}
                        >
                          Sign in to your account
                          <ArrowRight size={15} />
                        </button>
                      )}
                      <button
                        className="text-link"
                        onClick={() => go("overview")}
                      >
                        Back to workspace
                      </button>
                    </div>
                  ) : (
                    <>
                      <header className="chat-header">
                        <Avatar color={bot.color} />
                        <div>
                          <h2>{bot.name}</h2>
                          <span>
                            <i
                              className={`status-dot ${data.provider.ready ? "" : "off"}`}
                            />
                            {data.provider.ready
                              ? "Here to help"
                              : "AI not configured"}
                            <span>·</span>
                            {bot.is_public
                              ? "Public assistant"
                              : "Private assistant"}
                          </span>
                        </div>
                        <div className="chat-header-actions">
                          {owner && (
                            <button
                              className="secondary compact"
                              disabled={streaming}
                              onClick={() =>
                                setEditor({
                                  bot: data.bots.find((b) => b.id === bot.id)!,
                                })
                              }
                            >
                              <Settings2 size={14} />
                              <span>Configure</span>
                            </button>
                          )}
                          <button
                            className="secondary compact"
                            disabled={streaming}
                            onClick={() => openBot(bot.id)}
                          >
                            <Plus size={15} />
                            <span>New chat</span>
                          </button>
                        </div>
                      </header>
                      <div className="chat-scroll">
                        <div
                          className={`chat-thread ${!messages.length ? "empty" : ""}`}
                        >
                          {!messages.length ? (
                            <>
                              <div className="welcome-bot">
                                <span className="welcome-orbit" />
                                <Avatar color={bot.color} large />
                                <span className="eyebrow">
                                  A GOOD CONVERSATION STARTS HERE
                                </span>
                                <h1>
                                  Hello, curious mind<span>.</span>
                                </h1>
                                <Text content={bot.greeting} />
                              </div>
                              <div className="suggestions">
                                {(bot.id === "shadow-guide"
                                  ? [
                                      {
                                        icon: Sparkles,
                                        title: "Help me get started",
                                        text: "How do I create my first assistant?",
                                      },
                                      {
                                        icon: BookOpen,
                                        title: "Bring my knowledge",
                                        text: "How does the knowledge base work?",
                                      },
                                      {
                                        icon: BotIcon,
                                        title: "Make it feel like me",
                                        text: "Help me write a good system prompt.",
                                      },
                                      {
                                        icon: ShieldCheck,
                                        title: "A little peace of mind",
                                        text: "Who can see my conversations and documents?",
                                      },
                                    ]
                                  : [
                                      {
                                        icon: MessageSquare,
                                        title: "Start a conversation",
                                        text: "Hello! What can you help me with?",
                                      },
                                      {
                                        icon: BookOpen,
                                        title: "Explore your knowledge",
                                        text: "What topics does your knowledge base cover?",
                                      },
                                    ]
                                ).map((s) => (
                                  <button
                                    key={s.title}
                                    onClick={() => send(undefined, s.text)}
                                    disabled={streaming}
                                  >
                                    <s.icon size={18} />
                                    <strong>{s.title}</strong>
                                    <span>{s.text}</span>
                                    <ArrowUpRight size={13} />
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            messages.map((m) => (
                              <article
                                className={`message ${m.role}`}
                                key={m.id}
                              >
                                <div className="message-avatar">
                                  {m.role === "assistant" ? (
                                    <Avatar color={bot.color} />
                                  ) : (
                                    <span className="user-avatar">
                                      {data.user?.name
                                        .slice(0, 1)
                                        .toUpperCase() || "Y"}
                                    </span>
                                  )}
                                </div>
                                <div className="message-body">
                                  <div className="message-author">
                                    <strong>
                                      {m.role === "user" ? "You" : bot.name}
                                    </strong>
                                    {m.role === "assistant" && (
                                      <span>AI ASSISTANT</span>
                                    )}
                                  </div>
                                  {m.content ? (
                                    <Text content={m.content} />
                                  ) : m.status === "streaming" ? (
                                    <div
                                      className="thinking"
                                      aria-label="Thinking"
                                    >
                                      <i />
                                      <i />
                                      <i />
                                    </div>
                                  ) : (
                                    <p className="muted small">
                                      No response was completed.
                                    </p>
                                  )}
                                  {m.status === "streaming" && m.content && (
                                    <span className="stream-cursor" />
                                  )}
                                  {m.sources.length > 0 && (
                                    <details className="source-details">
                                      <summary>
                                        <BookOpen size={13} />
                                        {m.sources.length} knowledge{" "}
                                        {m.sources.length === 1
                                          ? "source"
                                          : "sources"}
                                        <ChevronRight size={13} />
                                        <span>Retrieved context</span>
                                      </summary>
                                      <div className="source-items">
                                        {m.sources.map((s, i) => (
                                          <div
                                            className="source-item"
                                            key={s.id}
                                          >
                                            <strong>
                                              <span>{i + 1}</span>
                                              <FileText size={13} />
                                              {s.name}
                                            </strong>
                                            <p>{s.excerpt}</p>
                                          </div>
                                        ))}
                                        <p className="source-disclaimer">
                                          These excerpts were provided to the
                                          model. They do not guarantee that
                                          every claim is supported.
                                        </p>
                                      </div>
                                    </details>
                                  )}
                                  {m.role === "assistant" &&
                                    m.status !== "streaming" && (
                                      <div className="message-actions">
                                        <button
                                          aria-label="Copy response"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(
                                                m.content,
                                              );
                                              setCopied(m.id);
                                              setTimeout(
                                                () => setCopied(""),
                                                2000,
                                              );
                                            } catch {
                                              notify(
                                                "Select the response text to copy it.",
                                              );
                                            }
                                          }}
                                        >
                                          {copied === m.id ? (
                                            <Check size={13} />
                                          ) : (
                                            <Copy size={13} />
                                          )}
                                          <span>
                                            {copied === m.id
                                              ? "Copied"
                                              : "Copy"}
                                          </span>
                                        </button>
                                        {m.status !== "complete" && (
                                          <span className="interrupted">
                                            {m.status === "stopped"
                                              ? "Stopped"
                                              : "Incomplete response"}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                        <div ref={bottomRef} />
                      </div>
                      <div className="composer-wrap">
                        {chatError && (
                          <div className="chat-error" role="alert">
                            <Info size={15} />
                            <span>{chatError}</span>
                            <button
                              className="icon-button"
                              aria-label="Dismiss error"
                              onClick={() => setChatError("")}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                        <form className="composer" onSubmit={send}>
                          <textarea
                            aria-label={`Message ${bot.name}`}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={`Ask ${bot.name} anything…`}
                            maxLength={4000}
                            rows={2}
                            onKeyDown={(
                              e: KeyboardEvent<HTMLTextAreaElement>,
                            ) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                void send();
                              }
                            }}
                          />
                          <div className="composer-bottom">
                            <span>
                              <Sparkles size={13} />
                              {bot.id === "shadow-guide"
                                ? "Grounded in the product handbook"
                                : "Your assistant. Your knowledge."}
                            </span>
                            <div>
                              <span className="enter-hint">
                                <CornerDownLeft size={11} /> to send
                              </span>
                              {streaming ? (
                                <button
                                  type="button"
                                  className="send-button stop"
                                  aria-label="Stop response"
                                  onClick={() => abortRef.current?.abort()}
                                >
                                  <Square size={15} fill="currentColor" />
                                </button>
                              ) : (
                                <button
                                  type="submit"
                                  className="send-button"
                                  aria-label="Send message"
                                  disabled={!input.trim() || chatLoading}
                                >
                                  <ArrowRight size={19} />
                                </button>
                              )}
                            </div>
                          </div>
                        </form>
                        <p className="composer-note">
                          <Lock size={10} />
                          {data.user
                            ? "Saved privately to your account."
                            : "Sign in to chat and save your history."}
                          <span>
                            AI can make mistakes. Check important answers.
                          </span>
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {page !== "chat" && (
            <footer className="workspace-footer">
              <span>
                Thoughtfully built by <strong>SHADOWNET</strong>
              </span>
              <span>
                ShadowBot <i /> Catalogue #086 <i /> v1.0
              </span>
            </footer>
          )}
        </main>
      </div>
      {auth && <Auth onClose={() => setAuth(false)} onSuccess={refresh} />}
      {editor && (
        <BotEditor
          bot={editor.bot}
          initialTab={editor.tab}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await refresh();
            if (bot && editor.bot?.id === bot.id) {
              const result = await api<{ bot: Bot }>(
                `/api/bots/${bot.id}`,
              ).catch(() => null);
              if (result) setBot(result.bot);
              else {
                setBot(null);
                setMessages([]);
                go("bots");
              }
            }
          }}
          onPreview={(b) => {
            setEditor(null);
            void openBot(b.id);
          }}
          notify={notify}
        />
      )}
      {deleteId && (
        <Modal
          title="Delete this conversation?"
          onClose={deleting ? () => {} : () => setDeleteId(null)}
        >
          <div className="delete-copy">
            <p>
              This removes the saved messages from your account. It cannot be
              undone.
            </p>
            <div>
              <button
                className="secondary"
                onClick={() => setDeleteId(null)}
                disabled={deleting}
              >
                Keep conversation
              </button>
              <button
                className="danger"
                onClick={removeConversation}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete conversation"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function SignInState({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="state-panel soft">
      <Lock size={30} />
      <h2>A workspace with your name on it.</h2>
      <p>
        Create an account to manage assistants and keep your conversations
        together.
      </p>
      <button className="primary" onClick={onSignIn}>
        Create your account
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function AssistantCard({
  item,
  own,
  ready,
  onEdit,
  onOpen,
}: {
  item: Bot;
  own: boolean;
  ready: boolean;
  onEdit: (b: Bot) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <article className="assistant-card">
      <div className="card-top">
        <Avatar color={item.color} />
        <span className={`badge ${item.id === "shadow-guide" ? "violet" : ""}`}>
          {item.id === "shadow-guide" ? (
            <>
              <Sparkles size={10} />
              Sample assistant
            </>
          ) : item.is_public ? (
            <>
              <Globe size={10} />
              Public
            </>
          ) : (
            <>
              <Lock size={10} />
              Private
            </>
          )}
        </span>
        {own && (
          <button
            className="icon-button card-edit"
            onClick={() => onEdit(item)}
            aria-label={`Configure ${item.name}`}
          >
            <Settings2 size={16} />
          </button>
        )}
      </div>
      <h3>{item.name}</h3>
      <p>
        {item.description ||
          "Your custom assistant, ready for its next conversation."}
      </p>
      <div className="card-meta">
        <span>
          <BookOpen size={12} />
          {item.id === "shadow-guide"
            ? "Product handbook"
            : `${item.document_count || 0} documents`}
        </span>
        <span className="tiny-dot" />
        <span>
          {own
            ? "Created by you"
            : item.id === "shadow-guide"
              ? "By SHADOWNET"
              : "Community assistant"}
        </span>
      </div>
      <div className="card-footer">
        <span>
          <i className={`status-dot ${ready ? "" : "off"}`} />
          {ready ? "Ready to chat" : "AI not configured"}
        </span>
        <button onClick={() => onOpen(item.id)}>
          Open chat
          <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}
