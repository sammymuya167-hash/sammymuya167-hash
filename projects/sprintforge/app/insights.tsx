import {
  activeSprint,
  sprintStats,
  statusNames,
  type Board,
} from "../lib/board";
export default function Insights({ board }: { board: Board }) {
  const sprint = activeSprint(board) ?? board.sprints[board.sprints.length - 1];
  const stats = sprintStats(board, sprint);
  const start = sprint ? Date.parse(sprint.startDate + "T00:00:00Z") : 0,
    end = sprint ? Date.parse(sprint.endDate + "T23:59:59Z") : start + 86400000;
  const maximum = Math.max(
    sprint?.baseline ?? 1,
    stats.total,
    ...(sprint?.history.map((h) => h.remaining) ?? [1]),
    1,
  );
  const x = (at: number) =>
      54 + Math.min(1, Math.max(0, (at - start) / (end - start))) * 576,
    y = (points: number) => 204 - (points / maximum) * 160;
  const points =
    sprint?.history.map((h) => `${x(h.at)},${y(h.remaining)}`).join(" ") ?? "";
  return (
    <div className="insights-grid">
      <section className="chart-panel">
        <div className="panel-heading">
          <div>
            <h2>Sprint burndown</h2>
            <p>
              {sprint?.name ?? "No sprint yet"} · Remaining story points over
              time
            </p>
          </div>
          <span className="pill">{stats.remaining} points left</span>
        </div>
        <svg
          viewBox="0 0 660 250"
          role="img"
          aria-label="Burndown chart comparing recorded remaining points to the ideal sprint trajectory"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <path
                d={`M54 ${y(maximum * t)}H630`}
                stroke="#e5eae7"
                fill="none"
              />
              <text
                x="37"
                y={y(maximum * t) + 4}
                textAnchor="end"
                fill="#829089"
                fontSize="11"
              >
                {Math.round(maximum * t)}
              </text>
            </g>
          ))}
          <path
            d={`M54 ${y(sprint?.baseline ?? 0)}L630 204`}
            stroke="#b5c4bc"
            strokeDasharray="5 5"
            fill="none"
          />
          <polyline
            points={points}
            stroke="#118565"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
          {sprint?.history.slice(-1).map((h) => (
            <circle
              key={h.at}
              cx={x(h.at)}
              cy={y(h.remaining)}
              r="5"
              fill="#118565"
              stroke="white"
              strokeWidth="2"
            />
          ))}
          <text x="54" y="231" fill="#829089" fontSize="11">
            {sprint?.startDate}
          </text>
          <text x="630" y="231" textAnchor="end" fill="#829089" fontSize="11">
            {sprint?.endDate}
          </text>
        </svg>
        <div className="chart-legend">
          <span>
            <i />
            Actual remaining
          </span>
          <span>
            <i className="ideal" />
            Ideal progress
          </span>
        </div>
        <p className="chart-footnote">
          Points are recorded after workspace changes. The initial preview uses
          synthetic history.
        </p>
      </section>
      <section className="distribution-panel">
        <div className="panel-heading">
          <div>
            <h2>Where work stands</h2>
            <p>Current sprint · {stats.items.length} issues</p>
          </div>
        </div>
        {(["ready", "doing", "review", "done"] as const).map((status) => {
          const count = stats.items.filter((i) => i.status === status).length;
          return (
            <div className={`distribution-row column-${status}`} key={status}>
              <span>
                <i className="column-dot" />
                {statusNames[status]}
              </span>
              <b>{count}</b>
              <div className="distribution-track">
                <i
                  style={{
                    width: `${stats.items.length ? (count / stats.items.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="insight-callout">
          <strong>
            {stats.blocked
              ? `${stats.blocked} issues need a hand.`
              : "Clear paths ahead."}
          </strong>
          <p>
            {stats.blocked
              ? "Complete linked dependencies to unlock blocked work."
              : "There are no unresolved dependencies in this sprint."}
          </p>
        </div>
      </section>
      <section className="sprint-history-panel">
        <div className="panel-heading">
          <div>
            <h2>Sprint history</h2>
            <p>A record of work delivered and carried forward.</p>
          </div>
        </div>
        {[...board.sprints].reverse().map((s) => {
          const completed =
            s.state === "closed"
              ? (s.completedPoints ?? 0)
              : sprintStats(board, s).done;
          return (
            <div className="history-row" key={s.id}>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.startDate} — {s.endDate}
                </small>
              </div>
              <p>{s.goal || "No goal set"}</p>
              <span
                className={`pill ${s.state === "active" ? "active-pill" : ""}`}
              >
                {s.state}
              </span>
              <b>
                {completed}
                <small>
                  {" "}
                  /{" "}
                  {s.state === "closed"
                    ? s.completedTotal
                    : sprintStats(board, s).total}{" "}
                  pts
                </small>
              </b>
            </div>
          );
        })}
      </section>
    </div>
  );
}
