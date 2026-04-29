import type { MonitorSnapshot } from "@/hooks/useMonitor";

export interface MetricCardProps {
  title: string;
  unit?: string;
  value: string;
  subtitle?: string;
  color: string;
  secondColor?: string;
  history: number[];
  secondHistory?: number[];
  legend?: [string, string];
  max?: number;
  large?: boolean;
}

export interface ProcessMetricsProps {
  current: MonitorSnapshot;
  history: MonitorSnapshot[];
}
