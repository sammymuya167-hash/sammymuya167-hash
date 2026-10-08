"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, Clock3, Cloud, CloudOff, Download, History, Link2, MessageCircle, MousePointer2, Plus, Redo2, Save, Sparkles, Square, StickyNote, Trash2, Type, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { colors, connectionLine, deleteShape, moveShape, sanitizeBoard, type Board, type CanvasShape } from "../lib/canvas";

type Tool = "select" | "rectangle" | "ellipse" | "note" | "text" | "comment" | "connect";
type Snapshot = { id: string; name: string; board: Board; createdAt: number };
const tools: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", icon: MousePointer2 }, { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle }, { id: "note", label: "Sticky note", icon: StickyNote },
  { id: "text", label: "Text", icon: Type }, { id: "connect", label: "Connect", icon: Link2 },
  { id: "comment", label: "Comment", icon: MessageCircle },
];

function downloadBoard(board: Board) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(board, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${board.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "canvasroom"}.json`; anchor.click(); URL.revokeObjectURL(url);
}

export default function Studio({ initialBoard, signedIn, signInPath }: { initialBoard: Board; signedIn: boolean; signInPath: string }) {
  const [board, setBoard] = useState(initialBoard), [revision, setRevision] = useState(0), [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loaded, setLoaded] = useState(!signedIn), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<Tool>("select"), [selectedId, setSelectedId] = useState<string | null>("address"), [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(.82), [panel, setPanel] = useState<"comments" | "history">("comments"), [notice, setNotice] = useState("");
  const [commentText, setCommentText] = useState(""), [snapshotName, setSnapshotName] = useState(""), [past, setPast] = useState<Board[]>([]), [future, setFuture] = useState<Board[]>([]);
  const drag = useRef<{ id: string; x: number; y: number; before: Board } | null>(null);
  const selected = board.shapes.find((shape) => shape.id === selectedId) ?? null;

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/board").then(async (response) => {
      const data = await response.json() as { board: Board | null; revision: number; snapshots: Snapshot[]; error?: string };
      if (!response.ok) throw new Error(data.error);
      if (!cancelled) { if (data.board) setBoard(data.board); setRevision(data.revision); setSnapshots(data.snapshots); setDirty(!data.board); setLoaded(true); }
    }).catch((error) => !cancelled && setNotice(error.message));
    return () => { cancelled = true; };
  }, [signedIn]);

  function commit(next: Board) { setPast((items) => [...items.slice(-29), board]); setFuture([]); setBoard(next); setDirty(true); }
  function undo() { const previous = past.at(-1); if (!previous) return; setFuture((items) => [board, ...items].slice(0, 30)); setPast((items) => items.slice(0, -1)); setBoard(previous); setDirty(true); }
  function redo() { const next = future[0]; if (!next) return; setPast((items) => [...items, board].slice(-30)); setFuture((items) => items.slice(1)); setBoard(next); setDirty(true); }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.matches("input,textarea")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if ((event.key === "Delete" || event.key === "Backspace") && selectedId) { event.preventDefault(); commit(deleteShape(board, selectedId)); setSelectedId(null); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  async function save(name?: string) {
    if (!signedIn || saving || !loaded) return;
    setSaving(true);
    try {
      const response = await fetch("/api/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ board: sanitizeBoard(board), revision, snapshotName: name }) });
      const data = await response.json() as { revision: number; snapshot: Snapshot | null; error?: string };
      if (!response.ok) throw new Error(data.error);
      setRevision(data.revision); if (data.snapshot) setSnapshots((items) => [data.snapshot!, ...items].slice(0, 20));
      setDirty(false); setSnapshotName(""); setNotice(name ? "Snapshot saved to your private history." : "Private board saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); } finally { setSaving(false); }
  }

  function addShape(kind: CanvasShape["kind"], x = 430, y = 190) {
    if (board.shapes.length >= 120) return setNotice("This board has reached its 120-shape limit.");
    const shape: CanvasShape = { id: crypto.randomUUID(), kind, x, y, width: kind === "text" ? 220 : 176, height: kind === "note" ? 126 : kind === "text" ? 48 : 88, label: kind === "note" ? "New idea" : kind === "text" ? "Add a heading" : "New step", fill: kind === "note" ? "#ffca5c" : "#f7f5ef" };
    commit({ ...board, shapes: [...board.shapes, shape] }); setSelectedId(shape.id); setTool("select");
  }

  function canvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if ((event.target as SVGElement).closest("[data-shape]")) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / zoom, y = (event.clientY - rect.top) / zoom;
    if (["rectangle", "ellipse", "note", "text"].includes(tool)) addShape(tool as CanvasShape["kind"], x - 80, y - 40);
    else if (tool === "comment") { const text = window.prompt("Leave a review comment"); if (text?.trim()) commit({ ...board, comments: [...board.comments, { id: crypto.randomUUID(), x, y, text: text.trim().slice(0, 600), author: "Reviewer", resolved: false, createdAt: Date.now() }] }); setTool("select"); }
    else { setSelectedId(null); setConnectFrom(null); }
  }

  function selectShape(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    if (tool === "connect") {
      if (!connectFrom) { setConnectFrom(id); setNotice("Choose a second shape to connect."); }
      else if (connectFrom !== id) { commit({ ...board, connections: [...board.connections, { id: crypto.randomUUID(), from: connectFrom, to: id, label: "flow" }] }); setConnectFrom(null); setTool("select"); setNotice("Connection created."); }
      return;
    }
    setSelectedId(id); if (tool === "select") drag.current = { id, x: event.clientX, y: event.clientY, before: board };
  }
  function pointerMove(event: React.MouseEvent<SVGSVGElement>) { if (!drag.current) return; const dx = (event.clientX - drag.current.x) / zoom, dy = (event.clientY - drag.current.y) / zoom; if (Math.abs(dx) + Math.abs(dy) < 1) return; setBoard((current) => moveShape(current, drag.current!.id, dx, dy)); setDirty(true); drag.current = { ...drag.current, x: event.clientX, y: event.clientY }; }
  function endDrag() { if (drag.current) { setPast((items) => [...items.slice(-29), drag.current!.before]); setFuture([]); } drag.current = null; }

  const openComments = useMemo(() => board.comments.filter((comment) => !comment.resolved).length, [board.comments]);
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><div><strong>CanvasRoom</strong><small>visual collaboration studio</small></div></div>
      <div className="board-title"><input aria-label="Board name" value={board.name} onChange={(event) => { setBoard({ ...board, name: event.target.value }); setDirty(true); }}/><span>{board.shapes.length} objects · {openComments} open comments</span></div>
      <div className="top-actions"><span className={`sync ${signedIn ? "online" : "local"}`}>{signedIn ? <Cloud size={14}/> : <CloudOff size={14}/>} {signedIn ? (dirty ? "Unsaved" : "Private") : "Demo mode"}</span><button className="icon-button" aria-label="Export board" onClick={() => downloadBoard(board)}><Download size={17}/></button>{signedIn ? <button className="save-button" disabled={!dirty || saving || !loaded} onClick={() => save()}><Save size={16}/>{saving ? "Saving…" : "Save board"}</button> : <Link className="save-button" href={signInPath} target="_top">Sign in to save</Link>}</div>
    </header>
    <section className="workspace">
      <aside className="layers-panel"><div className="panel-heading"><span>Layers</span><button onClick={() => addShape("rectangle")} aria-label="Add layer"><Plus size={15}/></button></div><div className="layers-list">{[...board.shapes].reverse().map((shape) => <button key={shape.id} className={selectedId === shape.id ? "active" : ""} onClick={() => setSelectedId(shape.id)}><span className={`layer-symbol ${shape.kind}`}>{shape.kind === "ellipse" ? "○" : shape.kind === "note" ? "◩" : shape.kind === "text" ? "T" : "□"}</span><span>{shape.label || "Untitled"}</span></button>)}</div><div className="outline-card"><Link2 size={17}/><div><strong>Flow health</strong><span>{board.connections.length} connections · no broken links</span></div><Check size={16}/></div></aside>
      <div className="canvas-wrap">
        <div className="tool-rail" aria-label="Canvas tools">{tools.map((item) => { const Icon = item.icon; return <button key={item.id} title={item.label} aria-label={item.label} className={tool === item.id ? "active" : ""} onClick={() => { setTool(item.id); setConnectFrom(null); }}><Icon size={18}/></button>; })}<span/><button title="Undo" onClick={undo} disabled={!past.length}><Undo2 size={18}/></button><button title="Redo" onClick={redo} disabled={!future.length}><Redo2 size={18}/></button></div>
        <div className="canvas-scroll"><svg className="canvas" viewBox={`0 0 ${1400 / zoom} ${820 / zoom}`} onClick={canvasClick} onMouseMove={pointerMove} onMouseUp={endDrag} onMouseLeave={endDrag}>
          <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#c8c4bb"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#79756d"/></marker><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".12"/></filter></defs><rect width="100%" height="100%" fill="url(#grid)"/>
          {board.connections.map((connection) => { const line = connectionLine(connection, board.shapes); if (!line) return null; return <g key={connection.id}><path d={`M ${line.x1} ${line.y1} C ${(line.x1 + line.x2) / 2} ${line.y1}, ${(line.x1 + line.x2) / 2} ${line.y2}, ${line.x2} ${line.y2}`} fill="none" stroke="#79756d" strokeWidth="2" markerEnd="url(#arrow)"/><text x={(line.x1 + line.x2) / 2} y={(line.y1 + line.y2) / 2 - 8} className="connection-label">{connection.label}</text></g>; })}
          {board.shapes.map((shape) => <g key={shape.id} data-shape="true" className={`shape ${selectedId === shape.id ? "selected" : ""} ${connectFrom === shape.id ? "connect-from" : ""}`} transform={`translate(${shape.x} ${shape.y})`} onMouseDown={(event) => selectShape(shape.id, event)}>{shape.kind === "ellipse" ? <ellipse cx={shape.width/2} cy={shape.height/2} rx={shape.width/2} ry={shape.height/2} fill={shape.fill}/> : <rect width={shape.width} height={shape.height} rx={shape.kind === "note" ? 4 : 18} fill={shape.fill}/>} {shape.kind === "note" && <path d={`M ${shape.width-24} 0 L ${shape.width} 24 L ${shape.width-24} 24 Z`} fill="#00000012"/>}<foreignObject x="14" y="12" width={shape.width-28} height={shape.height-24}><div className={`shape-label ${shape.kind}`}>{shape.label}</div></foreignObject></g>)}
          {board.comments.map((comment, index) => <g key={comment.id} transform={`translate(${comment.x} ${comment.y})`} className={comment.resolved ? "comment-pin resolved" : "comment-pin"} onClick={(event) => { event.stopPropagation(); setPanel("comments"); }}><circle r="16"/><text textAnchor="middle" y="5">{index+1}</text></g>)}
        </svg></div>
        <div className="zoom-control"><button onClick={() => setZoom(Math.max(.55, zoom - .1))}><ZoomOut size={16}/></button><span>{Math.round(zoom*100)}%</span><button onClick={() => setZoom(Math.min(1.35, zoom + .1))}><ZoomIn size={16}/></button></div><div className="canvas-status"><span className="avatars"><i>SM</i><i>PD</i><i>UX</i></span><span>3 demo collaborators</span><span className="pulse"/><span>Review ready</span></div>
      </div>
      <aside className="review-panel"><div className="panel-tabs"><button className={panel === "comments" ? "active" : ""} onClick={() => setPanel("comments")}>Comments <b>{openComments}</b></button><button className={panel === "history" ? "active" : ""} onClick={() => setPanel("history")}>History</button></div>
        {panel === "comments" ? <><div className="comment-compose"><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a board-level review note…"/><button disabled={!commentText.trim()} onClick={() => { commit({ ...board, comments: [...board.comments, { id: crypto.randomUUID(), x: 1110, y: 120 + board.comments.length*34, text: commentText.trim(), author: "You", resolved: false, createdAt: Date.now() }] }); setCommentText(""); }}>Post note <ArrowRight size={15}/></button></div><div className="comments">{board.comments.map((comment, index) => <article key={comment.id} className={comment.resolved ? "resolved" : ""}><div className="comment-meta"><span className="avatar">{comment.author.slice(0,2).toUpperCase()}</span><div><strong>{comment.author}</strong><small>Pin {index+1} · {new Date(comment.createdAt).toLocaleDateString()}</small></div></div><p>{comment.text}</p><button className="resolve" onClick={() => commit({ ...board, comments: board.comments.map((item) => item.id === comment.id ? { ...item, resolved: !item.resolved } : item) })}>{comment.resolved ? "Reopen" : <><Check size={14}/> Resolve</>}</button></article>)}</div></> : <div className="history-panel"><div className="snapshot-box"><label htmlFor="snapshot">Name this checkpoint</label><input id="snapshot" value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} placeholder="e.g. Review round 2"/><button disabled={!signedIn || !snapshotName.trim() || saving} onClick={() => save(snapshotName)}><History size={15}/> Save snapshot</button></div>{!signedIn && <p className="empty-copy">Sign in to keep account-private snapshots.</p>}{signedIn && !snapshots.length && <p className="empty-copy">Your named checkpoints will appear here.</p>}{snapshots.map((snapshot) => <button className="snapshot-row" key={snapshot.id} onClick={() => { commit(snapshot.board); setNotice(`Restored “${snapshot.name}”. Save to make it current.`); }}><Clock3 size={16}/><span><strong>{snapshot.name}</strong><small>{new Date(snapshot.createdAt).toLocaleString()}</small></span><ArrowRight size={15}/></button>)}</div>}
        {selected && <div className="inspector"><div className="panel-heading"><span>Inspector</span><button onClick={() => { commit(deleteShape(board, selected.id)); setSelectedId(null); }} aria-label="Delete selected"><Trash2 size={15}/></button></div><label>Label<textarea value={selected.label} onChange={(event) => { setBoard({ ...board, shapes: board.shapes.map((shape) => shape.id === selected.id ? { ...shape, label: event.target.value } : shape) }); setDirty(true); }}/></label><label>Fill<div className="swatches">{colors.map((color) => <button key={color} aria-label={`Set fill ${color}`} className={selected.fill === color ? "active" : ""} style={{ background: color }} onClick={() => commit({ ...board, shapes: board.shapes.map((shape) => shape.id === selected.id ? { ...shape, fill: color } : shape) })}/>)}</div></label><div className="position"><label>X<input type="number" value={selected.x} onChange={(event) => commit({ ...board, shapes: board.shapes.map((shape) => shape.id === selected.id ? { ...shape, x: Number(event.target.value) } : shape) })}/></label><label>Y<input type="number" value={selected.y} onChange={(event) => commit({ ...board, shapes: board.shapes.map((shape) => shape.id === selected.id ? { ...shape, y: Number(event.target.value) } : shape) })}/></label></div></div>}
      </aside>
    </section>{notice && <button className="toast" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
  </main>;
}
