import test from "node:test";
import assert from "node:assert/strict";
import { connectionLine, deleteShape, moveShape, sanitizeBoard } from "../lib/canvas.ts";
import { demoBoard } from "../lib/demo.ts";

test("demo board is accepted and normalized", () => {
  const board = sanitizeBoard({ ...demoBoard, name: " <Flow> " });
  assert.equal(board.name, "Flow");
  assert.equal(board.shapes.length, 6);
});
test("connections resolve shape centres", () => {
  assert.deepEqual(connectionLine(demoBoard.connections[0], demoBoard.shapes), { x1: 191, y1: 163, x2: 478, y2: 127 });
});
test("moving a shape preserves the rest of the board", () => {
  const moved = moveShape(demoBoard, "cart", 10.2, -5.8);
  assert.equal(moved.shapes.find((shape) => shape.id === "cart")?.x, 394);
  assert.equal(moved.connections.length, demoBoard.connections.length);
});
test("deleting a shape removes dangling connections", () => {
  const next = deleteShape(demoBoard, "address");
  assert.equal(next.shapes.some((shape) => shape.id === "address"), false);
  assert.equal(next.connections.some((connection) => connection.from === "address" || connection.to === "address"), false);
});
test("invalid connection endpoints are rejected", () => {
  assert.throws(() => sanitizeBoard({ ...demoBoard, connections: [{ id: "bad", from: "missing", to: "cart", label: "bad" }] }), /Connections must join/);
});
