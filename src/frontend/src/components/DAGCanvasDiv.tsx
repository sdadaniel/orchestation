"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Layers, Maximize2 } from "lucide-react";
import { type RequestItem } from "@/hooks/useRequests";
import type { WaterfallTask } from "@/types/waterfall";
import { PRIORITY_COLORS, STATUS_DOT, NODE_W, NODE_H, ROW_GAP, CANVAS_PAD, SECTION_GAP, SECTION_HEADER_H } from "@/app/tasks/constants";
import { computeDAGLayout } from "./DAGCanvas";

// ── Helper ───────────────────────────────────────────

function bc(status: string, isNextUp: boolean) {
  if (isNextUp) return "#facc15";
  if (status === "in_progress" || status === "reviewing") return "#3b82f6";
  if (status === "done") return "#22c55e";
  if (status === "rejected") return "#ef4444";
  return "var(--border)";
}

// ── Component ────────────────────────────────────────

export default function DAGCanvasDiv({
  requests,
  tasks,
  onClickItem,
}: {
  requests: RequestItem[];
  tasks: WaterfallTask[];
  onClickItem: (req: RequestItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const tf = useRef({ x: 0, y: 0, scale: 1 });
  const pan = useRef<{ active: boolean; sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [maxParallel, setMaxParallel] = useState(3);
  const [, kick] = useState(0);
  const [hovEdge, setHovEdge] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json() as Promise<{ maxParallel?: number }>; })
      .then((d) => { if (d.maxParallel) setMaxParallel(d.maxParallel); })
      .catch((err) => console.error("[DAGCanvasDiv] settings fetch error:", err));
  }, []);

  const layout = useMemo(() => computeDAGLayout(requests, tasks, maxParallel), [requests, tasks, maxParallel]);

  const apply = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.style.transform = `translate(${tf.current.x}px,${tf.current.y}px) scale(${tf.current.scale})`;
    }
  }, []);

  const fit = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    const b = layout.bounds;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    if (!bw || !bh) return;
    const s = Math.min(r.width / bw, r.height / bh, 1.5) * 0.85;
    tf.current = { x: r.width / 2 - (b.minX + b.maxX) / 2 * s, y: r.height / 2 - (b.minY + b.maxY) / 2 * s, scale: s };
    apply();
    kick((n) => n + 1);
  }, [layout, apply]);

  useEffect(() => { fit(); }, [fit]);

  const onMD = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    pan.current = { active: true, sx: e.clientX, sy: e.clientY, tx: tf.current.x, ty: tf.current.y, moved: false };
    containerRef.current?.classList.add("cursor-grabbing");
  }, []);

  const onMM = useCallback((e: React.MouseEvent) => {
    const p = pan.current;
    if (!p?.active) return;
    const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) p.moved = true;
    tf.current.x = p.tx + dx;
    tf.current.y = p.ty + dy;
    apply();
  }, [apply]);

  const onMU = useCallback(() => {
    pan.current = null;
    containerRef.current?.classList.remove("cursor-grabbing");
  }, []);

  const onWh = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const t = tf.current;
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const ns = Math.min(Math.max(t.scale * (e.deltaY < 0 ? 1.1 : 0.9), 0.1), 3);
    const ra = ns / t.scale;
    tf.current = { x: cx - (cx - t.x) * ra, y: cy - (cy - t.y) * ra, scale: ns };
    apply();
    kick((n) => n + 1);
  }, [apply]);

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No tasks yet.</p>
      </div>
    );
  }

  const b = layout.bounds;
  const svgW = b.maxX - b.minX + CANVAS_PAD * 2;
  const svgH = b.maxY - b.minY + CANVAS_PAD * 2;
  const svgOX = b.minX - CANVAS_PAD;
  const svgOY = b.minY - CANVAS_PAD;

  return (
    <div
      className="relative w-full rounded-lg border border-border bg-background overflow-hidden cursor-grab"
      style={{ height: "calc(100vh - 380px)", minHeight: 250 }}
      ref={containerRef}
      onMouseDown={onMD}
      onMouseMove={onMM}
      onMouseUp={onMU}
      onMouseLeave={onMU}
      onWheel={onWh}
    >
      {/* Controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-card/80 backdrop-blur border border-border rounded-md px-2 py-1">
        <button
          type="button"
          onClick={fit}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex items-center gap-1"
        >
          <Maximize2 className="h-3 w-3" />Fit
        </button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(tf.current.scale * 100)}%</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-3 bg-card/80 backdrop-blur border border-border rounded-md px-3 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-yellow-500" />Pending</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-red-500" />Failed</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress</span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done</span>
      </div>

      {/* Pannable/Zoomable inner */}
      <div
        ref={innerRef}
        className="absolute top-0 left-0"
        style={{ transformOrigin: "0 0", transform: `translate(${tf.current.x}px,${tf.current.y}px) scale(${tf.current.scale})` }}
      >
        {/* SVG Layer: sections, group boxes, ghost box, edges */}
        <svg
          width={svgW}
          height={svgH}
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }}
          viewBox={`${svgOX} ${svgOY} ${svgW} ${svgH}`}
        >
          <defs>
            <marker id="dag-div-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--muted-foreground)" opacity="0.5" />
            </marker>
            <marker id="dag-div-arrow-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="var(--primary)" />
            </marker>
          </defs>

          {/* Top group boxes */}
          {layout.topGroups.map((g) => (
            <g key={g.label}>
              <rect
                x={g.box!.x} y={g.box!.y}
                width={g.box!.w} height={g.box!.h}
                rx={12}
                fill={g.color} fillOpacity={0.03}
                stroke={g.color} strokeWidth={1.5}
                strokeDasharray="8 4" strokeOpacity={0.4}
              />
              <text
                x={g.box!.x + g.box!.w / 2} y={g.box!.y + 28}
                textAnchor="middle" fill={g.color}
                fontSize={11} fontWeight={700} letterSpacing="0.1em" opacity={0.5}
              >{g.label}</text>
            </g>
          ))}

          {/* Section boxes */}
          {layout.sections.map((sec) => (
            <g key={sec.key}>
              {!layout.hideLabelKeys.has(sec.key) && (
                <rect
                  x={sec.x} y={sec.y} width={sec.w} height={sec.h}
                  rx={8} fill="var(--muted)" opacity={0.3}
                  stroke={sec.color} strokeWidth={1} strokeOpacity={0.3}
                />
              )}
              {!layout.hideLabelKeys.has(sec.key) && (
                <text
                  x={sec.x + sec.w / 2} y={sec.y + 22}
                  textAnchor="middle" fill={sec.color}
                  fontSize={11} fontWeight={600} letterSpacing="0.05em" opacity={0.7}
                >{sec.label}</text>
              )}
              {sec.extra > 0 && (
                <text
                  x={sec.x + sec.w / 2} y={sec.h + sec.y - 8}
                  textAnchor="middle" fill="var(--muted-foreground)"
                  fontSize={10} opacity={0.6}
                >+{sec.extra} more</text>
              )}
            </g>
          ))}

          {/* Ghost box */}
          {layout.ghostBox && (
            <g>
              <rect
                x={layout.ghostBox.x} y={layout.ghostBox.y}
                width={layout.ghostBox.w} height={layout.ghostBox.h}
                rx={8} fill="var(--muted)" fillOpacity={0.3}
                stroke="#71717a" strokeWidth={1.5}
                strokeDasharray="8 4" opacity={0.6}
              />
              <text
                x={layout.ghostBox.x + layout.ghostBox.w / 2}
                y={layout.ghostBox.y + layout.ghostBox.h / 2 + 5}
                textAnchor="middle" fill="#a1a1aa"
                fontSize={13} fontWeight={500}
              >{layout.ghostBox.count} more</text>
            </g>
          )}

          {/* Edges — non-interactive paths (transparent hit area needs pointer events) */}
          {layout.edges.map((e) => {
            const k = `${e.fromId}-${e.toId}`;
            const h = hovEdge === k;
            const sameX = Math.abs(e.x1 - e.x2) < 10;
            let d: string;
            if (sameX) {
              const bulge = NODE_W * 0.4;
              d = `M ${e.x1} ${e.y1} C ${e.x1 + bulge} ${e.y1}, ${e.x2 + bulge} ${e.y2}, ${e.x2} ${e.y2}`;
            } else {
              const cp = Math.max(Math.abs(e.x2 - e.x1) * 0.4, 40);
              d = `M ${e.x1} ${e.y1} C ${e.x1 + cp} ${e.y1}, ${e.x2 - cp} ${e.y2}, ${e.x2} ${e.y2}`;
            }
            return (
              <g key={k} style={{ pointerEvents: "all" }}>
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHovEdge(k)}
                  onMouseLeave={() => setHovEdge(null)}
                />
                <path
                  d={d} fill="none"
                  stroke={h ? "var(--primary)" : "#ffffff"}
                  strokeWidth={h ? 2.5 : 1.5}
                  opacity={h ? 1 : 0.5}
                  markerEnd={h ? "url(#dag-div-arrow-hover)" : "url(#dag-div-arrow)"}
                  style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
                />
              </g>
            );
          })}

          {/* Ghost edge */}
          {layout.ghostEdge && (() => {
            const e = layout.ghostEdge!;
            const cp = Math.max(Math.abs(e.x2 - e.x1) * 0.4, 40);
            const d = `M ${e.x1} ${e.y1} C ${e.x1 + cp} ${e.y1}, ${e.x2 - cp} ${e.y2}, ${e.x2} ${e.y2}`;
            const h = hovEdge === "ghost";
            return (
              <g style={{ pointerEvents: "all" }}>
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth={14}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onMouseEnter={() => setHovEdge("ghost")}
                  onMouseLeave={() => setHovEdge(null)}
                />
                <path
                  d={d} fill="none"
                  stroke={h ? "var(--primary)" : "#ffffff"}
                  strokeWidth={h ? 2.5 : 1.5}
                  opacity={h ? 1 : 0.5}
                  markerEnd={h ? "url(#dag-div-arrow-hover)" : "url(#dag-div-arrow)"}
                  style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
                />
              </g>
            );
          })()}
        </svg>

        {/* Node divs — position:absolute */}
        {layout.nodes.map((n) => (
          <div
            key={n.id}
            className={cn(
              "absolute flex flex-col gap-1 p-2.5 rounded-lg border transition-all",
              n.req.status === "done" && "opacity-50",
              n.req.status === "rejected" && "opacity-50",
              n.isNextUp && "dag-node-next-up",
              (n.req.status === "in_progress" || n.req.status === "reviewing") && "dag-node-active",
            )}
            style={{
              left: n.x,
              top: n.y,
              width: NODE_W,
              height: NODE_H,
              borderColor: bc(n.req.status, n.isNextUp),
              background: "var(--card)",
              boxSizing: "border-box",
            }}
          >
            <div className="flex items-center gap-1.5">
              {n.req.status === "in_progress"
                ? <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
                : <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[n.req.status])} />
              }
              <span className="font-mono text-[10px] text-muted-foreground">{n.id}</span>
              <span className={cn("text-[9px] px-1 py-0.5 rounded border font-medium ml-auto shrink-0", PRIORITY_COLORS[n.req.priority])}>
                {n.req.priority}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (!pan.current?.moved) onClickItem(n.req); }}
                className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors shrink-0"
              >상세</button>
            </div>
            <span className="text-[11px] leading-snug line-clamp-2">{n.req.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
