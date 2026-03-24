"use client";

interface CpuMetricsProps {
  cpu: { user: number; system: number; idle: number };
}

function MetricRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-mono font-semibold" style={{ color }}>
        {value.toFixed(2)}%
      </span>
    </div>
  );
}

export function CpuMetrics({ cpu }: CpuMetricsProps) {
  return (
    <div className="space-y-3">
      <MetricRow label="시스템" value={cpu.system} color="#ef4444" />
      <MetricRow label="사용자" value={cpu.user} color="#3b82f6" />
      <MetricRow label="대기" value={cpu.idle} color="#6b7280" />
    </div>
  );
}
