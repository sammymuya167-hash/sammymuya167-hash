"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  Code2,
  Copy,
  Download,
  Folder,
  History,
  Plus,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Upload,
  X,
  ArrowUpRight,
  Globe,
  FlaskConical,
  Check,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import {
  curlCommand,
  methods,
  runRequest,
  sanitizeWorkspace,
  workspaceSchema,
  type RequestDraft,
  type ResponseResult,
  type Workspace,
} from "../lib/lab";
import {
  AssertionsEditor,
  EnvironmentEditor,
  JsonResponse,
  Modal,
  PairEditor,
} from "./panels";
type Summary = {
  name: string;
  method: RequestDraft["method"];
  status: number;
  durationMs: number;
  passed: number;
  total: number;
  failed: boolean;
};
type Run = {
  id: string;
  name: string;
  summary: Summary[];
  createdAt: number;
  local?: boolean;
};
export default function Studio({
  initialWorkspace,
  signedIn,
  signInPath,
}: {
  initialWorkspace: Workspace;
  signedIn: boolean;
  signInPath: string;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace),
    [revision, setRevision] = useState(0),
    [loaded, setLoaded] = useState(!signedIn);
  const [activeId, setActiveId] = useState("products"),
    [environmentId, setEnvironmentId] = useState("sandbox"),
    [requestTab, setRequestTab] = useState<
      "params" | "headers" | "body" | "tests"
    >("params");
  const [responseTab, setResponseTab] = useState<"body" | "headers" | "tests">(
      "body",
    ),
    [result, setResult] = useState<ResponseResult | null>(null),
    [sending, setSending] = useState(false),
    [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false),
    [notice, setNotice] = useState(""),
    [filter, setFilter] = useState(""),
    [closed, setClosed] = useState<string[]>([]);
  const [modal, setModal] = useState<
      | "environment"
      | "import"
      | "code"
      | "help"
      | "new"
      | "history"
      | "runner"
      | "delete"
      | null
    >(null),
    [importText, setImportText] = useState(""),
    [newName, setNewName] = useState(""),
    [snippet, setSnippet] = useState("");
  const [runs, setRuns] = useState<Run[]>([]),
    [runnerResults, setRunnerResults] = useState<Summary[]>([]),
    [runnerActive, setRunnerActive] = useState(false);
  const controller = useRef<AbortController | null>(null),
    runnerController = useRef<AbortController | null>(null);
  const collections = workspace.collections,
    collection =
      collections.find((c) => c.requests.some((r) => r.id === activeId)) ??
      collections[0];
  const draft =
    collection?.requests.find((r) => r.id === activeId) ??
    collection?.requests[0];
  const environment =
    workspace.environments.find((e) => e.id === environmentId) ??
    workspace.environments[0];
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/workspace")
      .then(async (r) => {
        const data = (await r.json()) as {
          workspace: Workspace | null;
          revision: number;
          runs: Run[];
          error?: string;
        };
        if (!r.ok) throw new Error(data.error);
        if (!cancelled) {
          if (data.workspace) {
            setWorkspace(data.workspace);
            setActiveId(data.workspace.collections[0]?.requests[0]?.id ?? "");
          }
          setRevision(data.revision);
          setRuns(data.runs);
          setDirty(!data.workspace);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (!cancelled) setNotice(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);
  useEffect(
    () => () => {
      controller.current?.abort();
      runnerController.current?.abort();
    },
    [],
  );
  const update = (next: Workspace) => {
    setWorkspace(next);
    setDirty(true);
  };
  function patchDraft(values: Partial<RequestDraft>) {
    if (!draft) return;
    update({
      ...workspace,
      collections: collections.map((c) => ({
        ...c,
        requests: c.requests.map((r) =>
          r.id === draft.id ? { ...r, ...values } : r,
        ),
      })),
    });
  }
  async function save() {
    if (!signedIn || !loaded || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: sanitizeWorkspace(workspace),
          revision,
        }),
      });
      const data = (await response.json()) as {
        revision: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision);
      setDirty(false);
      setNotice("Collections saved. Secret values remain only in this tab.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }
  async function reload() {
    if (saving || sending || runnerActive) return;
    try {
      const response = await fetch("/api/workspace");
      const data = (await response.json()) as {
        workspace: Workspace | null;
        revision: number;
        runs: Run[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      setWorkspace(data.workspace ?? initialWorkspace);
      setActiveId(
        (data.workspace ?? initialWorkspace).collections[0]?.requests[0]?.id ??
          "",
      );
      setRevision(data.revision);
      setRuns(data.runs);
      setDirty(false);
      setLoaded(true);
      setResult(null);
      setNotice("Loaded your saved collections.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reload failed.");
    }
  }
  const summary = (
    request: RequestDraft,
    response: ResponseResult,
  ): Summary => ({
    name: request.name,
    method: request.method,
    status: response.status,
    durationMs: response.durationMs,
    passed: response.checks.filter((c) => c.passed).length,
    total: response.checks.length,
    failed: !!response.error || response.checks.some((c) => !c.passed),
  });
  async function record(name: string, data: Summary[]) {
    const run: Run = {
      id: crypto.randomUUID(),
      name,
      summary: data,
      createdAt: Date.now(),
      local: true,
    };
    if (signedIn) {
      try {
        const response = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, summary: data }),
        });
        const stored = (await response.json()) as {
          id: string;
          createdAt: number;
          error?: string;
        };
        if (!response.ok) throw new Error(stored.error);
        run.id = stored.id;
        run.createdAt = stored.createdAt;
        run.local = false;
      } catch {
        setNotice(
          "Requests completed. This run is available in this tab; its summary could not be saved.",
        );
      }
    }
    setRuns((previous) => [run, ...previous].slice(0, 30));
  }
  async function send() {
    if (!draft || !environment || sending || runnerActive) return;
    controller.current = new AbortController();
    setSending(true);
    setResult(null);
    const response = await runRequest(
      draft,
      environment,
      window.location.origin,
      controller.current.signal,
    );
    setResult(response);
    setSending(false);
    await record(draft.name, [summary(draft, response)]);
  }
  async function runCollection() {
    if (!collection || !environment || sending || runnerActive) return;
    runnerController.current = new AbortController();
    setRunnerActive(true);
    setRunnerResults([]);
    const entries: Summary[] = [];
    for (const request of collection.requests) {
      if (runnerController.current.signal.aborted) break;
      const response = await runRequest(
        request,
        environment,
        window.location.origin,
        runnerController.current.signal,
      );
      const entry = summary(request, response);
      entries.push(entry);
      setRunnerResults([...entries]);
    }
    setRunnerActive(false);
    if (entries.length) await record(collection.name, entries);
  }
  function addRequest() {
    if (!collection || collection.requests.length >= 40) {
      setNotice(
        "Create another collection; this one has reached its 40-request limit.",
      );
      return;
    }
    const request: RequestDraft = {
      id: crypto.randomUUID(),
      name: "Untitled request",
      method: "GET",
      url: "{{base_url}}/api/mock/products",
      headers: [],
      body: "",
      assertions: [
        { id: crypto.randomUUID(), kind: "status", path: "", expected: "200" },
      ],
    };
    update({
      ...workspace,
      collections: collections.map((c) =>
        c.id === collection.id
          ? { ...c, requests: [...c.requests, request] }
          : c,
      ),
    });
    setActiveId(request.id);
    setResult(null);
  }
  function addCollection() {
    if (collections.length >= 15) {
      setNotice("The workspace supports up to 15 collections.");
      return;
    }
    if (!newName.trim()) return;
    const id = crypto.randomUUID(),
      request: RequestDraft = {
        id: crypto.randomUUID(),
        name: "First request",
        method: "GET",
        url: "{{base_url}}/api/mock/products",
        headers: [],
        body: "",
        assertions: [],
      };
    update({
      ...workspace,
      collections: [
        ...collections,
        { id, name: newName.trim(), requests: [request] },
      ],
    });
    setActiveId(request.id);
    setNewName("");
    setModal(null);
    setResult(null);
  }
  function importWorkspace(value: string) {
    try {
      if (value.length > 220000)
        throw new Error("Import a JSON workspace smaller than 220 KB.");
      const parsed = workspaceSchema.parse(JSON.parse(value));
      const safe = sanitizeWorkspace(parsed);
      update(safe);
      setActiveId(safe.collections[0]?.requests[0]?.id ?? "");
      setEnvironmentId(safe.environments[0]?.id ?? "");
      setResult(null);
      setModal(null);
      setNotice("Workspace imported. Save it to keep it in your account.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "This file could not be imported.",
      );
    }
  }
  function downloadWorkspace() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...sanitizeWorkspace(workspace) }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "requestlab-workspace.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(
      "Exported collections and public variables. Secret variable values and credential headers are cleared.",
    );
  }
  function showCode() {
    if (!draft || !environment) return;
    try {
      setSnippet(curlCommand(draft, environment, window.location.origin));
      setModal("code");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Check this request.");
    }
  }
  const lock = !loaded || saving,
    passed = result?.checks.filter((c) => c.passed).length ?? 0;
  return (
    <div className="lab-shell">
      <header className="global-header">
        <Link className="brand" href="/">
          <Braces size={24} />
          <span>
            RequestLab<span className="brand-dot">.</span>
          </span>
        </Link>
        <span className="workspace-tag">SHADOWNET / API WORKSPACE</span>
        <div className="global-actions">
          <span className="private-indicator">
            <span />
            {signedIn
              ? loaded
                ? "Private workspace"
                : "Loading workspace…"
              : "Public demo"}
          </span>
          <button
            className="header-button"
            onClick={() => setModal("import")}
            disabled={lock}
          >
            <Upload size={14} />
            Import
          </button>
          <button
            className="header-button"
            onClick={downloadWorkspace}
            disabled={lock}
          >
            <Download size={14} />
            Export
          </button>
          {signedIn ? (
            <button
              className="header-button save-button"
              onClick={save}
              disabled={lock || !dirty}
            >
              <Save size={14} />
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          ) : (
            <a className="signin" href={signInPath}>
              Sign in to save
              <ArrowUpRight size={13} />
            </a>
          )}
          <span className="profile-avatar">S</span>
        </div>
      </header>
      <aside className="collection-sidebar">
        <div className="sidebar-title">
          <h2>Collections</h2>
          <button
            className="icon-button"
            onClick={() => setModal("new")}
            disabled={lock}
            aria-label="New collection"
          >
            <Plus size={17} />
          </button>
        </div>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            placeholder="Find a request…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search collections"
          />
        </label>
        <nav aria-label="Request collections">
          {collections.map((c) => (
            <div className="collection" key={c.id}>
              <button
                className="collection-title"
                onClick={() =>
                  setClosed((ids) =>
                    ids.includes(c.id)
                      ? ids.filter((id) => id !== c.id)
                      : [...ids, c.id],
                  )
                }
                aria-expanded={!closed.includes(c.id)}
              >
                {closed.includes(c.id) ? (
                  <ChevronRight size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                <Folder size={14} />
                <span>{c.name}</span>
                <b>{c.requests.length}</b>
              </button>
              {!closed.includes(c.id) &&
                c.requests
                  .filter((r) =>
                    r.name.toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map((r) => (
                    <button
                      className={`request-nav ${draft?.id === r.id ? "active" : ""}`}
                      key={r.id}
                      onClick={() => {
                        setActiveId(r.id);
                        setResult(null);
                      }}
                    >
                      <span
                        className={`method method-${r.method.toLowerCase()}`}
                      >
                        {r.method}
                      </span>
                      <span>{r.name}</span>
                      {r.id === draft?.id && <span className="active-dot" />}
                    </button>
                  ))}
            </div>
          ))}
        </nav>
        <button
          className="add-request"
          onClick={addRequest}
          disabled={lock || !collection}
        >
          <Plus size={14} />
          New request
        </button>
        <div className="sandbox-card">
          <div>
            <FlaskConical size={18} />
            <span>YOUR PLAYGROUND IS LIVE</span>
          </div>
          <h3>
            Break things.
            <br />
            Learn things.
          </h3>
          <p>
            A real mock API. Synthetic data.
            <br />
            Zero setup, plenty to explore.
          </p>
          <button onClick={() => setModal("help")}>
            Explore the sandbox
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setModal("history")}>
            <History size={16} />
            Run history<span>{runs.length}</span>
          </button>
          <button onClick={() => setModal("help")}>
            <BookOpen size={16} />
            Guide & API reference
          </button>
          <a
            href="https://github.com/sammymuya167-hash/sammymuya167-hash/tree/main/projects/requestlab"
            target="_blank"
            rel="noreferrer"
          >
            VIEW SOURCE
            <ArrowUpRight size={12} />
          </a>
        </div>
      </aside>
      <main className="studio-content">
        <div className="studio-topbar">
          <div>
            <Folder size={14} />
            <span>{collection?.name ?? "Your workspace"}</span>
            <ChevronRight size={12} />
            <strong>{draft?.name ?? "No request selected"}</strong>
            {dirty && <span className="dirty-dot" title="Unsaved changes" />}
          </div>
          <div className="environment-picker">
            <span className="environment-light" />
            <select
              aria-label="Active environment"
              disabled={lock || sending || runnerActive}
              value={environment?.id ?? ""}
              onChange={(e) => setEnvironmentId(e.target.value)}
            >
              {workspace.environments.map((env) => (
                <option value={env.id} key={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              onClick={() => setModal("environment")}
              disabled={lock || sending || runnerActive}
              aria-label="Edit environments"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </div>
        {notice && (
          <div className="notice" role="status">
            <AlertCircle size={14} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">
              <X size={14} />
            </button>
            {signedIn && (
              <button className="notice-reload" onClick={reload}>
                Reload saved
              </button>
            )}
          </div>
        )}
        {draft ? (
          <>
            <section className="request-section">
              <div className="request-heading">
                <div className="eyebrow">REQUEST BUILDER</div>
                <div className="request-heading-actions">
                  <button onClick={showCode}>
                    <Code2 size={14} />
                    Code
                  </button>
                  <button
                    onClick={() => {
                      setRunnerResults([]);
                      setModal("runner");
                    }}
                    disabled={lock || sending}
                  >
                    <CirclePlay size={14} />
                    Run collection
                  </button>
                  <button
                    className="icon-button"
                    disabled={lock}
                    onClick={() => setModal("delete")}
                    aria-label="Delete selected request"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <label className="request-name-label">
                <input
                  disabled={lock}
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => patchDraft({ name: e.target.value })}
                  aria-label="Request name"
                />
                <span>Know what your API is saying.</span>
              </label>
              <div className="request-url-row">
                <select
                  className={`method-select method-${draft.method.toLowerCase()}`}
                  aria-label="HTTP method"
                  value={draft.method}
                  disabled={lock || sending || runnerActive}
                  onChange={(e) =>
                    patchDraft({
                      method: e.target.value as RequestDraft["method"],
                    })
                  }
                >
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  className="url-input"
                  aria-label="Request URL"
                  disabled={lock || sending || runnerActive}
                  value={draft.url}
                  onChange={(e) => patchDraft({ url: e.target.value })}
                  placeholder="https://api.example.com/resource"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                />
                <button
                  className="send-button"
                  disabled={lock || !environment || runnerActive}
                  onClick={sending ? () => controller.current?.abort() : send}
                >
                  {sending ? (
                    <Square size={13} fill="currentColor" />
                  ) : (
                    <CirclePlay size={16} />
                  )}
                  <span>{sending ? "Cancel" : "Send"}</span>
                </button>
              </div>
              <div
                className="request-tabs"
                role="tablist"
                aria-label="Request editor tabs"
              >
                {(["params", "headers", "body", "tests"] as const).map(
                  (tab) => (
                    <button
                      role="tab"
                      aria-selected={requestTab === tab}
                      key={tab}
                      className={requestTab === tab ? "selected" : ""}
                      onClick={() => setRequestTab(tab)}
                    >
                      {tab === "tests"
                        ? "Tests"
                        : tab[0].toUpperCase() + tab.slice(1)}
                      {tab === "headers" && (
                        <span>
                          {
                            draft.headers.filter((h) => h.enabled && h.key)
                              .length
                          }
                        </span>
                      )}
                      {tab === "tests" && (
                        <span>{draft.assertions.length}</span>
                      )}
                      {tab === "body" && draft.body && <i />}
                    </button>
                  ),
                )}
                <span className="request-format">
                  {requestTab === "body"
                    ? "JSON / RAW"
                    : requestTab === "tests"
                      ? "NO SCRIPTS REQUIRED"
                      : "KEY–VALUE"}
                </span>
              </div>
              <div className="request-editor" role="tabpanel">
                <fieldset disabled={lock || sending || runnerActive}>
                  {requestTab === "params" && (
                    <ParamsEditor
                      url={draft.url}
                      onChange={(url) => patchDraft({ url })}
                    />
                  )}
                  {requestTab === "headers" && (
                    <PairEditor
                      rows={draft.headers}
                      onChange={(headers) => patchDraft({ headers })}
                    />
                  )}
                  {requestTab === "body" && (
                    <div className="body-editor">
                      <div>
                        <span>Request body</span>
                        <button
                          onClick={() => {
                            try {
                              patchDraft({
                                body: JSON.stringify(
                                  JSON.parse(draft.body),
                                  null,
                                  2,
                                ),
                              });
                            } catch {
                              setNotice(
                                "The request body is not valid JSON. It can still be sent as raw text.",
                              );
                            }
                          }}
                        >
                          <Braces size={13} />
                          Format JSON
                        </button>
                      </div>
                      <textarea
                        spellCheck={false}
                        value={draft.body}
                        onChange={(e) => patchDraft({ body: e.target.value })}
                        aria-label="Request body"
                        placeholder={'{\n  "message": "hello"\n}'}
                      />
                      <p>
                        {["GET", "HEAD"].includes(draft.method)
                          ? "GET and HEAD do not send a body."
                          : "Set Content-Type: application/json when sending JSON."}{" "}
                        Variables use {"{{name}}"}.
                      </p>
                    </div>
                  )}
                  {requestTab === "tests" && (
                    <AssertionsEditor
                      assertions={draft.assertions}
                      onChange={(assertions) => patchDraft({ assertions })}
                    />
                  )}
                </fieldset>
              </div>
              <div className="request-footer">
                <span>
                  <ShieldCheck size={13} />
                  Secret values stay in this tab.
                </span>
                <span>
                  <Globe size={12} />
                  Browser requests · External APIs require CORS
                </span>
              </div>
            </section>
            <section className="response-section">
              <div className="response-header">
                <h2>
                  Response
                  <span
                    className={
                      sending ? "response-dot sending" : "response-dot"
                    }
                  />
                </h2>
                {result && !result.error ? (
                  <div className="response-metrics">
                    <span
                      className={
                        result.status < 400
                          ? "response-status success"
                          : "response-status error-status"
                      }
                    >
                      {result.status} {result.statusText}
                    </span>
                    <span>
                      {Math.round(result.durationMs)}
                      <small> ms</small>
                    </span>
                    <span>
                      {(result.sizeBytes / 1024).toFixed(2)}
                      <small> KB</small>
                    </span>
                    <span
                      className={
                        passed === result.checks.length
                          ? "test-count"
                          : "test-count failed"
                      }
                    >
                      {passed}/{result.checks.length}
                      <small> tests</small>
                    </span>
                  </div>
                ) : (
                  <span className="response-placeholder">
                    {sending ? "Waiting for the API…" : "Ready when you are"}
                  </span>
                )}
              </div>
              <div
                className="response-tabs"
                role="tablist"
                aria-label="Response tabs"
              >
                {(["body", "headers", "tests"] as const).map((tab) => (
                  <button
                    role="tab"
                    aria-selected={responseTab === tab}
                    className={responseTab === tab ? "selected" : ""}
                    key={tab}
                    onClick={() => setResponseTab(tab)}
                  >
                    {tab[0].toUpperCase() + tab.slice(1)}
                    {tab === "tests" && result && (
                      <span>
                        {passed}/{result.checks.length}
                      </span>
                    )}
                  </button>
                ))}
                {result && (
                  <button
                    className="copy-response"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.body);
                        setNotice("Response body copied.");
                      } catch {
                        setNotice(
                          "Copy is unavailable in this browser. Select the response text to copy it.",
                        );
                      }
                    }}
                  >
                    <Copy size={13} />
                    Copy body
                  </button>
                )}
              </div>
              <div className="response-view" role="tabpanel">
                {sending ? (
                  <div className="response-empty">
                    <div className="loading-orbit" />
                    <h3>Let’s see what comes back.</h3>
                    <p>Sending your request to the selected endpoint.</p>
                  </div>
                ) : !result ? (
                  <div className="response-empty">
                    <div className="empty-symbol">
                      <Terminal size={28} />
                    </div>
                    <h3>A little curiosity goes a long way.</h3>
                    <p>
                      Send a request to inspect the response.
                      <br />
                      Try the built-in sandbox — it’s ready to go.
                    </p>
                    <button onClick={send} disabled={lock || !environment}>
                      <CirclePlay size={14} />
                      Send your first request
                    </button>
                  </div>
                ) : result.error ? (
                  <div className="response-error" role="alert">
                    <AlertCircle size={28} />
                    <h3>Request could not complete</h3>
                    <p>{result.error}</p>
                  </div>
                ) : responseTab === "body" ? (
                  <JsonResponse body={result.body} />
                ) : responseTab === "headers" ? (
                  <div className="response-header-table">
                    {result.headers.map(([key, value]) => (
                      <div key={key}>
                        <code>{key}</code>
                        <span>{value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="checks-list">
                    {result.checks.length ? (
                      result.checks.map((c) => (
                        <div
                          className={`check-row ${c.passed ? "passed" : "failed"}`}
                          key={c.id}
                        >
                          {c.passed ? <Check size={15} /> : <X size={15} />}
                          <span>{c.label}</span>
                          <code>{c.actual}</code>
                          <b>{c.passed ? "PASS" : "FAIL"}</b>
                        </div>
                      ))
                    ) : (
                      <div className="small-empty">
                        Add assertions in the request’s Tests tab, then send
                        again.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="no-requests">
            <Braces size={35} />
            <h1>Your next API adventure.</h1>
            <p>Create a collection, add a request, and see what comes back.</p>
            <button
              className="send-button"
              onClick={() => setModal("new")}
              disabled={lock}
            >
              <Plus size={15} />
              New collection
            </button>
          </div>
        )}
        <footer className="studio-footer">
          <span>
            <span className="online-dot" />
            Sandbox online
            <span className="footer-divider" />
            {signedIn ? "Private saved data" : "Synthetic demo data"}
          </span>
          <span>BUILT WITH CURIOSITY. BY SHADOWNET.</span>
        </footer>
      </main>
      {modal === "environment" && (
        <EnvironmentEditor
          environments={workspace.environments}
          onChange={(environments) => update({ ...workspace, environments })}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "new" && (
        <Modal
          title="Make room for your next idea"
          onClose={() => setModal(null)}
        >
          <form
            className="simple-form"
            onSubmit={(e) => {
              e.preventDefault();
              addCollection();
            }}
          >
            <label>
              Collection name
              <input
                autoFocus
                required
                maxLength={80}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Payments API, Weekend experiment…"
              />
            </label>
            <button className="send-button" type="submit">
              <Plus size={15} />
              Create collection
            </button>
          </form>
        </Modal>
      )}
      {modal === "import" && (
        <Modal
          title="Bring your workspace with you"
          onClose={() => setModal(null)}
        >
          <div className="import-panel">
            <p>
              Import RequestLab JSON to replace this workspace. Secret values
              are cleared. Save changes to persist the imported collections.
            </p>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import workspace file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 220000)
                    setNotice("Import a JSON workspace smaller than 220 KB.");
                  else importWorkspace(await file.text());
                }
              }}
            />
            <textarea
              rows={9}
              spellCheck={false}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Or paste a RequestLab workspace JSON…"
              aria-label="Workspace JSON"
            />
            <button
              className="send-button"
              onClick={() => importWorkspace(importText)}
              disabled={!importText.trim()}
            >
              <Upload size={15} />
              Import JSON
            </button>
          </div>
        </Modal>
      )}
      {modal === "code" && (
        <Modal
          title="Take this request anywhere"
          onClose={() => setModal(null)}
        >
          <div className="code-panel">
            <p>
              Generated cURL. Session secrets are replaced with placeholders.
            </p>
            <pre>{snippet}</pre>
            <button
              className="header-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(snippet);
                  setNotice("cURL command copied.");
                } catch {
                  setNotice("Select the command to copy it.");
                }
              }}
            >
              <Copy size={14} />
              Copy cURL
            </button>
          </div>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal title="Remove this request?" onClose={() => setModal(null)}>
          <div className="simple-form">
            <p>
              Remove {draft?.name} from the current workspace. This change will
              be saved only when you click Save changes.
            </p>
            <button
              className="danger-button"
              onClick={() => {
                if (!draft || !collection) return;
                const requests = collection.requests.filter(
                  (r) => r.id !== draft.id,
                );
                update({
                  ...workspace,
                  collections: collections.map((c) =>
                    c.id === collection.id ? { ...c, requests } : c,
                  ),
                });
                setActiveId(
                  requests[0]?.id ??
                    collections.find((c) => c.id !== collection.id)?.requests[0]
                      ?.id ??
                    "",
                );
                setResult(null);
                setModal(null);
              }}
            >
              <Trash2 size={14} />
              Remove request
            </button>
          </div>
        </Modal>
      )}
      {modal === "runner" && (
        <Modal
          title={`${collection?.name ?? "Collection"} · Test run`}
          onClose={() => {
            if (!runnerActive) setModal(null);
          }}
          wide
        >
          <div className="runner-panel">
            <p>
              Run each request in order with{" "}
              <strong>{environment?.name}</strong>. A failed assertion keeps the
              run going so you can see the whole picture.
            </p>
            <div className="runner-toolbar">
              <span>
                {runnerResults.length} / {collection?.requests.length ?? 0}{" "}
                requests completed
              </span>
              <button
                className="send-button"
                disabled={!environment || !collection?.requests.length}
                onClick={
                  runnerActive
                    ? () => runnerController.current?.abort()
                    : runCollection
                }
              >
                {runnerActive ? <Square size={13} /> : <CirclePlay size={16} />}
                {runnerActive ? "Cancel run" : "Run collection"}
              </button>
            </div>
            {runnerResults.length ? (
              <RunTable data={runnerResults} />
            ) : (
              <div className="small-empty">
                Ready to run. This sends real requests to the configured
                endpoints.
              </div>
            )}
            <p className="privacy-note">
              <ShieldCheck size={14} />
              Run history stores status, timing, and counts. Response bodies and
              credentials are not saved.
            </p>
          </div>
        </Modal>
      )}
      {modal === "history" && (
        <Modal
          title="A trail of experiments"
          onClose={() => setModal(null)}
          wide
        >
          <div className="history-panel">
            {runs.length ? (
              runs.map((run) => (
                <details key={run.id}>
                  <summary>
                    <History size={14} />
                    <strong>{run.name}</strong>
                    <span>
                      {run.summary.filter((s) => !s.failed).length}/
                      {run.summary.length} passed
                    </span>
                    <small>
                      {new Date(run.createdAt).toLocaleString("en-GB")} ·{" "}
                      {run.local ? "This tab" : "Saved"}
                    </small>
                    <ChevronDown size={15} />
                  </summary>
                  <RunTable data={run.summary} />
                </details>
              ))
            ) : (
              <div className="small-empty">
                Send a request or run a collection to start your history.
              </div>
            )}
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Your API curiosity, fully equipped"
          onClose={() => setModal(null)}
          wide
        >
          <div className="help-panel">
            <div>
              <h3>Try the sandbox</h3>
              <p>
                These are real server routes with synthetic data. They do not
                create purchases or persist orders.
              </p>
              <code>GET /api/mock/products?limit=3</code>
              <code>GET /api/mock/products/1</code>
              <code>POST /api/mock/orders</code>
              <code>POST /api/mock/echo</code>
              <code>GET /api/mock/status/503</code>
              <p>
                Orders accept productId, quantity (1–20), and customer. Invalid
                payloads return 422; out-of-stock products return 409.
              </p>
            </div>
            <div>
              <h3>Build a repeatable test</h3>
              <p>
                Set a URL, method, headers, and body. Add status, response time,
                header, JSON equality, or field-existence assertions.
              </p>
              <p>
                Use dotted paths like <code>products.0.id</code> or JSON Pointer{" "}
                <code>/products/0/id</code>. Variables use {"{{name}}"};{" "}
                {"{{origin}}"} is always the current Site.
              </p>
              <p>
                Requests go directly from your browser. External APIs must allow
                CORS and HTTPS. There is no server proxy, OAuth flow, or script
                execution.
              </p>
              <p>
                Sign in to save private collections and run summaries. Secret
                variables and credential headers are kept in this tab; arbitrary
                literal values in bodies and URLs remain part of a saved
                request. Use variables for credentials.
              </p>
              <p>
                Each response is limited to 1 MiB and each request to 15
                seconds. Redirects return a browser error. Saved results are
                browser-reported observations.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
function RunTable({ data }: { data: Summary[] }) {
  return (
    <div className="run-table">
      <div className="run-table-head">
        <span>REQUEST</span>
        <span>STATUS</span>
        <span>TIME</span>
        <span>TESTS</span>
        <span>RESULT</span>
      </div>
      {data.map((entry, index) => (
        <div key={`${entry.name}-${index}`}>
          <span>
            <b className={`method method-${entry.method.toLowerCase()}`}>
              {entry.method}
            </b>
            {entry.name}
          </span>
          <code>{entry.status || "ERR"}</code>
          <small>{Math.round(entry.durationMs)} ms</small>
          <small>
            {entry.passed}/{entry.total}
          </small>
          <strong className={entry.failed ? "failed" : "passed"}>
            {entry.failed ? "FAIL" : "PASS"}
          </strong>
        </div>
      ))}
    </div>
  );
}
function ParamsEditor({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const hashIndex = url.indexOf("#"),
    hash = hashIndex < 0 ? "" : url.slice(hashIndex),
    plain = hashIndex < 0 ? url : url.slice(0, hashIndex),
    queryIndex = plain.indexOf("?"),
    base = queryIndex < 0 ? plain : plain.slice(0, queryIndex),
    params = new URLSearchParams(
      queryIndex < 0 ? "" : plain.slice(queryIndex + 1),
    );
  const rows = Array.from(params.entries());
  function change(index: number, key: string, value: string, remove = false) {
    const next = rows.flatMap((row, i) =>
      i === index ? (remove ? [] : [[key, value]]) : [row],
    );
    if (index === rows.length && !remove) next.push([key, value]);
    const query = new URLSearchParams(next)
      .toString()
      .replace(/%7B%7B/g, "{{")
      .replace(/%7D%7D/g, "}}");
    onChange(base + (query ? `?${query}` : "") + hash);
  }
  return (
    <div className="params-editor">
      <div className="pair-table-heading">
        <span>KEY</span>
        <span>VALUE</span>
        <span />
      </div>
      {rows.map(([key, value], i) => (
        <div className="param-row" key={i}>
          <input
            aria-label={`Parameter ${i + 1} key`}
            value={key}
            onChange={(e) => change(i, e.target.value, value)}
          />
          <input
            aria-label={`Parameter ${i + 1} value`}
            value={value}
            onChange={(e) => change(i, key, e.target.value)}
          />
          <button
            className="icon-button"
            onClick={() => change(i, key, value, true)}
            aria-label={`Remove parameter ${key}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="add-row"
        onClick={() => change(rows.length, `param${rows.length + 1}`, "")}
      >
        <Plus size={14} />
        Add query parameter
      </button>
      <p className="editor-hint">
        Query parameters are reflected in the request URL.
      </p>
    </div>
  );
}
