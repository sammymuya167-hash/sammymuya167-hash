"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Zap,
  LayoutDashboard,
  ListTodo,
  ChartNoAxesCombined,
  Activity,
  Settings2,
  Plus,
  Search,
  ChevronRight,
  CalendarDays,
  Download,
  ArrowUpRight,
  CheckCheck,
  Circle,
  LockKeyhole,
  RotateCw,
  Flag,
  Bug,
  CheckSquare2,
  BookOpen,
  X,
} from "lucide-react";
import {
  activeSprint,
  applyAction,
  blockers,
  exportCsv,
  people,
  sprintStats,
  statusNames,
  type Action,
  type Board,
  type Issue,
  type Status,
} from "../lib/board";
import { IssueEditor, SprintEditor, Modal } from "./editors";
import Insights from "./insights";
type View = "board" | "backlog" | "insights" | "activity" | "settings";
const navigation = [
  { id: "board", label: "Sprint board", icon: LayoutDashboard },
  { id: "backlog", label: "Backlog", icon: ListTodo },
  { id: "insights", label: "Insights", icon: ChartNoAxesCombined },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Project settings", icon: Settings2 },
] as const;
export default function Workspace({
  initialBoard,
  signedIn,
  signInPath,
}: {
  initialBoard: Board;
  signedIn: boolean;
  signInPath: string;
}) {
  const [board, setBoard] = useState(initialBoard),
    [revision, setRevision] = useState(0);
  const [view, setView] = useState<View>("board"),
    [search, setSearch] = useState(""),
    [assignee, setAssignee] = useState("all");
  const [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(!signedIn),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null),
    [starting, setStarting] = useState(false),
    [completing, setCompleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [help, setHelp] = useState(false);
  const sprint = activeSprint(board),
    stats = sprintStats(board);
  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/board");
      const data = (await response.json()) as {
        board: Board | null;
        revision: number;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error);
      if (data.board) setBoard(data.board);
      setRevision(data.revision);
      setLoaded(true);
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Your workspace could not be loaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (signedIn) {
      let cancelled = false;
      fetch("/api/board")
        .then(async (response) => {
          const data = (await response.json()) as {
            board: Board | null;
            revision: number;
            error?: string;
          };
          if (!response.ok) throw new Error(data.error);
          if (!cancelled) {
            if (data.board) setBoard(data.board);
            setRevision(data.revision);
            setLoaded(true);
          }
        })
        .catch((error) => {
          if (!cancelled) setNotice(error.message);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [signedIn]);
  async function act(action: Action): Promise<boolean> {
    if (busy || !loaded) return false;
    setBusy(true);
    try {
      if (signedIn) {
        const response = await fetch("/api/board", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, revision }),
        });
        const data = (await response.json()) as {
          board: Board | null;
          revision: number;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error);
        if (data.board) setBoard(data.board);
        setRevision(data.revision);
      } else setBoard(applyAction(board, action));
      setNotice(
        signedIn
          ? "Saved to your private workspace."
          : "Demo updated in this tab. Sign in for a saved workspace.",
      );
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "This action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const visible = board.issues.filter(
    (issue) =>
      (showArchived || !issue.archived) &&
      (assignee === "all" || issue.assignee === assignee) &&
      `${board.key}-${issue.number} ${issue.title} ${issue.labels.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const currentIssues = visible.filter(
    (issue) => issue.sprintId === sprint?.id && !!sprint,
  );
  const backlog = visible.filter((issue) => issue.sprintId === null);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportCsv(board)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.key.toLowerCase()}-issues.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const issue = editing
    ? board.issues.find((i) => i.id === editing)
    : undefined;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Zap size={22} fill="currentColor" />
          </span>
          SprintForge<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <div className="project-switch">
          <span className="project-avatar">{board.key}</span>
          <div>
            <strong>{board.name}</strong>
            <small>Software project</small>
          </div>
          <ChevronRight size={15} />
        </div>
        <nav aria-label="Project navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "backlog" && (
                <b>
                  {
                    board.issues.filter(
                      (i) => i.sprintId === null && !i.archived,
                    ).length
                  }
                </b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-eyebrow">A LITTLE LESS CHAOS</span>
          <h3>
            Big ideas.
            <br />
            Steady progress.
          </h3>
          <p>Make space for your team’s next great thing.</p>
          <div className="note-decoration">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <button className="nav-item help" onClick={() => setHelp(true)}>
          <BookOpen size={18} />
          How SprintForge works
        </button>
        <a
          className="made-by"
          href="https://github.com/sammymuya167-hash/sammymuya167-hash/tree/main/projects/sprintforge"
          target="_blank"
          rel="noreferrer"
        >
          SHADOWNET <ArrowUpRight size={14} />
        </a>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            Projects
            <ChevronRight size={14} />
            <span>{board.name}</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="sync-status">
              <span />
              {busy
                ? "Saving…"
                : signedIn
                  ? loaded
                    ? "Private workspace"
                    : "Loading…"
                  : "Interactive demo"}
            </span>
            {signedIn ? (
              <button
                className="icon-button"
                aria-label="Reload saved workspace"
                disabled={busy}
                onClick={load}
              >
                <RotateCw size={16} />
              </button>
            ) : (
              <a className="signin" href={signInPath}>
                Sign in to save
                <ArrowUpRight size={14} />
              </a>
            )}
            <span className="user-avatar">YO</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-title">
            <div>
              <p className="eyebrow">LET’S MAKE IT HAPPEN</p>
              <h1>
                {view === "board"
                  ? "Build with momentum"
                  : view === "backlog"
                    ? "Great work starts here"
                    : view === "insights"
                      ? "See the bigger picture"
                      : view === "activity"
                        ? "Every step, accounted for"
                        : "Make it your project"}
              </h1>
              <p className="subtitle">
                {view === "board"
                  ? "A clear view of what matters. A little closer to done."
                  : view === "backlog"
                    ? "Shape the next sprint, one good idea at a time."
                    : view === "insights"
                      ? "Understand progress, scope, and where work gets stuck."
                      : view === "activity"
                        ? "A history of changes in your workspace."
                        : "A name, a key, and a shared direction."}
              </p>
            </div>
            <button
              className="primary-button"
              disabled={busy || !loaded}
              onClick={() => setEditing("new")}
            >
              <Plus size={17} />
              Create issue
            </button>
          </div>
          {notice && (
            <div role="status" className="notice">
              <span>{notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {(view === "board" || view === "insights") && (
            <section className="sprint-summary">
              <div className="sprint-heading">
                <div className="sprint-symbol">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="sprint-name">
                    {sprint?.name ?? "Your next sprint"}
                    <span className={sprint ? "pill active-pill" : "pill"}>
                      {sprint ? "ACTIVE SPRINT" : "READY WHEN YOU ARE"}
                    </span>
                  </div>
                  <p>
                    {sprint?.goal ??
                      "Choose issues from the backlog to start a new sprint."}
                  </p>
                </div>
                <div className="sprint-dates">
                  <CalendarDays size={15} />
                  {sprint
                    ? `${formatDate(sprint.startDate)} – ${formatDate(sprint.endDate)}`
                    : "No active sprint"}
                </div>
                <button
                  className="secondary-button"
                  disabled={busy || !loaded}
                  onClick={() =>
                    sprint
                      ? setCompleting(true)
                      : (setView("backlog"), setStarting(true))
                  }
                >
                  {sprint ? "Complete sprint" : "Start sprint"}
                  <CheckCheck size={15} />
                </button>
              </div>
              <div className="sprint-metrics">
                <div>
                  <span>Sprint progress</span>
                  <strong>
                    {stats.done}
                    <small> / {stats.total} points</small>
                  </strong>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <span>In progress</span>
                  <strong>
                    {stats.items.filter((i) => i.status === "doing").length}
                    <small> issues</small>
                  </strong>
                </div>
                <div>
                  <span>Ready for review</span>
                  <strong>
                    {stats.items.filter((i) => i.status === "review").length}
                    <small> issues</small>
                  </strong>
                </div>
                <div>
                  <span>Blocked</span>
                  <strong>
                    {stats.blocked}
                    <small> dependencies to resolve</small>
                  </strong>
                </div>
              </div>
            </section>
          )}
          {(view === "board" || view === "backlog") && (
            <>
              <div className="board-toolbar">
                <div className="view-tabs">
                  <button
                    className={view === "board" ? "selected" : ""}
                    onClick={() => setView("board")}
                  >
                    <LayoutDashboard size={15} />
                    Board
                  </button>
                  <button
                    className={view === "backlog" ? "selected" : ""}
                    onClick={() => setView("backlog")}
                  >
                    <ListTodo size={15} />
                    Backlog
                  </button>
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search issues"
                    placeholder="Search issues…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter by assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="all">All assignees</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="unassigned">Unassigned</option>
                </select>
                <div className="toolbar-avatars" aria-label="Sample assignees">
                  {people.slice(1).map((p) => (
                    <span
                      key={p.id}
                      style={{ background: p.color }}
                      title={`${p.name} · sample assignee`}
                    >
                      {p.initials}
                    </span>
                  ))}
                </div>
                <button
                  className="icon-button"
                  onClick={download}
                  aria-label="Export all project issues as CSV"
                >
                  <Download size={17} />
                </button>
              </div>
              {view === "board" ? (
                <div className="kanban">
                  {(["ready", "doing", "review", "done"] as Status[]).map(
                    (status) => (
                      <section
                        key={status}
                        className={`kanban-column column-${status}`}
                        aria-label={`${statusNames[status]} issues`}
                        onDragOver={(e) => {
                          if (!busy) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          if (id && !busy)
                            void act({ type: "issue.move", id, status });
                        }}
                      >
                        <div className="column-heading">
                          <span className="column-dot" />
                          <h2>{statusNames[status]}</h2>
                          <span className="column-count">
                            {
                              currentIssues.filter((i) => i.status === status)
                                .length
                            }
                          </span>
                          <button
                            className="icon-button"
                            aria-label="Create a new issue"
                            onClick={() => setEditing("new")}
                            disabled={busy || !loaded}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        <div className="column-cards">
                          {currentIssues
                            .filter((i) => i.status === status)
                            .map((i) => (
                              <IssueCard
                                key={i.id}
                                issue={i}
                                board={board}
                                busy={busy || !loaded}
                                onOpen={() => setEditing(i.id)}
                                onMove={(status) =>
                                  void act({
                                    type: "issue.move",
                                    id: i.id,
                                    status,
                                  })
                                }
                              />
                            ))}
                          {!currentIssues.some((i) => i.status === status) && (
                            <div className="column-empty">
                              <Circle size={23} />
                              <p>
                                {search
                                  ? "No matching issues"
                                  : "Room for what’s next"}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    ),
                  )}
                </div>
              ) : (
                <section className="backlog-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Product backlog <span>{backlog.length}</span>
                      </h2>
                      <p>Select open issues to shape the next sprint.</p>
                    </div>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                      />
                      Show archived
                    </label>
                    <button
                      className="secondary-button"
                      disabled={!!sprint || busy || !loaded}
                      onClick={() => setStarting(true)}
                    >
                      Start sprint
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {sprint && (
                    <p className="inline-hint">
                      Complete {sprint.name} before starting the next sprint.
                    </p>
                  )}
                  <div className="backlog-list">
                    {backlog.map((i) => (
                      <div
                        key={i.id}
                        className={`backlog-row ${i.archived ? "archived" : ""}`}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${board.key}-${i.number}`}
                          checked={selected.includes(i.id)}
                          disabled={i.archived || i.status === "done"}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, i.id]
                                : ids.filter((id) => id !== i.id),
                            )
                          }
                        />
                        <KindIcon kind={i.kind} />
                        <button onClick={() => setEditing(i.id)}>
                          <span className="issue-key">
                            {board.key}-{i.number}
                          </span>
                          <strong>{i.title}</strong>
                        </button>
                        <span
                          className={`priority-text priority-${i.priority}`}
                        >
                          {i.priority}
                        </span>
                        <span className="points">{i.points}</span>
                        <Avatar assignee={i.assignee} />
                        {i.archived && <span className="pill">Archived</span>}
                      </div>
                    ))}
                    {!backlog.length && (
                      <div className="empty-panel">
                        No matching backlog issues. Create one to get started.
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {view === "insights" && <Insights board={board} />}
          {view === "activity" && (
            <section className="activity-panel">
              <div className="panel-heading">
                <h2>Workspace activity</h2>
                <span className="pill">{board.activity.length} events</span>
              </div>
              {board.activity.map((event) => (
                <div className="activity-row" key={event.id}>
                  <span className="event-dot">
                    <Activity size={15} />
                  </span>
                  <div>
                    {event.issueId ? (
                      <button onClick={() => setEditing(event.issueId!)}>
                        {event.message}
                      </button>
                    ) : (
                      <p>{event.message}</p>
                    )}
                    <small>
                      {new Date(event.at).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                </div>
              ))}
            </section>
          )}
          {view === "settings" && (
            <ProjectSettings board={board} busy={busy || !loaded} save={act} />
          )}
          <footer className="page-footer">
            <span>
              <LockKeyhole size={13} />
              {signedIn
                ? "Your saved project belongs to your account."
                : "Synthetic demo data · Changes stay in this tab until sign-in."}
            </span>
            <span>Built for the work ahead.</span>
          </footer>
        </div>
      </main>
      {editing && (
        <IssueEditor
          key={editing}
          board={board}
          issue={issue}
          busy={busy}
          onClose={() => setEditing(null)}
          act={act}
        />
      )}
      {starting && (
        <SprintEditor
          board={board}
          selected={selected}
          busy={busy}
          onClose={() => setStarting(false)}
          onSave={async (action) => {
            const ok = await act(action);
            if (ok) {
              setStarting(false);
              setSelected([]);
              setView("board");
            }
            return ok;
          }}
        />
      )}
      {completing && (
        <Modal
          title={`Complete ${sprint?.name}?`}
          onClose={() => setCompleting(false)}
        >
          <p className="modal-copy">
            {stats.done} of {stats.total} points are done. Unfinished issues
            will return to the backlog, and this sprint’s progress will remain
            in Insights.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setCompleting(false)}
            >
              Keep working
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: "sprint.complete" })) {
                  setCompleting(false);
                  setView("backlog");
                }
              }}
            >
              Complete sprint
              <CheckCheck size={16} />
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="A little structure. A lot of momentum."
          onClose={() => setHelp(false)}
        >
          <div className="help-copy">
            <p>
              Create issues, add estimates, assign work, and link dependencies.
              Drag cards between columns or use each card’s status menu for
              keyboard access.
            </p>
            <p>
              Blocked issues cannot move into progress until their dependencies
              are done. Start sprints from the backlog; completing a sprint
              returns unfinished work to it.
            </p>
            <p>
              Guests can explore a synthetic project. Sign in to get a private
              D1 workspace with autosave, activity, and sprint history.
              Assignees are planning labels; this version does not send
              invitations or offer multi-user collaboration.
            </p>
            <p>
              Insights records remaining points after each saved change. CSV
              exports include every unarchived issue.
            </p>
            <a
              href="https://github.com/sammymuya167-hash/sammymuya167-hash/tree/main/projects/sprintforge"
              target="_blank"
              rel="noreferrer"
            >
              Read the source and architecture
              <ArrowUpRight size={14} />
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
function formatDate(value: string) {
  return new Date(value + "T00:00:00Z").toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function Avatar({ assignee }: { assignee: Issue["assignee"] }) {
  const person = people.find((p) => p.id === assignee);
  return (
    <span
      className="assignee-avatar"
      title={person?.name ?? "Unassigned"}
      style={{ background: person?.color ?? "#e9eceb" }}
    >
      {person?.initials ?? "–"}
    </span>
  );
}
export function KindIcon({ kind }: { kind: Issue["kind"] }) {
  const Icon = kind === "bug" ? Bug : kind === "story" ? Flag : CheckSquare2;
  return (
    <span className={`kind-icon kind-${kind}`} title={kind}>
      <Icon size={12} />
    </span>
  );
}
function IssueCard({
  issue,
  board,
  busy,
  onOpen,
  onMove,
}: {
  issue: Issue;
  board: Board;
  busy: boolean;
  onOpen: () => void;
  onMove: (status: Status) => void;
}) {
  const blocked = blockers(board, issue).length;
  return (
    <article
      className="issue-card"
      draggable={!busy}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", issue.id)}
    >
      <div className="card-top">
        <span className="issue-key">
          {board.key}-{issue.number}
        </span>
        <span
          className={`priority-indicator priority-${issue.priority}`}
          title={`${issue.priority} priority`}
        >
          <ArrowUpRight size={14} />
        </span>
      </div>
      <button className="issue-title" onClick={onOpen}>
        {issue.title}
      </button>
      <div className="issue-tags">
        {issue.labels.slice(0, 2).map((label) => (
          <span key={label}>{label}</span>
        ))}
        {!!blocked && <span className="blocked-tag">Blocked · {blocked}</span>}
      </div>
      <div className="card-bottom">
        <KindIcon kind={issue.kind} />
        <select
          aria-label={`Status for ${board.key}-${issue.number}`}
          disabled={busy}
          value={issue.status}
          onChange={(e) => onMove(e.target.value as Status)}
        >
          {Object.entries(statusNames).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <span className="points">{issue.points}</span>
        <Avatar assignee={issue.assignee} />
      </div>
    </article>
  );
}
function ProjectSettings({
  board,
  busy,
  save,
}: {
  board: Board;
  busy: boolean;
  save: (action: Action) => Promise<boolean>;
}) {
  const [name, setName] = useState(board.name),
    [key, setKey] = useState(board.key),
    [description, setDescription] = useState(board.description);
  return (
    <section className="settings-panel">
      <h2>Project details</h2>
      <p>The basics that make this space yours.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save({ type: "project.update", name, key, description });
        }}
      >
        <label>
          Project name
          <input
            required
            minLength={3}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Issue key
          <input
            required
            pattern="[A-Z]{2,6}"
            maxLength={6}
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
          />
          <small>2–6 uppercase letters, used before issue numbers.</small>
        </label>
        <label>
          Description
          <textarea
            maxLength={400}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="primary-button" disabled={busy} type="submit">
          Save project
          <CheckCheck size={16} />
        </button>
      </form>
    </section>
  );
}
