"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequests, type RequestItem } from "@/hooks/useRequests";
import { cn } from "@/lib/utils";
import { Plus, ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Square, Bot, Layers, Maximize2, Search } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import type { WaterfallTask } from "@/types/waterfall";
import AutoImproveControl from "@/components/AutoImproveControl";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

const STATUS_DOT: Record<string, string> = {
  stopped: "bg-amber-500",
  pending: "bg-yellow-500",
  in_progress: "bg-blue-500",
  reviewing: "bg-orange-500",
  done: "bg-emerald-500",
  rejected: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  stopped: "Stopped",
  pending: "Pending",
  in_progress: "In Progress",
  reviewing: "Reviewing",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_ORDER = ["in_progress", "reviewing", "stopped", "pending", "done", "rejected"];

function RequestCard({ req, onUpdate, onDelete, onClick, onReorder, isFirst, isLast }: {
  req: RequestItem;
  onUpdate: (id: string, updates: Partial<Pick<RequestItem, "status" | "title" | "content" | "priority">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClick: () => void;
  onReorder?: (id: string, direction: "up" | "down") => Promise<void>;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(req.title);
  const [editContent, setEditContent] = useState(req.content);
  const [editPriority, setEditPriority] = useState(req.priority);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiResultLoading, setAiResultLoading] = useState(false);
  const [cardTab, setCardTab] = useState<"content" | "ai-result">("content");
  const isReadOnly = req.status === "done";

  useEffect(() => {
    if (expanded && aiResult === null && !aiResultLoading) {
      setAiResultLoading(true);
      fetch(`/api/tasks/${req.id}/result`).then((r) => r.json()).then((data) => setAiResult(data.result ?? "")).catch(() => setAiResult("")).finally(() => setAiResultLoading(false));
    }
  }, [expanded, aiResult, aiResultLoading, req.id]);

  return (
    <div className="board-card">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
        {req.status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[req.status])} />}
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="font-mono text-[11px] text-muted-foreground shrink-0 hover:text-primary hover:underline bg-transparent border-none cursor-pointer p-0">{req.id}</button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-sm flex-1 truncate text-left hover:text-primary bg-transparent border-none cursor-pointer p-0">{req.title}</button>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", PRIORITY_COLORS[req.priority])}>{req.priority}</span>
        {req.status === "in_progress" && <button type="button" title="Stop" onClick={(e) => { e.stopPropagation(); onUpdate(req.id, { status: "pending" }); }} className="shrink-0 p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors"><Square className="h-3 w-3" /></button>}
        {onReorder && (
          <div className="flex flex-col shrink-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={isFirst} onClick={() => onReorder(req.id, "up")} className={cn("p-0.5 rounded transition-colors", isFirst ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronUp className="h-3 w-3" /></button>
            <button type="button" disabled={isLast} onClick={() => onReorder(req.id, "down")} className={cn("p-0.5 rounded transition-colors", isLast ? "text-muted-foreground/30 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted")}><ChevronDown className="h-3 w-3" /></button>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0">{req.created}</span>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1 mb-2 border-b border-border">
            <button type="button" onClick={() => setCardTab("content")} className={cn("px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors", cardTab === "content" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Content</button>
            <button type="button" onClick={() => setCardTab("ai-result")} className={cn("flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border-b-2 -mb-px transition-colors", cardTab === "ai-result" ? "border-blue-400 text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground")}><Bot className="h-3 w-3" />AI Result</button>
          </div>
          {cardTab === "content" && (
            <div style={{ minHeight: 150 }}>
              {editing ? (
                <div className="space-y-2">
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary" />
                  <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={4} className="w-full bg-muted border border-border rounded px-2 py-1 text-sm outline-none focus:border-primary resize-y" />
                  <div className="flex items-center gap-2">
                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as RequestItem["priority"])} className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
                    <button type="button" onClick={async () => { await onUpdate(req.id, { title: editTitle, content: editContent, priority: editPriority }); setEditing(false); }} className="filter-pill active text-xs">Save</button>
                    <button type="button" onClick={() => { setEditing(false); setEditTitle(req.title); setEditContent(req.content); setEditPriority(req.priority); }} className="filter-pill text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{req.content || "(No description)"}</p>
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={() => setEditing(true)} className="filter-pill text-xs flex items-center gap-1"><Pencil className="h-3 w-3" />Edit</button>
                      <button type="button" onClick={() => { if (confirm(`${req.id} delete?`)) onDelete(req.id); }} className="filter-pill text-xs flex items-center gap-1 hover:text-red-400"><Trash2 className="h-3 w-3" />Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {cardTab === "ai-result" && (
            <div style={{ minHeight: 150 }}>
              {aiResultLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : aiResult ? <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{aiResult}</p> : <p className="text-xs text-muted-foreground">No result available.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TAB_STACK = "stack";
const TAB_ALL = "all";
const TABS = [TAB_STACK, TAB_ALL, ...STATUS_ORDER] as const;
const TAB_LABEL: Record<string, string> = { stack: "Graph", all: "All", ...STATUS_LABEL };

/* ── DAG Canvas ───────────────────────────────────────── */

const NODE_W = 220;
const NODE_H = 72;
const ROW_GAP = 24;
const CANVAS_PAD = 40;
const SECTION_GAP = 40; // gap between the 3 sections
const SECTION_HEADER_H = 32;

type NodeLayout = { id: string; x: number; y: number; req: RequestItem; isNextUp: boolean };
type EdgeLayout = { fromId: string; toId: string; x1: number; y1: number; x2: number; y2: number };
type SectionLayout = { key: string; label: string; x: number; y: number; w: number; h: number; color: string; extra: number };

function computeDAGLayout(requests: RequestItem[], tasks: WaterfallTask[], maxParallel = 3) {
  const reqMap = new Map(requests.map((r) => [r.id, r]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const statusMap = new Map(requests.map((r) => [r.id, r.status]));

  const depsOf = new Map<string, string[]>();
  for (const req of requests) {
    const wt = taskMap.get(req.id);
    depsOf.set(req.id, wt ? wt.depends_on.filter((d) => reqMap.has(d)) : []);
  }

  // Group by status
  const priWeight = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
  const allPending = requests.filter((r) => r.status === "pending");
  const allStopped = requests.filter((r) => r.status === "stopped");
  const current = requests.filter((r) => r.status === "in_progress" || r.status === "reviewing");
  const allDone = requests.filter((r) => r.status === "done" || r.status === "rejected");

  // next-up: 의존성 충족된 pending + stopped → QUEUE에 들어갈 후보
  const allReady = [...allStopped, ...allPending];
  const nextUpSet = new Set(allReady.filter((r) => {
    const deps = depsOf.get(r.id) || [];
    return deps.length === 0 || deps.every((d) => statusMap.get(d) === "done");
  }).map((r) => r.id));

  // QUEUE: 다음 실행 대상 (stopped 우선, 그 다음 next-up pending)
  const queueItems = allReady
    .filter((r) => nextUpSet.has(r.id))
    .sort((a, b) => {
      const sa = a.status === "stopped" ? 0 : 1, sb = b.status === "stopped" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return priWeight(a.priority) - priWeight(b.priority) || a.id.localeCompare(b.id);
    })
    .slice(0, maxParallel);
  const queueIds = new Set(queueItems.map((r) => r.id));

  // STOPPED: queue에 안 들어간 stopped
  const stoppedItems = allStopped.filter((r) => !queueIds.has(r.id)).slice(0, maxParallel);

  // PENDING (backlog): queue에 안 들어간 pending
  const pendingNotQueue = allPending.filter((r) => !queueIds.has(r.id));
  const backlog = pendingNotQueue.sort((a, b) => priWeight(a.priority) - priWeight(b.priority) || a.id.localeCompare(b.id)).slice(0, maxParallel);
  const backlogRest = pendingNotQueue.slice(maxParallel, maxParallel * 2);

  // Done
  const done = allDone.slice(-maxParallel).reverse();

  const pendingExtra = pendingNotQueue.length - backlog.length - backlogRest.length;
  const doneExtra = allDone.length - done.length;

  const sections: { key: string; label: string; items: RequestItem[]; color: string; extra: number }[] = [
    ...(backlogRest.length > 0 ? [{ key: "backlog2", label: "BACKLOG", items: backlogRest, color: "#a1a1aa", extra: 0 }] : []),
    ...(backlog.length > 0 ? [{ key: "backlog", label: "BACKLOG", items: backlog, color: "#a1a1aa", extra: 0 }] : []),
    ...(stoppedItems.length > 0 ? [{ key: "stopped", label: "STOPPED", items: stoppedItems, color: "#f59e0b", extra: 0 }] : []),
    { key: "queue", label: "QUEUE", items: queueItems, color: "#eab308", extra: 0 },
    { key: "current", label: "IN PROGRESS", items: current, color: "#3b82f6", extra: 0 },
    { key: "done", label: "DONE", items: done, color: "#22c55e", extra: doneExtra },
  ];

  const nodes: NodeLayout[] = [];
  const sectionLayouts: SectionLayout[] = [];
  // ghostCount: remaining tasks shown as dashed placeholders left of everything
  const ghostCount = pendingExtra > 0 ? 1 : 0;
  const totalGhostExtra = pendingExtra;
  let sectionX = CANVAS_PAD;

  // Ghost section (single dashed placeholder for remaining backlog) - same height as other sections
  if (ghostCount > 0) {
    const ghostH = SECTION_HEADER_H + maxParallel * (NODE_H + ROW_GAP) + ROW_GAP;
    sectionLayouts.push({ key: "ghost", label: `BACKLOG`, x: sectionX, y: CANVAS_PAD, w: NODE_W + CANVAS_PAD, h: ghostH, color: "#71717a", extra: 0 });
    sectionX += NODE_W + CANVAS_PAD + SECTION_GAP;
  }

  for (const sec of sections) {
    const count = Math.max(sec.items.length, 1);
    const minCount = Math.max(count, maxParallel);
    const sectionH = SECTION_HEADER_H + minCount * (NODE_H + ROW_GAP) + ROW_GAP;
    sectionLayouts.push({ key: sec.key, label: sec.label, x: sectionX, y: CANVAS_PAD, w: NODE_W + CANVAS_PAD, h: sectionH, color: sec.color, extra: sec.extra });

    let nodeY = CANVAS_PAD + SECTION_HEADER_H + ROW_GAP;
    for (const req of sec.items) {
      const deps = depsOf.get(req.id) || [];
      const isNextUp = req.status === "pending" && (deps.length === 0 || deps.every((dep) => statusMap.get(dep) === "done"));
      nodes.push({ id: req.id, x: sectionX + CANVAS_PAD / 2, y: nodeY, req, isNextUp });
      nodeY += NODE_H + ROW_GAP;
    }
    sectionX += NODE_W + CANVAS_PAD + SECTION_GAP;
  }

  // Build edges (skip edges within the same section — both nodes share the same x)
  const nodePos = new Map(nodes.map((n) => [n.id, n]));
  const edges: EdgeLayout[] = [];
  for (const req of requests) {
    for (const dep of depsOf.get(req.id) || []) {
      const f = nodePos.get(dep), t = nodePos.get(req.id);
      const depStatus = statusMap.get(dep);
      if (f && t && f.x !== t.x && depStatus !== "done" && depStatus !== "rejected") edges.push({ fromId: dep, toId: req.id, x1: f.x + NODE_W, y1: f.y + NODE_H / 2, x2: t.x, y2: t.y + NODE_H / 2 });
    }
  }

  const allX = nodes.map((n) => n.x).concat(sectionLayouts.map((s) => s.x));
  const allXR = nodes.map((n) => n.x + NODE_W).concat(sectionLayouts.map((s) => s.x + s.w));
  const allY = nodes.map((n) => n.y).concat(sectionLayouts.map((s) => s.y));
  const allYB = nodes.map((n) => n.y + NODE_H).concat(sectionLayouts.map((s) => s.y + s.h));
  const bounds = nodes.length === 0
    ? { minX: 0, minY: 0, maxX: sectionX, maxY: 400 }
    : { minX: Math.min(...allX) - CANVAS_PAD, minY: Math.min(...allY) - CANVAS_PAD, maxX: Math.max(...allXR) + CANVAS_PAD, maxY: Math.max(...allYB) + CANVAS_PAD };

  // Ghost: single dashed box for remaining backlog
  const ghostBox = ghostCount > 0 ? {
    x: sectionLayouts[0].x + CANVAS_PAD / 2,
    y: sectionLayouts[0].y + SECTION_HEADER_H + ROW_GAP,
    w: NODE_W,
    h: maxParallel * (NODE_H + ROW_GAP) - ROW_GAP,
    count: ghostCount + totalGhostExtra,
  } : null;

  // 상위 그룹 계산 (PENDING, IN PROGRESS, DONE)
  const computeGroup = (keys: Set<string>, includeGhost: boolean) => {
    const matched = sectionLayouts.filter((_, i) => {
      const sec = sections[ghostCount > 0 ? i - 1 : i];
      return sec && keys.has(sec.key);
    });
    if (includeGhost && ghostCount > 0 && sectionLayouts.length > 0) {
      matched.unshift(sectionLayouts[0]);
    }
    if (matched.length === 0) return null;
    return {
      x: Math.min(...matched.map((s) => s.x)) - 12,
      y: Math.min(...matched.map((s) => s.y)) - 52,
      w: Math.max(...matched.map((s) => s.x + s.w)) - Math.min(...matched.map((s) => s.x)) + 24,
      h: Math.max(...matched.map((s) => s.y + s.h)) - Math.min(...matched.map((s) => s.y)) + 60,
    };
  };

  const topGroups = [
    { label: "PENDING", color: "#eab308", box: computeGroup(new Set(["backlog", "backlog2"]), true) },
    { label: "STOPPED", color: "#f59e0b", box: computeGroup(new Set(["stopped"]), false) },
    { label: "QUEUE", color: "#eab308", box: computeGroup(new Set(["queue"]), false) },
    { label: "IN PROGRESS", color: "#3b82f6", box: computeGroup(new Set(["current"]), false) },
    { label: "DONE", color: "#22c55e", box: computeGroup(new Set(["done"]), false) },
  ].filter((g) => g.box !== null);

  // 상위 그룹이 1개 섹션만 감싸면 안쪽 라벨 숨김 (중복 방지)
  const hideLabelKeys = new Set<string>();
  for (const g of topGroups) {
    const keyMap: Record<string, string[]> = {
      "PENDING": ["backlog", "backlog2"],
      "STOPPED": ["stopped"],
      "QUEUE": ["queue"],
      "IN PROGRESS": ["current"],
      "DONE": ["done"],
    };
    const keys = keyMap[g.label] || [];
    const matched = sections.filter((s) => keys.includes(s.key));
    if (matched.length <= 1) matched.forEach((m) => hideLabelKeys.add(m.key));
  }

  return { nodes, edges, bounds, sections: sectionLayouts, ghostBox, topGroups, hideLabelKeys };
}

function DAGCanvas({ requests, tasks, onClickItem }: { requests: RequestItem[]; tasks: WaterfallTask[]; onClickItem: (req: RequestItem) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const tf = useRef({ x: 0, y: 0, scale: 1 });
  const pan = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [maxParallel, setMaxParallel] = useState(3);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then((d) => { if (d.maxParallel) setMaxParallel(d.maxParallel); }).catch(() => {}); }, []);
  const [, kick] = useState(0);
  const [hovEdge, setHovEdge] = useState<string | null>(null);
  const layout = useMemo(() => computeDAGLayout(requests, tasks, maxParallel), [requests, tasks, maxParallel]);

  const apply = useCallback(() => { if (gRef.current) gRef.current.setAttribute("transform", `translate(${tf.current.x},${tf.current.y}) scale(${tf.current.scale})`); }, []);

  const fit = useCallback(() => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect(), b = layout.bounds;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    if (!bw || !bh) return;
    const s = Math.min(r.width / bw, r.height / bh, 1.5) * 0.85;
    tf.current = { x: r.width / 2 - (b.minX + b.maxX) / 2 * s, y: r.height / 2 - (b.minY + b.maxY) / 2 * s, scale: s };
    apply(); kick((n) => n + 1);
  }, [layout, apply]);

  useEffect(() => { fit(); }, [fit]);

  const onMD = useCallback((e: React.MouseEvent) => { if (e.button !== 0) return; pan.current = { active: true, sx: e.clientX, sy: e.clientY, tx: tf.current.x, ty: tf.current.y, moved: false }; svgRef.current?.classList.add("panning"); }, []);
  const onMM = useCallback((e: React.MouseEvent) => { const p = pan.current; if (!p?.active) return; const dx = e.clientX - p.sx, dy = e.clientY - p.sy; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) p.moved = true; tf.current.x = p.tx + dx; tf.current.y = p.ty + dy; apply(); }, [apply]);
  const onMU = useCallback(() => { pan.current = null; svgRef.current?.classList.remove("panning"); }, []);
  const onWh = useCallback((e: React.WheelEvent) => { e.preventDefault(); const r = svgRef.current?.getBoundingClientRect(); if (!r) return; const t = tf.current, cx = e.clientX - r.left, cy = e.clientY - r.top, ns = Math.min(Math.max(t.scale * (e.deltaY < 0 ? 1.1 : 0.9), 0.1), 3), ra = ns / t.scale; tf.current = { x: cx - (cx - t.x) * ra, y: cy - (cy - t.y) * ra, scale: ns }; apply(); kick((n) => n + 1); }, [apply]);

  if (requests.length === 0) return <div className="text-center py-12 text-muted-foreground"><Layers className="h-8 w-8 mx-auto mb-3 opacity-40" /><p className="text-sm">No tasks yet.</p></div>;

  const bc = (s: string, nu: boolean) => nu ? "#facc15" : s === "in_progress" || s === "reviewing" ? "#3b82f6" : s === "done" ? "#22c55e" : s === "rejected" ? "#ef4444" : "var(--border)";

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 180px)", minHeight: 400 }}>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-card/80 backdrop-blur border border-border rounded-md px-2 py-1">
        <button type="button" onClick={fit} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex items-center gap-1"><Maximize2 className="h-3 w-3" />Fit</button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(tf.current.scale * 100)}%</span>
      </div>
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-3 bg-card/80 backdrop-blur border border-border rounded-md px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-yellow-500" />Pending</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done</span>
        <span className="flex items-center gap-1 text-[10px] text-yellow-400"><span className="w-2 h-2 rounded-full border border-yellow-400 bg-yellow-400/30" />Next Up</span>
      </div>
      <svg ref={svgRef} className="dag-canvas w-full h-full rounded-lg border border-border bg-background" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU} onWheel={onWh}>
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--muted-foreground)" opacity="0.5" /></marker>
          <marker id="dag-arrow-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--primary)" /></marker>
        </defs>
        <g ref={gRef}>
          {/* Top-level group backgrounds (PENDING, IN PROGRESS, DONE) */}
          {layout.topGroups.map((g) => (
            <g key={g.label}>
              <rect x={g.box!.x} y={g.box!.y} width={g.box!.w} height={g.box!.h} rx={12} fill={g.color} fillOpacity={0.03} stroke={g.color} strokeWidth={1.5} strokeDasharray="8 4" strokeOpacity={0.4} />
              <text x={g.box!.x + g.box!.w / 2} y={g.box!.y + 28} textAnchor="middle" fill={g.color} fontSize={11} fontWeight={700} letterSpacing="0.1em" opacity={0.5}>{g.label}</text>
            </g>
          ))}
          {/* Section backgrounds */}
          {layout.sections.map((sec) => (
            <g key={sec.label}>
              {!layout.hideLabelKeys.has(sec.key) && <rect x={sec.x} y={sec.y} width={sec.w} height={sec.h} rx={8} fill="var(--muted)" opacity={0.3} stroke={sec.color} strokeWidth={1} strokeOpacity={0.3} />}
              {!layout.hideLabelKeys.has(sec.key) && <text x={sec.x + sec.w / 2} y={sec.y + 22} textAnchor="middle" fill={sec.color} fontSize={11} fontWeight={600} letterSpacing="0.05em" opacity={0.7}>{sec.label}</text>}
              {sec.extra > 0 && <text x={sec.x + sec.w / 2} y={sec.h + sec.y - 8} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} opacity={0.6}>+{sec.extra} more</text>}
            </g>
          ))}
          {layout.edges.map((e) => { const k = `${e.fromId}-${e.toId}`, h = hovEdge === k, cp = Math.max(Math.abs(e.x2 - e.x1) * 0.4, 40), d = `M ${e.x1} ${e.y1} C ${e.x1 + cp} ${e.y1}, ${e.x2 - cp} ${e.y2}, ${e.x2} ${e.y2}`; return (<g key={k}><path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "pointer" }} onMouseEnter={() => setHovEdge(k)} onMouseLeave={() => setHovEdge(null)} /><path d={d} fill="none" stroke={h ? "var(--primary)" : "var(--muted-foreground)"} strokeWidth={h ? 2 : 1} strokeDasharray={h ? "none" : "5 3"} opacity={h ? 0.9 : 0.3} markerEnd={h ? "url(#dag-arrow-hover)" : "url(#dag-arrow)"} style={{ transition: "all 0.15s ease" }} /></g>); })}
          {layout.nodes.map((n) => (
            <foreignObject key={n.id} x={n.x} y={n.y} width={NODE_W} height={NODE_H} style={{ overflow: "visible" }}>
              <div onClick={(e) => { e.stopPropagation(); if (!pan.current?.moved) onClickItem(n.req); }} className={cn("flex flex-col gap-1 p-2.5 rounded-lg border cursor-pointer transition-all h-full hover:shadow-md", n.req.status === "done" && "opacity-50", n.req.status === "rejected" && "opacity-50", n.isNextUp && "dag-node-next-up", (n.req.status === "in_progress" || n.req.status === "reviewing") && "dag-node-active")} style={{ borderColor: bc(n.req.status, n.isNextUp), background: "var(--card)" }}>
                <div className="flex items-center gap-1.5">
                  {n.req.status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[n.req.status])} />}
                  <span className="font-mono text-[10px] text-muted-foreground">{n.id}</span>
                  <span className={cn("text-[9px] px-1 py-0.5 rounded border font-medium ml-auto shrink-0", PRIORITY_COLORS[n.req.priority])}>{n.req.priority}</span>
                </div>
                <span className="text-[11px] leading-snug line-clamp-2">{n.req.title}</span>
              </div>
            </foreignObject>
          ))}
          {/* Ghost dashed placeholder for remaining backlog */}
          {layout.ghostBox && (
            <g>
              <rect x={layout.ghostBox.x} y={layout.ghostBox.y} width={layout.ghostBox.w} height={layout.ghostBox.h} rx={8} fill="var(--muted)" fillOpacity={0.3} stroke="#71717a" strokeWidth={1.5} strokeDasharray="8 4" opacity={0.6} />
              <text x={layout.ghostBox.x + layout.ghostBox.w / 2} y={layout.ghostBox.y + layout.ghostBox.h / 2 + 5} textAnchor="middle" fill="#a1a1aa" fontSize={13} fontWeight={500}>{layout.ghostBox.count} more</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

function TasksPageInner() {
  const { requests, isLoading, error, updateRequest, deleteRequest, reorderRequest } = useRequests();
  const { groups } = useTasks();
  const allWaterfallTasks = groups.flatMap((g) => g.tasks);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || TAB_STACK;
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const setActiveTab = (tab: string) => { router.push(`/tasks?tab=${tab}`, { scroll: false }); };

  const filtered = useMemo(() => {
    let result = requests;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
    }
    if (priorityFilter !== "all" && activeTab !== TAB_STACK) {
      result = result.filter((r) => r.priority === priorityFilter);
    }
    return result;
  }, [requests, searchQuery, priorityFilter, activeTab]);

  const priWeight = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
  const sortByPriority = (items: RequestItem[]) => [...items].sort((a, b) => priWeight(a.priority) - priWeight(b.priority) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
  const grouped: Record<string, RequestItem[]> = { stopped: sortByPriority(filtered.filter((r) => r.status === "stopped")), pending: sortByPriority(filtered.filter((r) => r.status === "pending")), reviewing: sortByPriority(filtered.filter((r) => r.status === "reviewing")), in_progress: sortByPriority(filtered.filter((r) => r.status === "in_progress")), rejected: sortByPriority(filtered.filter((r) => r.status === "rejected")), done: sortByPriority(filtered.filter((r) => r.status === "done")) };
  const filteredStatuses = activeTab === TAB_ALL ? STATUS_ORDER.filter((s) => grouped[s].length > 0) : [activeTab];

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading tasks...</div>;
  if (error) return <div className="p-4 text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4"><h1 className="text-lg font-semibold">Tasks</h1><AutoImproveControl /></div>
        <button type="button" onClick={() => router.push("/tasks/new")} className="filter-pill active flex items-center gap-1"><Plus className="h-3 w-3" />New Task</button>
      </div>
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => { const count = tab === TAB_ALL || tab === TAB_STACK ? requests.length : grouped[tab]?.length ?? 0; return (<span key={tab} className="flex items-center"><button type="button" onClick={() => setActiveTab(tab)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px", activeTab === tab ? (tab === TAB_STACK ? "border-violet-400 text-violet-400" : "border-primary text-primary") : "border-transparent text-muted-foreground hover:text-foreground")}>{tab === TAB_STACK && <Layers className="h-3 w-3 shrink-0" />}{tab !== TAB_ALL && tab !== TAB_STACK && <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[tab])} />}{TAB_LABEL[tab]}<span className="text-[10px] text-muted-foreground">({count})</span></button>{tab === TAB_STACK && <span className="h-4 w-px bg-border mx-1" />}</span>); })}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ID, 제목, 내용으로 검색..."
          className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
        />
      </div>
      {activeTab !== TAB_STACK && (
        <div className="flex items-center gap-1">
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPriorityFilter(p)} className={cn("filter-pill text-[11px]", priorityFilter === p && (p === "all" ? "active" : PRIORITY_COLORS[p]))}>{p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}</button>
          ))}
        </div>
      )}
      {activeTab === TAB_STACK && <DAGCanvas requests={filtered} tasks={allWaterfallTasks} onClickItem={(req) => router.push(`/tasks/${req.id}`)} />}
      {activeTab !== TAB_STACK && filteredStatuses.map((status) => { const items = grouped[status]; if (!items || items.length === 0) return null; return (<div key={status}>{activeTab === TAB_ALL && (<div className="flex items-center gap-2 mb-2">{status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />}<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[status]}</span><span className="text-[10px] text-muted-foreground">({items.length})</span></div>)}<div className="space-y-1">{items.map((req, i) => <RequestCard key={req.id} req={req} onUpdate={updateRequest} onDelete={deleteRequest} onClick={() => router.push(`/tasks/${req.id}`)} onReorder={reorderRequest} isFirst={i === 0} isLast={i === items.length - 1} />)}</div></div>); })}
      {activeTab !== TAB_STACK && requests.length === 0 && <div className="text-center py-12 text-muted-foreground"><p className="text-sm">No tasks yet.</p></div>}
    </div>
  );
}

export default function TasksPage() {
  return <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}><TasksPageInner /></Suspense>;
}
