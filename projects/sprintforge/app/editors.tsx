"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Plus, MessageSquare, Archive, CheckCheck } from "lucide-react";
import {
  activeSprint,
  blockers,
  issueFieldsSchema,
  people,
  statusNames,
  type Action,
  type Board,
  type Issue,
  type IssueFields,
  type Status,
} from "../lib/board";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>(
      "input, button, select, textarea",
    );
    first?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        ref={ref}
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide-modal" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const focusable = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
              ) ?? [],
            );
            const first = focusable[0],
              last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function IssueEditor({
  board,
  issue,
  busy,
  onClose,
  act,
}: {
  board: Board;
  issue?: Issue;
  busy: boolean;
  onClose: () => void;
  act: (action: Action) => Promise<boolean>;
}) {
  const sprint = activeSprint(board);
  const [fields, setFields] = useState<IssueFields>(
    issue
      ? {
          title: issue.title,
          description: issue.description,
          kind: issue.kind,
          priority: issue.priority,
          points: issue.points,
          assignee: issue.assignee,
          labels: [...issue.labels],
          dependsOn: [...issue.dependsOn],
          sprintId: issue.sprintId,
        }
      : {
          title: "",
          description: "",
          kind: "story",
          priority: "medium",
          points: 3,
          assignee: "unassigned",
          labels: [],
          dependsOn: [],
          sprintId: sprint?.id ?? null,
        },
  );
  const [labels, setLabels] = useState(fields.labels.join(", ")),
    [comment, setComment] = useState(""),
    [error, setError] = useState("");
  const patch = (values: Partial<IssueFields>) =>
    setFields((previous) => ({ ...previous, ...values }));
  async function save() {
    const parsed = issueFieldsSchema.safeParse({
      ...fields,
      labels: [
        ...new Set(
          labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
        ),
      ],
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (
      await act(
        issue
          ? { type: "issue.update", id: issue.id, fields: parsed.data }
          : { type: "issue.create", fields: parsed.data },
      )
    )
      onClose();
    else
      setError(
        "This issue could not be saved. Close the dialog to see the workspace message.",
      );
  }
  return (
    <Modal
      title={
        issue
          ? `${board.key}-${issue.number} · ${issue.archived ? "Archived issue" : "Issue details"}`
          : "Create a new issue"
      }
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="issue-editor-grid">
          <div className="issue-editor-main">
            <label>
              Title
              <input
                autoComplete="off"
                required
                minLength={3}
                maxLength={160}
                placeholder="What needs to happen?"
                value={fields.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows={7}
                maxLength={6000}
                placeholder="Give the work a little context. What does done look like?"
                value={fields.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              Labels
              <input
                placeholder="frontend, accessibility"
                maxLength={150}
                value={labels}
                onChange={(e) => setLabels(e.target.value)}
              />
              <small>Up to 6 labels, separated by commas.</small>
            </label>
            <label>
              Depends on
              <select
                multiple
                value={fields.dependsOn}
                onChange={(e) =>
                  patch({
                    dependsOn: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value,
                    ),
                  })
                }
              >
                {board.issues
                  .filter((i) => i.id !== issue?.id && !i.archived)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {board.key}-{i.number} · {i.title}
                    </option>
                  ))}
              </select>
              <small>
                Use Ctrl/Cmd to select links. Dependencies must be done before
                work can start.
              </small>
            </label>
            {issue && !!blockers(board, issue).length && (
              <p className="inline-hint">
                Blocked by{" "}
                {blockers(board, issue)
                  .map((i) => `${board.key}-${i.number}`)
                  .join(", ")}
                .
              </p>
            )}
          </div>
          <div className="issue-editor-side">
            <label>
              Type
              <select
                value={fields.kind}
                onChange={(e) =>
                  patch({ kind: e.target.value as Issue["kind"] })
                }
              >
                <option value="story">Story</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={fields.priority}
                onChange={(e) =>
                  patch({ priority: e.target.value as Issue["priority"] })
                }
              >
                {["urgent", "high", "medium", "low"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Assignee
              <select
                value={fields.assignee}
                onChange={(e) =>
                  patch({ assignee: e.target.value as Issue["assignee"] })
                }
              >
                <option value="unassigned">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Story points
              <input
                type="number"
                min={0}
                max={21}
                required
                value={fields.points}
                onChange={(e) => patch({ points: Number(e.target.value) })}
              />
            </label>
            <label>
              Sprint
              <select
                value={fields.sprintId ?? ""}
                onChange={(e) => patch({ sprintId: e.target.value || null })}
              >
                <option value="">Backlog</option>
                {sprint && <option value={sprint.id}>{sprint.name}</option>}
                {issue?.sprintId && issue.sprintId !== sprint?.id && (
                  <option value={issue.sprintId}>
                    {board.sprints.find((s) => s.id === issue.sprintId)?.name} ·
                    closed
                  </option>
                )}
              </select>
            </label>
            {issue && (
              <>
                <label>
                  Status
                  <select
                    disabled={busy || issue.archived}
                    value={issue.status}
                    onChange={async (e) => {
                      if (
                        await act({
                          type: "issue.move",
                          id: issue.id,
                          status: e.target.value as Status,
                        })
                      )
                        onClose();
                    }}
                  >
                    {Object.entries(statusNames).map(([s, name]) => (
                      <option key={s} value={s}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="text-button archive-action"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act({
                        type: "issue.archive",
                        id: issue.id,
                        archived: !issue.archived,
                      })
                    )
                      onClose();
                  }}
                >
                  <Archive size={15} />
                  {issue.archived ? "Restore issue" : "Archive issue"}
                </button>
              </>
            )}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {issue ? "Save changes" : "Create issue"}
            <CheckCheck size={16} />
          </button>
        </div>
      </form>
      {issue && (
        <section className="comments-section">
          <h3>
            <MessageSquare size={16} />
            Comments <span>{issue.comments.length}</span>
          </h3>
          {issue.comments.map((c) => (
            <div className="comment" key={c.id}>
              <strong>
                You <small>{new Date(c.at).toLocaleString("en-GB")}</small>
              </strong>
              <p>{c.body}</p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act({
                  type: "issue.comment",
                  id: issue.id,
                  body: comment,
                })
              )
                setComment("");
            }}
          >
            <textarea
              required
              maxLength={2000}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add context or a progress update…"
              aria-label="Comment"
            />
            <button
              className="secondary-button"
              disabled={busy || !comment.trim()}
              type="submit"
            >
              Add comment
              <Plus size={14} />
            </button>
          </form>
        </section>
      )}
    </Modal>
  );
}
export function SprintEditor({
  board,
  selected,
  busy,
  onClose,
  onSave,
}: {
  board: Board;
  selected: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (action: Action) => Promise<boolean>;
}) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10)),
    [later] = useState(() =>
      new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10),
    );
  const [name, setName] = useState(
      `Sprint ${String(board.sprints.length + 7).padStart(2, "0")}`,
    ),
    [goal, setGoal] = useState(""),
    [startDate, setStartDate] = useState(today),
    [endDate, setEndDate] = useState(later),
    [ids, setIds] = useState(selected),
    [error, setError] = useState("");
  const backlog = board.issues.filter(
    (i) => !i.archived && !i.sprintId && i.status !== "done",
  );
  return (
    <Modal title="Shape your next sprint" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ids.length) {
            setError("Choose at least one issue.");
            return;
          }
          if (activeSprint(board)) {
            setError("Complete the active sprint first.");
            return;
          }
          if (
            !(await onSave({
              type: "sprint.start",
              name,
              goal,
              startDate,
              endDate,
              issueIds: ids,
            }))
          )
            setError(
              "The sprint could not start. Check the workspace message.",
            );
        }}
      >
        <label>
          Sprint name
          <input
            minLength={3}
            maxLength={80}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Goal
          <input
            maxLength={400}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="What will this sprint make possible?"
          />
        </label>
        <div className="form-two">
          <label>
            Start
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End
            <input
              type="date"
              required
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>
        <div className="sprint-selection">
          {backlog.map((i) => (
            <label className="checkbox-label" key={i.id}>
              <input
                type="checkbox"
                checked={ids.includes(i.id)}
                onChange={(e) =>
                  setIds((previous) =>
                    e.target.checked
                      ? [...previous, i.id]
                      : previous.filter((id) => id !== i.id),
                  )
                }
              />
              <span>
                {board.key}-{i.number} · {i.title}
              </span>
              <b>{i.points}</b>
            </label>
          ))}
        </div>
        <p className="inline-hint">
          {ids.length} issues ·{" "}
          {backlog
            .filter((i) => ids.includes(i.id))
            .reduce((a, i) => a + i.points, 0)}{" "}
          points selected
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            Start sprint
            <CheckCheck size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
