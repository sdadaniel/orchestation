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

  const depsOf = new Map<string, string[]>();
  for (const req of requests) {
    const wt = taskMap.get(req.id);
    depsOf.set(req.id, wt ? wt.depends_on.filter((d) => reqMap.has(d)) : []);
  }

  const priWeight = (p: string) => p === "high" ? 0 : p === "medium" ? 1 : p === "low" ? 2 : 3;
  const allPending = requests.filter((r) => r.status === "pending" || r.status === "stopped");
  const current = requests.filter((r) => r.status === "in_progress" || r.status === "reviewing");
  const allDone = requests.filter((r) => r.status === "done" || r.status === "rejected");
  const allFailed = requests.filter((r) => r.status === "failed");

  // 의존 depth 계산: depth 0 = 의존 없거나 모두 done → 즉시 실행 가능
  const pendingSet = new Set(allPending.map((r) => r.id));
  const depthOf = new Map<string, number>();
  const getDepth = (id: string, visited: Set<string> = new Set()): number => {
    if (depthOf.has(id)) return depthOf.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const deps = (depsOf.get(id) || []).filter((d) => pendingSet.has(d));
    if (deps.length === 0) { depthOf.set(id, 0); return 0; }
    const max = Math.max(...deps.map((d) => getDepth(d, visited)));
    const depth = max + 1;
    depthOf.set(id, depth);
    return depth;
  };
  for (const r of allPending) getDepth(r.id);

  // depth별 그룹: Queue1(depth 0), Queue2(depth 1), 나머지는 ghost
  const MAX_PENDING_QUEUES = 2;
  const pendingByDepth: RequestItem[][] = [];
  const maxDepth = allPending.length > 0 ? Math.max(...allPending.map((r) => depthOf.get(r.id) ?? 0)) : 0;
  for (let d = 0; d <= Math.min(maxDepth, MAX_PENDING_QUEUES - 1); d++) {
    pendingByDepth.push(
      allPending
        .filter((r) => (depthOf.get(r.id) ?? 0) === d)
        .sort((a, b) => priWeight(a.priority) - priWeight(b.priority) || a.id.localeCompare(b.id))
        .slice(0, maxParallel)
    );
  }
  // 나머지 (depth >= MAX_PENDING_QUEUES 또는 슬라이스에서 잘린 것)
  const shownIds = new Set(pendingByDepth.flat().map((r) => r.id));
  const pendingRest = allPending.filter((r) => !shownIds.has(r.id));

  const queueItems = pendingByDepth[0] ?? [];
  const done = allDone.slice(-maxParallel).reverse();
  const doneExtra = allDone.length - done.length;

  const sections: { key: string; label: string; items: RequestItem[]; color: string; extra: number }[] = [];

  // Pending queues: 깊은 depth부터 (오른쪽이 Queue1)
  for (let i = pendingByDepth.length - 1; i >= 1; i--) {
    if (pendingByDepth[i].length > 0) {
      sections.push({ key: `pending-${i}`, label: `QUEUE ${i + 1}`, items: pendingByDepth[i], color: "#a1a1aa", extra: 0 });
    }
  }
  // Queue1 (depth 0 = 즉시 실행 가능)
  sections.push({ key: "queue", label: "QUEUE", items: queueItems, color: "#eab308", extra: 0 });
  sections.push({ key: "current", label: "IN PROGRESS", items: current, color: "#3b82f6", extra: 0 });
  sections.push({ key: "done", label: "DONE", items: done, color: "#22c55e", extra: doneExtra });
  if (allFailed.length > 0) sections.push({ key: "failed", label: "FAILED", items: allFailed.slice(0, maxParallel), color: "#ef4444", extra: Math.max(0, allFailed.length - maxParallel) });

  const nodes: NodeLayout[] = [];
  const sectionLayouts: SectionLayout[] = [];
  const ghostCount = pendingRest.length > 0 ? 1 : 0;
  const totalGhostExtra = pendingRest.length;
  let sectionX = CANVAS_PAD;

  if (ghostCount > 0) {
    const ghostH = SECTION_HEADER_H + maxParallel * (NODE_H + ROW_GAP) + ROW_GAP;
    sectionLayouts.push({ key: "ghost", label: "PENDING", x: sectionX, y: CANVAS_PAD, w: NODE_W + CANVAS_PAD, h: ghostH, color: "#71717a", extra: 0 });
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
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) {
    const deps = depsOf.get(node.id) || [];
    for (const depId of deps) {
      const depNode = nodeMap.get(depId);
      if (!depNode) continue;
      // 같은 섹션(같은 x)이면 세로 우회, 다른 섹션이면 가로 연결
      const sameSection = Math.abs(depNode.x - node.x) < 10;
      if (sameSection) {
        // 위 노드 → 아래 노드, 오른쪽으로 우회하는 곡선
        const topNode = depNode.y < node.y ? depNode : node;
        const botNode = depNode.y < node.y ? node : depNode;
        edges.push({
          fromId: topNode.id,
          toId: botNode.id,
          x1: topNode.x + NODE_W,
          y1: topNode.y + NODE_H / 2,
          x2: botNode.x + NODE_W,
          y2: botNode.y + NODE_H / 2,
        });
      } else {
        const leftNode = depNode.x < node.x ? depNode : node;
        const rightNode = depNode.x < node.x ? node : depNode;
        edges.push({
          fromId: leftNode.id,
          toId: rightNode.id,
          x1: leftNode.x + NODE_W,
          y1: leftNode.y + NODE_H / 2,
          x2: rightNode.x,
          y2: rightNode.y + NODE_H / 2,
        });
      }
    }
  }

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

  // pending 큐 키 수집
  const pendingKeys = new Set(sections.filter((s) => s.key.startsWith("pending-") || s.key === "queue").map((s) => s.key));
  const topGroups = [
    { label: "PENDING", color: "#eab308", box: computeGroup(pendingKeys, true) },
    { label: "FAILED", color: "#ef4444", box: computeGroup(new Set(["failed"]), false) },
    { label: "IN PROGRESS", color: "#3b82f6", box: computeGroup(new Set(["current"]), false) },
    { label: "DONE", color: "#22c55e", box: computeGroup(new Set(["done"]), false) },
  ].filter((g) => g.box !== null);

  const hideLabelKeys = new Set<string>();
  for (const g of topGroups) {
    const keyMap: Record<string, string[]> = {
      "PENDING": [...pendingKeys],
      "FAILED": ["failed"],
      "IN PROGRESS": ["current"],
      "DONE": ["done"],
    };
    const keys = keyMap[g.label] || [];
    const matched = sections.filter((s) => keys.includes(s.key));
    if (matched.length <= 1) matched.forEach((m) => hideLabelKeys.add(m.key));
  }

  // ghost → 첫 번째 보이는 pending 노드로 연결선
  let ghostEdge: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (ghostBox && pendingByDepth.length > 0) {
    // ghost에 숨겨진 태스크 중 보이는 노드에 의존하는 게 있는지 확인
    const hasLink = pendingRest.some((r) => {
      const deps = depsOf.get(r.id) || [];
      return deps.some((d) => nodeMap.has(d));
    }) || pendingRest.some((r) => {
      // 또는 보이는 노드가 ghost 태스크에 의존하는지
      return nodes.some((n) => (depsOf.get(n.id) || []).includes(r.id));
    });
    if (hasLink) {
      // ghost 오른쪽 중앙 → 가장 왼쪽 pending 노드의 왼쪽 중앙
      const leftmostPendingNode = nodes
        .filter((n) => pendingSet.has(n.id))
        .sort((a, b) => a.x - b.x)[0];
      if (leftmostPendingNode) {
        ghostEdge = {
          x1: ghostBox.x + ghostBox.w,
          y1: ghostBox.y + NODE_H / 2,
          x2: leftmostPendingNode.x,
          y2: leftmostPendingNode.y + NODE_H / 2,
        };
      }
    }
  }

  return { nodes, edges, bounds, sections: sectionLayouts, ghostBox, ghostEdge, topGroups, hideLabelKeys };
}

