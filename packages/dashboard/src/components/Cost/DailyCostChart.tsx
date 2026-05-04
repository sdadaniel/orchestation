"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipValueType } from "recharts";
import type { CostEntry } from "@/parser/cost-parser";
import type { ChartDataPoint, CostChartRange, DailyCostChartProps } from "./types";
import { cn } from "@/lib/utils";

const RANGES: { id: CostChartRange; label: string }[] = [
  { id: "1D", label: "1일" },
  { id: "1W", label: "1주" },
  { id: "1M", label: "1달" },
  { id: "ALL", label: "전체" },
];

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

/** 기간·틱 밀도와 무관하게 동일 레이아웃 유지 (라벨/기울임 대비 여유 고정) */
const CHART_PLOT_HEIGHT_PX = 220;
const CHART_MARGIN = {
  top: 10,
  right: 12,
  bottom: 54,
  left: 38,
} as const;
const X_AXIS_TICK_HEIGHT = 56;

function ChartRangeToolbar({
  toolbarStart,
  range,
  onRange,
  endContent,
}: {
  toolbarStart?: ReactNode;
  range: CostChartRange;
  onRange: (r: CostChartRange) => void;
  endContent?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        {toolbarStart}
        {toolbarStart ? (
          <span
            className="hidden sm:block w-px shrink-0 self-stretch bg-border opacity-80"
            aria-hidden
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {RANGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onRange(id)}
              className={cn(
                "filter-pill text-[11px]",
                range === id && "active",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {endContent}
    </div>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseCostTimestamp(ts: string): Date | null {
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function floorToHour(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), 0, 0, 0);
}

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getRangeBounds(
  entries: CostEntry[],
  range: CostChartRange,
): { rangeStart: Date; end: Date } | null {
  let minT: Date | null = null;
  let maxT: Date | null = null;
  for (const e of entries) {
    const d = parseCostTimestamp(e.timestamp);
    if (!d) continue;
    if (!minT || d < minT) minT = d;
    if (!maxT || d > maxT) maxT = d;
  }
  if (!minT || !maxT) return null;

  const end = maxT;
  if (range === "ALL") {
    return { rangeStart: startOfDay(minT), end };
  }
  const delta =
    range === "1D" ? MS_DAY : range === "1W" ? 7 * MS_DAY : 30 * MS_DAY;
  return { rangeStart: new Date(end.getTime() - delta), end };
}

function inWindow(d: Date, rangeStart: Date, end: Date): boolean {
  return d >= rangeStart && d <= end;
}

function dayAxisLabel(dateKey: string, multiYear: boolean): string {
  return multiYear ? dateKey : dateKey.slice(5);
}

function buildHourlySeries(
  entries: CostEntry[],
  rangeStart: Date,
  end: Date,
): ChartDataPoint[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const d = parseCostTimestamp(e.timestamp);
    if (!d || !inWindow(d, rangeStart, end)) continue;
    const hk = `${dayKeyFromDate(d)} ${pad2(d.getHours())}`;
    sums.set(hk, (sums.get(hk) ?? 0) + e.costUsd);
  }

  const hourStart = floorToHour(rangeStart);
  const points: ChartDataPoint[] = [];
  for (let cur = new Date(hourStart); cur <= end; cur = new Date(cur.getTime() + MS_HOUR)) {
    const hk = `${dayKeyFromDate(cur)} ${pad2(cur.getHours())}`;
    const raw = sums.get(hk) ?? 0;
    const prev = points[points.length - 1];
    const prevDay = prev ? prev.bucketKey.slice(0, 10) : "";
    const curDay = dayKeyFromDate(cur);
    const label =
      prev && prevDay !== curDay
        ? `${pad2(cur.getMonth() + 1)}/${pad2(cur.getDate())} ${pad2(cur.getHours())}:00`
        : `${pad2(cur.getHours())}:00`;
    points.push({
      bucketKey: `${hk}:00`,
      label,
      costUsd: parseFloat(raw.toFixed(4)),
    });
  }
  return points;
}

function buildDailySeries(
  entries: CostEntry[],
  rangeStart: Date,
  end: Date,
): ChartDataPoint[] {
  const sums = new Map<string, number>();
  for (const e of entries) {
    const d = parseCostTimestamp(e.timestamp);
    if (!d || !inWindow(d, rangeStart, end)) continue;
    const dk = dayKeyFromDate(d);
    sums.set(dk, (sums.get(dk) ?? 0) + e.costUsd);
  }

  const keys: string[] = [];
  const walk = startOfDay(rangeStart);
  const lastDay = startOfDay(end);
  for (let d = new Date(walk); d <= lastDay; d.setDate(d.getDate() + 1)) {
    keys.push(dayKeyFromDate(d));
  }

  const years = new Set(keys.map((k) => k.slice(0, 4)));
  const multiYear = years.size > 1;

  return keys.map((dateKey) => ({
    bucketKey: dateKey,
    label: dayAxisLabel(dateKey, multiYear),
    costUsd: parseFloat((sums.get(dateKey) ?? 0).toFixed(4)),
  }));
}

function buildChartData(
  entries: CostEntry[],
  range: CostChartRange,
): ChartDataPoint[] {
  const bounds = getRangeBounds(entries, range);
  if (!bounds) return [];
  const { rangeStart, end } = bounds;
  if (range === "1D") {
    return buildHourlySeries(entries, rangeStart, end);
  }
  return buildDailySeries(entries, rangeStart, end);
}

export function DailyCostChart({
  entries,
  toolbarStart,
}: DailyCostChartProps) {
  const [range, setRange] = useState<CostChartRange>("ALL");

  const data = useMemo(
    () => buildChartData(entries, range),
    [entries, range],
  );

  const periodTotal = useMemo(
    () => data.reduce((sum, d) => sum + d.costUsd, 0),
    [data],
  );

  const denseX = data.length > 12;
  const bucketHint =
    range === "1D" ? `${data.length}시간 구간` : `${data.length}일`;

  /** SVG `fill`에는 `var(--token)`만 쓴다. `hsl(var(--token))`는 hex 토큰이면 무효라 라벨이 안 보인다. */
  const axisCaptionStyle = {
    fontSize: 11,
    fill: "var(--foreground)",
    fillOpacity: 0.72,
    fontWeight: 600,
  } as const;
  const tickFill = "var(--muted-foreground)";
  const axisStroke = "var(--border)";
  const xCaption = range === "1D" ? "시간" : "날짜";

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground font-medium">
          비용 추이
        </span>
        <ChartRangeToolbar
          toolbarStart={toolbarStart}
          range={range}
          onRange={setRange}
        />
        <div
          className="flex w-full shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
          style={{ height: CHART_PLOT_HEIGHT_PX }}
        >
          표시할 비용 기록이 없습니다.
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground font-medium">
          비용 추이
        </span>
        <ChartRangeToolbar
          toolbarStart={toolbarStart}
          range={range}
          onRange={setRange}
        />
        <p className="text-xs text-muted-foreground">
          선택한 기간에 비용 기록이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs text-muted-foreground font-medium">
        비용 추이
      </span>
      <ChartRangeToolbar
        toolbarStart={toolbarStart}
        range={range}
        onRange={setRange}
        endContent={
          <span className="text-[10px] text-muted-foreground sm:text-right">
            합계: ${periodTotal.toFixed(4)} · {bucketHint}
          </span>
        }
      />
      <div
        className="w-full shrink-0 min-w-0 outline-none [&_*]:outline-none [&_*:focus]:outline-none [&_*:focus-visible]:outline-none [&_svg]:outline-none"
        style={{ height: CHART_PLOT_HEIGHT_PX }}
        onMouseDown={(e) => {
          const t = e.target;
          if (t instanceof Element && t.closest(".recharts-wrapper")) {
            e.preventDefault();
          }
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
          className="[&_.recharts-wrapper]:outline-none [&_svg]:outline-none"
        >
          <AreaChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={axisStroke}
              opacity={0.4}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: tickFill }}
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
              interval="preserveStartEnd"
              angle={denseX ? -35 : 0}
              textAnchor={denseX ? "end" : "middle"}
              height={X_AXIS_TICK_HEIGHT}
              label={{
                value: xCaption,
                position: "insideBottom",
                offset: -6,
                style: axisCaptionStyle,
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: tickFill }}
              tickLine={false}
              axisLine={{ stroke: axisStroke }}
              tickFormatter={(value: number) => `$${value.toFixed(2)}`}
              width={52}
              domain={[0, "auto"]}
              label={{
                value: "비용 (USD)",
                angle: -90,
                position: "left",
                offset: 6,
                style: axisCaptionStyle,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "11px",
                color: "var(--foreground)",
              }}
              formatter={(value: TooltipValueType | undefined) => [
                `$${Number(value ?? 0).toFixed(4)}`,
                range === "1D" ? "해당 시간 비용" : "해당 일 비용",
              ]}
              labelFormatter={(_, payload) => {
                const point = payload?.[0]?.payload as ChartDataPoint | undefined;
                return point?.bucketKey ?? "";
              }}
            />
            <Area
              type="monotone"
              dataKey="costUsd"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="var(--primary)"
              fillOpacity={0.14}
              dot={data.length <= 36}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
