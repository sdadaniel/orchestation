"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Layers, Maximize2 } from "lucide-react";
import { type RequestItem } from "@/hooks/useRequests";
import type { WaterfallTask } from "@/types/waterfall";
import { PRIORITY_COLORS, STATUS_DOT, NODE_W, NODE_H, ROW_GAP, CANVAS_PAD, SECTION_GAP, SECTION_HEADER_H } from "@/app/tasks/constants";

// ── Types ────────────────────────────────────────────

type NodeLayout = { id: string; x: number; y: number; req: RequestItem; isNextUp: boolean };
type EdgeLayout = { fromId: string; toId: string; x1: number; y1: number; x2: number; y2: number };
type SectionLayout = { key: string; label: string; x: number; y: number; w: number; h: number; color: string; extra: number };

// ── Layout computation ───────────────────────────────

function computeDAGLayout(requests: RequestItem[], tasks: WaterfallTask[], maxParallel = 3) {
  const reqMap = new Map(requests.map((r) => [r.id, r]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const statusMap = new Map(requests.map((r) => [r.id, r.status]));

  const depsOf = new Map<string, string[]>();
  for (const req of requests) {
    const wt = taskMap.get(req.id);
    depsOf.set(req.id, wt ? wt.depends_on.filter((d) => reqMap.has(d)) : []);
  }

  const priWeight = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
  const allPending = requests.filter((r) => r.status === "pending");
  const allStopped = requests.filter((r) => r.status === "stopped");
  const current = requests.filter((r) => r.status === "in_progress" || r.status === "reviewing");
  const allDone = requests.filter((r) => r.status === "done" || r.status === "rejected");

  const allReady = [...allStopped, ...allPending];
  const nextUpSet = new Set(allReady.filter((r) => {
    const deps = depsOf.get(r.id) || [];
    return deps.length === 0 || deps.every((d) => statusMap.get(d) === "done");
  }).map((r) => r.id));

  const queueItems = allReady
    .filter((r) => nextUpSet.has(r.id))
    .sort((a, b) => {
      const sa = a.status === "stopped" ? 0 : 1, sb = b.status === "stopped" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return priWeight(a.priority) - priWeight(b.priority) || a.id.localeCompare(b.id);
    })
    .slice(0, maxParallel);
  const queueIds = new Set(queueItems.map((r) => r.id));

  const stoppedItems = allStopped.filter((r) => !queueIds.has(r.id)).slice(0, maxParallel);
  const pendingNotQueue = allPending.filter((r) => !queueIds.has(r.id));
  const backlog = pendingNotQueue.sort((a, b) => priWeight(a.priority) - priWeight(b.priority) || a.id.localeCompare(b.id)).slice(0, maxParallel);
  const backlogRest = pendingNotQueue.slice(maxParallel, maxParallel * 2);
  const done = allDone.slice(-maxParallel).reverse();

  const pendingExtra = pendingNotQueue.length - backlog.length - backlogRest.length;
  const doneExtra = allDone.length - done.length;

  const sections: { key: string; label: string; items: RequestItem[]; color: string; extra: number }[] = [
    ...(backlogRest.length > 0 ? [{ key: "backlog2", label: "BACKLOG", items: backlogRest, color: "#a1a1aa", extra: 0 }] : []),
    ...(backlog.length > 0 ? [{ key: "backlog", label: "BACKLOG", items: backlog, color: "#a1a1aa", extra: 0 }] : []),
    ...(stoppedItems.length > 0 ? [{ key: "stopped", label: "STOPPED", items: stoppedItems, color: "#8b5cf6", extra: 0 }] : []),
    { key: "queue", label: "QUEUE", items: queueItems, color: "#eab308", extra: 0 },
    { key: "current", label: "IN PROGRESS", items: current, color: "#3b82f6", extra: 0 },
    { key: "done", label: "DONE", items: done, color: "#22c55e", extra: doneExtra },
  ];

  const nodes: NodeLayout[] = [];
  const sectionLayouts: SectionLayout[] = [];
  const ghostCount = pendingExtra > 0 ? 1 : 0;
  const totalGhostExtra = pendingExtra;
  let sectionX = CANVAS_PAD;

  if (ghostCount > 0) {
    const ghostH = SECTION_HEADER_H + maxParallel * (NODE_H + ROW_GAP) + ROW_GAP;
    sectionLayouts.push({ key: "ghost", label: "BACKLOG", x: sectionX, y: CANVAS_PAD, w: NODE_W + CANVAS_PAD, h: ghostH, color: "#71717a", extra: 0 });
    sectionX += NODE_W + CANVAS_PAD + SECTION_GAP;
  }

  for (const sec of sections) {
    const count = Math.max(sec.items.length, 1);
    const minCount = Math.max(count, maxParallel);
    const sectionH = SECTION_HEADER_H + minCount * (NODE_H + ROW_GAP) + ROW_GAP;
    sectionLayouts.push({ key: sec.key, label: sec.label, x: sectionX, y: CANVAS_PAD, w: NODE_W + CANVAS_PAD, h: sectionH, color: sec.color, extra: sec.extra });

    let nodeY = CANVAS_PAD + SECTION_HEADER_H + ROW_GAP;
    for (const req of sec.items) {
      nodes.push({ id: req.id, x: sectionX + CANVAS_PAD / 2, y: nodeY, req, isNextUp: false });
      nodeY += NODE_H + ROW_GAP;
    }
    sectionX += NODE_W + CANVAS_PAD + SECTION_GAP;
  }

  const edges: EdgeLayout[] = [];

  const allX = nodes.map((n) => n.x).concat(sectionLayouts.map((s) => s.x));
  const allXR = nodes.map((n) => n.x + NODE_W).concat(sectionLayouts.map((s) => s.x + s.w));
  const allY = nodes.map((n) => n.y).concat(sectionLayouts.map((s) => s.y));
  const allYB = nodes.map((n) => n.y + NODE_H).concat(sectionLayouts.map((s) => s.y + s.h));
  const bounds = nodes.length === 0
    ? { minX: 0, minY: 0, maxX: sectionX, maxY: 400 }
    : { minX: Math.min(...allX) - CANVAS_PAD, minY: Math.min(...allY) - CANVAS_PAD, maxX: Math.max(...allXR) + CANVAS_PAD, maxY: Math.max(...allYB) + CANVAS_PAD };

  const ghostBox = ghostCount > 0 ? {
    x: sectionLayouts[0].x + CANVAS_PAD / 2,
    y: sectionLayouts[0].y + SECTION_HEADER_H + ROW_GAP,
    w: NODE_W,
    h: maxParallel * (NODE_H + ROW_GAP) - ROW_GAP,
    count: ghostCount + totalGhostExtra,
  } : null;

  const computeGroup = (keys: Set<string>, includeGhost: boolean) => {
    const matched = sectionLayouts.filter((_, i) => {
      const sec = sections[ghostCount > 0 ? i - 1 : i];
      return sec && keys.has(sec.key);
    });
    if (includeGhost && ghostCount > 0 && sectionLayouts.length > 0) matched.unshift(sectionLayouts[0]);
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
    { label: "STOPPED", color: "#8b5cf6", box: computeGroup(new Set(["stopped"]), false) },
    { label: "QUEUE", color: "#eab308", box: computeGroup(new Set(["queue"]), false) },
    { label: "IN PROGRESS", color: "#3b82f6", box: computeGroup(new Set(["current"]), false) },
    { label: "DONE", color: "#22c55e", box: computeGroup(new Set(["done"]), false) },
  ].filter((g) => g.box !== null);

  const hideLabelKeys = new Set<string>();
  for (const g of topGroups) {
    const keyMap: Record<string, string[]> = { "PENDING": ["backlog", "backlog2"], "STOPPED": ["stopped"], "QUEUE": ["queue"], "IN PROGRESS": ["current"], "DONE": ["done"] };
    const keys = keyMap[g.label] || [];
    const matched = sections.filter((s) => keys.includes(s.key));
    if (matched.length <= 1) matched.forEach((m) => hideLabelKeys.add(m.key));
  }

  return { nodes, edges, bounds, sections: sectionLayouts, ghostBox, topGroups, hideLabelKeys };
}

// ── Component ────────────────────────────────────────

export default function DAGCanvas({ requests, tasks, onClickItem }: { requests: RequestItem[]; tasks: WaterfallTask[]; onClickItem: (req: RequestItem) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const tf = useRef({ x: 0, y: 0, scale: 1 });
  const pan = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [maxParallel, setMaxParallel] = useState(3);
  useEffect(() => { fetch("/api/settings").then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json(); }).then((d) => { if (d.maxParallel) setMaxParallel(d.maxParallel); }).catch(() => {}); }, []);
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
      </div>
      <svg ref={svgRef} className="dag-canvas w-full h-full rounded-lg border border-border bg-background" onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU} onWheel={onWh}>
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--muted-foreground)" opacity="0.5" /></marker>
          <marker id="dag-arrow-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--primary)" /></marker>
        </defs>
        <g ref={gRef}>
          {layout.topGroups.map((g) => (
            <g key={g.label}>
              <rect x={g.box!.x} y={g.box!.y} width={g.box!.w} height={g.box!.h} rx={12} fill={g.color} fillOpacity={0.03} stroke={g.color} strokeWidth={1.5} strokeDasharray="8 4" strokeOpacity={0.4} />
              <text x={g.box!.x + g.box!.w / 2} y={g.box!.y + 28} textAnchor="middle" fill={g.color} fontSize={11} fontWeight={700} letterSpacing="0.1em" opacity={0.5}>{g.label}</text>
            </g>
          ))}
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
              <div className={cn("flex flex-col gap-1 p-2.5 rounded-lg border transition-all h-full", n.req.status === "done" && "opacity-50", n.req.status === "rejected" && "opacity-50", n.isNextUp && "dag-node-next-up", (n.req.status === "in_progress" || n.req.status === "reviewing") && "dag-node-active")} style={{ borderColor: bc(n.req.status, n.isNextUp), background: "var(--card)" }}>
                <div className="flex items-center gap-1.5">
                  {n.req.status === "in_progress" ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[n.req.status])} />}
                  <span className="font-mono text-[10px] text-muted-foreground">{n.id}</span>
                  <span className={cn("text-[9px] px-1 py-0.5 rounded border font-medium ml-auto shrink-0", PRIORITY_COLORS[n.req.priority])}>{n.req.priority}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); if (!pan.current?.moved) onClickItem(n.req); }} className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors shrink-0">상세</button>
                </div>
                <span className="text-[11px] leading-snug line-clamp-2">{n.req.title}</span>
              </div>
            </foreignObject>
          ))}
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
