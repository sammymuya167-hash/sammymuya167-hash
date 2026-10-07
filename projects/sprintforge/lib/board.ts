import { z } from "zod";

export const statuses = [
  "backlog",
  "ready",
  "doing",
  "review",
  "done",
] as const;
export type Status = (typeof statuses)[number];
export const statusNames: Record<Status, string> = {
  backlog: "Backlog",
  ready: "To do",
  doing: "In progress",
  review: "In review",
  done: "Done",
};
export const people = [
  { id: "you", name: "You", initials: "YO", color: "#dbc7f1" },
  { id: "alex", name: "Alex", initials: "AL", color: "#f8d5b0" },
  { id: "sam", name: "Sam", initials: "SA", color: "#b5dfd4" },
  { id: "jo", name: "Jo", initials: "JO", color: "#c1d5f0" },
] as const;
const idSchema = z.string().min(1).max(80);
export const issueFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the issue a title of at least 3 characters.")
    .max(160),
  description: z.string().max(6000),
  kind: z.enum(["story", "task", "bug"]),
  priority: z.enum(["urgent", "high", "medium", "low"]),
  points: z.number().int().min(0).max(21),
  assignee: z.enum(["you", "alex", "sam", "jo", "unassigned"]),
  labels: z.array(z.string().trim().min(1).max(24)).max(6),
  dependsOn: z.array(idSchema).max(12),
  sprintId: idSchema.nullable(),
});
export type IssueFields = z.infer<typeof issueFieldsSchema>;
export type Issue = IssueFields & {
  id: string;
  number: number;
  status: Status;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  comments: { id: string; body: string; at: number }[];
};
export type Sprint = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  state: "active" | "closed";
  baseline: number;
  completedPoints?: number;
  completedTotal?: number;
  history: { at: number; remaining: number }[];
};
export type Board = {
  name: string;
  key: string;
  description: string;
  nextNumber: number;
  issues: Issue[];
  sprints: Sprint[];
  activity: { id: string; message: string; at: number; issueId?: string }[];
};
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v + "T00:00:00Z")),
    "Choose a valid date.",
  );
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("issue.create"), fields: issueFieldsSchema }),
  z.object({
    type: z.literal("issue.update"),
    id: idSchema,
    fields: issueFieldsSchema,
  }),
  z.object({
    type: z.literal("issue.move"),
    id: idSchema,
    status: z.enum(statuses),
  }),
  z.object({
    type: z.literal("issue.archive"),
    id: idSchema,
    archived: z.boolean(),
  }),
  z.object({
    type: z.literal("issue.comment"),
    id: idSchema,
    body: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal("sprint.start"),
    name: z.string().trim().min(3).max(80),
    goal: z.string().max(400),
    startDate: dateSchema,
    endDate: dateSchema,
    issueIds: z.array(idSchema).min(1).max(150),
  }),
  z.object({ type: z.literal("sprint.complete") }),
  z.object({
    type: z.literal("project.update"),
    name: z.string().trim().min(3).max(80),
    key: z.string().regex(/^[A-Z]{2,6}$/),
    description: z.string().max(400),
  }),
]);
export type Action = z.infer<typeof actionSchema>;
export class BoardError extends Error {}
export function activeSprint(board: Board) {
  return board.sprints.find((s) => s.state === "active");
}
export function blockers(board: Board, issue: Issue) {
  return board.issues.filter(
    (i) => issue.dependsOn.includes(i.id) && i.status !== "done",
  );
}
export function sprintStats(board: Board, sprint = activeSprint(board)) {
  const items = board.issues.filter(
    (i) => !i.archived && i.sprintId === sprint?.id,
  );
  const total = items.reduce((a, i) => a + i.points, 0);
  const done = items
    .filter((i) => i.status === "done")
    .reduce((a, i) => a + i.points, 0);
  return {
    items,
    total,
    done,
    remaining: total - done,
    blocked: items.filter((i) => blockers(board, i).length > 0).length,
  };
}
function validateGraph(board: Board) {
  const index = new Map(board.issues.map((i) => [i.id, i]));
  const visited = new Set<string>(),
    stack = new Set<string>();
  function visit(id: string) {
    if (stack.has(id))
      throw new BoardError(
        "These dependencies create a cycle. Remove one of the links.",
      );
    if (visited.has(id)) return;
    stack.add(id);
    const issue = index.get(id);
    if (!issue) throw new BoardError("A linked issue no longer exists.");
    for (const dependency of issue.dependsOn) visit(dependency);
    stack.delete(id);
    visited.add(id);
  }
  for (const issue of board.issues) {
    if (new Set(issue.dependsOn).size !== issue.dependsOn.length)
      throw new BoardError("Link each dependency only once.");
    visit(issue.id);
  }
}
export function applyAction(
  input: Board,
  action: Action,
  at = Date.now(),
): Board {
  const board = structuredClone(input);
  let message = "",
    issueId: string | undefined;
  const find = (id: string) => {
    const issue = board.issues.find((i) => i.id === id);
    if (!issue) throw new BoardError("Issue not found.");
    return issue;
  };
  const verifySprint = (id: string | null) => {
    if (id && !board.sprints.some((s) => s.id === id && s.state === "active"))
      throw new BoardError("Choose the active sprint or backlog.");
  };
  if (action.type === "issue.create") {
    if (board.issues.length >= 300)
      throw new BoardError("This project has reached its 300-issue limit.");
    verifySprint(action.fields.sprintId);
    const issue: Issue = {
      ...action.fields,
      id: crypto.randomUUID(),
      number: board.nextNumber++,
      status: action.fields.sprintId ? "ready" : "backlog",
      archived: false,
      createdAt: at,
      updatedAt: at,
      comments: [],
    };
    board.issues.push(issue);
    issueId = issue.id;
    message = `Created ${board.key}-${issue.number}: ${issue.title}`;
  } else if (action.type.startsWith("issue.")) {
    const a = action as Exclude<
      Action,
      {
        type:
          | "issue.create"
          | "sprint.start"
          | "sprint.complete"
          | "project.update";
      }
    >;
    const issue = find(a.id);
    issueId = issue.id;
    issue.updatedAt = at;
    if (a.type === "issue.update") {
      if (a.fields.sprintId !== issue.sprintId) verifySprint(a.fields.sprintId);
      Object.assign(issue, a.fields);
      if (!issue.sprintId && issue.status !== "done") issue.status = "backlog";
      else if (issue.sprintId && issue.status === "backlog")
        issue.status = "ready";
      if (
        ["doing", "review", "done"].includes(issue.status) &&
        blockers(board, issue).length
      )
        throw new BoardError(
          "Resolve the linked dependencies before working on this issue.",
        );
      message = `Updated ${board.key}-${issue.number}`;
    } else if (a.type === "issue.move") {
      if (issue.archived)
        throw new BoardError("Restore this issue before moving it.");
      if (
        ["doing", "review", "done"].includes(a.status) &&
        blockers(board, issue).length
      )
        throw new BoardError(
          "This issue is blocked. Complete its dependencies first.",
        );
      if (
        a.status !== "backlog" &&
        (!issue.sprintId ||
          !board.sprints.some(
            (s) => s.id === issue.sprintId && s.state === "active",
          ))
      ) {
        const sprint = activeSprint(board);
        if (!sprint)
          throw new BoardError(
            "Start a sprint before moving work onto the board.",
          );
        issue.sprintId = sprint.id;
      }
      if (a.status === "backlog") issue.sprintId = null;
      // Reopening a dependency must not leave its completed dependants in an invalid state.
      if (
        a.status !== "done" &&
        issue.status === "done" &&
        board.issues.some(
          (i) =>
            i.dependsOn.includes(issue.id) &&
            ["doing", "review", "done"].includes(i.status),
        )
      )
        throw new BoardError(
          "Move this issue's dependants back to To do before reopening it.",
        );
      issue.status = a.status;
      message = `Moved ${board.key}-${issue.number} to ${statusNames[a.status]}`;
    } else if (a.type === "issue.archive") {
      if (
        a.archived &&
        board.issues.some((i) => !i.archived && i.dependsOn.includes(issue.id))
      )
        throw new BoardError(
          "Remove links from dependent issues before archiving this issue.",
        );
      issue.archived = a.archived;
      message = `${a.archived ? "Archived" : "Restored"} ${board.key}-${issue.number}`;
    } else {
      if (issue.comments.length >= 80)
        throw new BoardError("This issue has reached its comment limit.");
      issue.comments.push({ id: crypto.randomUUID(), body: a.body, at });
      message = `Added a comment to ${board.key}-${issue.number}`;
    }
  } else if (action.type === "sprint.start") {
    if (activeSprint(board))
      throw new BoardError(
        "Complete the active sprint before starting another.",
      );
    if (action.endDate < action.startDate)
      throw new BoardError("The sprint end date must follow its start date.");
    if (
      (Date.parse(action.endDate) - Date.parse(action.startDate)) / 86400000 >
      42
    )
      throw new BoardError("Keep the sprint within 42 days.");
    if (new Set(action.issueIds).size !== action.issueIds.length)
      throw new BoardError("Select each issue only once.");
    const items = action.issueIds.map(find);
    if (items.some((i) => i.archived || i.status === "done" || i.sprintId))
      throw new BoardError("Select open backlog issues for the next sprint.");
    if (board.sprints.length >= 30)
      throw new BoardError("This project has reached its 30-sprint limit.");
    const id = crypto.randomUUID(),
      total = items.reduce((sum, i) => sum + i.points, 0);
    board.sprints.push({
      id,
      name: action.name,
      goal: action.goal,
      startDate: action.startDate,
      endDate: action.endDate,
      state: "active",
      baseline: total,
      history: [{ at, remaining: total }],
    });
    for (const issue of items) {
      issue.sprintId = id;
      issue.status = "ready";
      issue.updatedAt = at;
    }
    message = `Started ${action.name} with ${items.length} issues and ${total} points`;
  } else if (action.type === "sprint.complete") {
    const sprint = activeSprint(board);
    if (!sprint) throw new BoardError("There is no active sprint.");
    const stats = sprintStats(board, sprint);
    sprint.history.push({ at, remaining: stats.remaining });
    sprint.completedPoints = stats.done;
    sprint.completedTotal = stats.total;
    sprint.state = "closed";
    for (const issue of stats.items.filter((i) => i.status !== "done")) {
      issue.sprintId = null;
      issue.status = "backlog";
      issue.updatedAt = at;
    }
    message = `Completed ${sprint.name}: ${stats.done}/${stats.total} points delivered; unfinished work returned to backlog`;
  } else if (action.type === "project.update") {
    board.name = action.name;
    board.key = action.key;
    board.description = action.description;
    message = "Updated project details";
  }
  validateGraph(board);
  const sprint = activeSprint(board);
  if (sprint) {
    sprint.history.push({
      at,
      remaining: sprintStats(board, sprint).remaining,
    });
    sprint.history = sprint.history.slice(-400);
  }
  board.activity.unshift({
    id: crypto.randomUUID(),
    message,
    at,
    ...(issueId ? { issueId } : {}),
  });
  board.activity = board.activity.slice(0, 200);
  return board;
}
export function exportCsv(board: Board) {
  const cell = (value: unknown) =>
    `"${String(value ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""')}"`;
  return [
    [
      "Key",
      "Title",
      "Type",
      "Status",
      "Priority",
      "Points",
      "Assignee",
      "Sprint",
    ],
    ...board.issues
      .filter((i) => !i.archived)
      .map((i) => [
        `${board.key}-${i.number}`,
        i.title,
        i.kind,
        statusNames[i.status],
        i.priority,
        i.points,
        i.assignee,
        board.sprints.find((s) => s.id === i.sprintId)?.name ?? "Backlog",
      ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
