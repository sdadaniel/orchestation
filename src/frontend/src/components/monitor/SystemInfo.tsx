"use client";

interface SystemInfoProps {
  threadCount: number;
  processCount: number;
  cpuCores: number;
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-mono font-semibold text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

export function SystemInfo({ threadCount, processCount, cpuCores }: SystemInfoProps) {
  return (
    <div className="space-y-3">
      <InfoRow label="스레드" value={threadCount} />
      <InfoRow label="프로세스" value={processCount} />
      <InfoRow label="CPU 코어" value={cpuCores} />
    </div>
  );
}
