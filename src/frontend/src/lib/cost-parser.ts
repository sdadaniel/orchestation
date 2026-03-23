import fs from "fs";
import path from "path";

export interface CostEntry {
  timestamp: string;
  taskId: string;
  phase: string;
  inputTokens: number;
  cacheCreate: number;
  cacheRead: number;
  outputTokens: number;
  turns: number;
  durationMs: number;
  costUsd: number;
}

export interface TaskCostSummary {
  taskId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreate: number;
  totalCacheRead: number;
  totalTurns: number;
  totalDurationMs: number;
  totalCostUsd: number;
  entries: number;
}

export interface CostData {
  entries: CostEntry[];
  summaryByTask: TaskCostSummary[];
}

// Log format:
// [2026-03-23 12:15:45] TASK-029 | phase=task | input=1500 cache_create=100 cache_read=0 output=2400 | turns=3 | duration=5230ms | cost=$0.045
const LOG_LINE_REGEX =
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+([\w-]+)\s+\|\s+phase=(\w+)\s+\|\s+input=(\d+)\s+cache_create=(\d+)\s+cache_read=(\d+)\s+output=(\d+)\s+\|\s+turns=(\d+)\s+\|\s+duration=(\d+)ms\s+\|\s+cost=\$([\d.]+)/;

const LOG_FILE = path.join(process.cwd(), "../../output/token-usage.log");

export function parseCostLogLine(line: string): CostEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(LOG_LINE_REGEX);
  if (!match) return null;

  return {
    timestamp: match[1],
    taskId: match[2],
    phase: match[3],
    inputTokens: parseInt(match[4], 10),
    cacheCreate: parseInt(match[5], 10),
    cacheRead: parseInt(match[6], 10),
    outputTokens: parseInt(match[7], 10),
    turns: parseInt(match[8], 10),
    durationMs: parseInt(match[9], 10),
    costUsd: parseFloat(match[10]),
  };
}

export function parseCostLog(): CostData {
  if (!fs.existsSync(LOG_FILE)) {
    return { entries: [], summaryByTask: [] };
  }

  const content = fs.readFileSync(LOG_FILE, "utf-8");
  const lines = content.split("\n");
  const entries: CostEntry[] = [];

  for (const line of lines) {
    const entry = parseCostLogLine(line);
    if (entry) {
      entries.push(entry);
    }
  }

  const summaryByTask = aggregateByTask(entries);

  return { entries, summaryByTask };
}

function aggregateByTask(entries: CostEntry[]): TaskCostSummary[] {
  const map = new Map<string, TaskCostSummary>();

  for (const e of entries) {
    let summary = map.get(e.taskId);
    if (!summary) {
      summary = {
        taskId: e.taskId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreate: 0,
        totalCacheRead: 0,
        totalTurns: 0,
        totalDurationMs: 0,
        totalCostUsd: 0,
        entries: 0,
      };
      map.set(e.taskId, summary);
    }
    summary.totalInputTokens += e.inputTokens;
    summary.totalOutputTokens += e.outputTokens;
    summary.totalCacheCreate += e.cacheCreate;
    summary.totalCacheRead += e.cacheRead;
    summary.totalTurns += e.turns;
    summary.totalDurationMs += e.durationMs;
    summary.totalCostUsd = parseFloat(
      (summary.totalCostUsd + e.costUsd).toFixed(6)
    );
    summary.entries += 1;
  }

  return Array.from(map.values());
}
