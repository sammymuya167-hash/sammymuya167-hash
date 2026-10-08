import { z } from "zod";

export const colors = ["#ffca5c", "#ff7a59", "#7b8cff", "#55d6be", "#f7f5ef"] as const;
export const shapeKinds = ["rectangle", "ellipse", "note", "text"] as const;

export const shapeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(shapeKinds),
  x: z.number().finite().min(-5000).max(5000),
  y: z.number().finite().min(-5000).max(5000),
  width: z.number().finite().min(48).max(1800),
  height: z.number().finite().min(32).max(1200),
  label: z.string().max(280),
  fill: z.enum(colors),
});
export type CanvasShape = z.infer<typeof shapeSchema>;

export const connectionSchema = z.object({ id: z.string().min(1).max(80), from: z.string().min(1).max(80), to: z.string().min(1).max(80), label: z.string().max(80) });
export type Connection = z.infer<typeof connectionSchema>;
export const commentSchema = z.object({ id: z.string().min(1).max(80), x: z.number().finite().min(-5000).max(5000), y: z.number().finite().min(-5000).max(5000), text: z.string().trim().min(1).max(600), author: z.string().trim().min(1).max(60), resolved: z.boolean(), createdAt: z.number().int().nonnegative() });

export const boardSchema = z.object({ name: z.string().trim().min(1).max(80), shapes: z.array(shapeSchema).max(120), connections: z.array(connectionSchema).max(180), comments: z.array(commentSchema).max(120) }).superRefine((board, context) => {
  const ids = board.shapes.map((shape) => shape.id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Shape IDs must be unique." });
  const known = new Set(ids);
  for (const connection of board.connections) if (!known.has(connection.from) || !known.has(connection.to) || connection.from === connection.to) context.addIssue({ code: "custom", message: "Connections must join two existing shapes." });
});
export type Board = z.infer<typeof boardSchema>;

export function sanitizeBoard(input: Board): Board {
  const parsed = boardSchema.parse(input);
  const clean = (value: string) => value.replace(/[<>]/g, "").trim();
  return { name: clean(parsed.name) || "Untitled board", shapes: parsed.shapes.map((shape) => ({ ...shape, label: clean(shape.label) })), connections: parsed.connections.map((connection) => ({ ...connection, label: clean(connection.label) })), comments: parsed.comments.map((comment) => ({ ...comment, text: clean(comment.text), author: clean(comment.author) || "Reviewer" })) };
}

export function connectionLine(connection: Connection, shapes: CanvasShape[]) {
  const from = shapes.find((shape) => shape.id === connection.from), to = shapes.find((shape) => shape.id === connection.to);
  return from && to ? { x1: from.x + from.width / 2, y1: from.y + from.height / 2, x2: to.x + to.width / 2, y2: to.y + to.height / 2 } : null;
}
export function moveShape(board: Board, id: string, dx: number, dy: number): Board { return { ...board, shapes: board.shapes.map((shape) => shape.id === id ? { ...shape, x: Math.round(shape.x + dx), y: Math.round(shape.y + dy) } : shape) }; }
export function deleteShape(board: Board, id: string): Board { return { ...board, shapes: board.shapes.filter((shape) => shape.id !== id), connections: board.connections.filter((connection) => connection.from !== id && connection.to !== id) }; }