// ── Component ────────────────────────────────────────

export default function DAGCanvas({ requests, tasks, onClickItem }: { requests: RequestItem[]; tasks: WaterfallTask[]; onClickItem: (req: RequestItem) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const tf = useRef({ x: 0, y: 0, scale: 1 });
  const pan = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [maxParallel, setMaxParallel] = useState(3);
  useEffect(() => { fetch("/api/settings").then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json() as Promise<{ maxParallel?: number }>; }).then((d) => { if (d.maxParallel) setMaxParallel(d.maxParallel); }).catch((err) => { console.error("[DAGCanvas] settings fetch error:", err); }); }, []);
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
    <div className="relative w-full" style={{ height: "calc(100vh - 380px)", minHeight: 250 }}>
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-card/80 backdrop-blur border border-border rounded-md px-2 py-1">
        <button type="button" onClick={fit} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex items-center gap-1"><Maximize2 className="h-3 w-3" />Fit</button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(tf.current.scale * 100)}%</span>
      </div>
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-3 bg-card/80 backdrop-blur border border-border rounded-md px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-yellow-500" />Pending</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-red-500" />Failed</span>
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
            <g key={sec.key}>
              {!layout.hideLabelKeys.has(sec.key) && <rect x={sec.x} y={sec.y} width={sec.w} height={sec.h} rx={8} fill="var(--muted)" opacity={0.3} stroke={sec.color} strokeWidth={1} strokeOpacity={0.3} />}
              {!layout.hideLabelKeys.has(sec.key) && <text x={sec.x + sec.w / 2} y={sec.y + 22} textAnchor="middle" fill={sec.color} fontSize={11} fontWeight={600} letterSpacing="0.05em" opacity={0.7}>{sec.label}</text>}
              {sec.extra > 0 && <text x={sec.x + sec.w / 2} y={sec.h + sec.y - 8} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10} opacity={0.6}>+{sec.extra} more</text>}
            </g>
          ))}
          {layout.edges.map((e) => {
            const k = `${e.fromId}-${e.toId}`;
            const h = hovEdge === k;
            const sameX = Math.abs(e.x1 - e.x2) < 10;
            let d: string;
            if (sameX) {
              // 같은 섹션: 오른쪽으로 우회하는 곡선
              const bulge = NODE_W * 0.4;
              d = `M ${e.x1} ${e.y1} C ${e.x1 + bulge} ${e.y1}, ${e.x2 + bulge} ${e.y2}, ${e.x2} ${e.y2}`;
            } else {
              const cp = Math.max(Math.abs(e.x2 - e.x1) * 0.4, 40);
              d = `M ${e.x1} ${e.y1} C ${e.x1 + cp} ${e.y1}, ${e.x2 - cp} ${e.y2}, ${e.x2} ${e.y2}`;
            }
            return (<g key={k}><path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "pointer" }} onMouseEnter={() => setHovEdge(k)} onMouseLeave={() => setHovEdge(null)} /><path d={d} fill="none" stroke={h ? "var(--primary)" : "#ffffff"} strokeWidth={h ? 2.5 : 1.5} opacity={h ? 1 : 0.5} markerEnd={h ? "url(#dag-arrow-hover)" : "url(#dag-arrow)"} style={{ transition: "all 0.15s ease" }} /></g>);
          })}
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
          {layout.ghostEdge && (() => {
            const e = layout.ghostEdge;
            const cp = Math.max(Math.abs(e.x2 - e.x1) * 0.4, 40);
            const d = `M ${e.x1} ${e.y1} C ${e.x1 + cp} ${e.y1}, ${e.x2 - cp} ${e.y2}, ${e.x2} ${e.y2}`;
            const h = hovEdge === "ghost";
            return (<g><path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "pointer" }} onMouseEnter={() => setHovEdge("ghost")} onMouseLeave={() => setHovEdge(null)} /><path d={d} fill="none" stroke={h ? "var(--primary)" : "#ffffff"} strokeWidth={h ? 2.5 : 1.5} opacity={h ? 1 : 0.5} markerEnd={h ? "url(#dag-arrow-hover)" : "url(#dag-arrow)"} style={{ transition: "all 0.15s ease" }} /></g>);
          })()}
        </g>
      </svg>
    </div>
  );
}
