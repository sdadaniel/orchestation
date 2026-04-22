import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/paths";

export interface CostEntry {
  timestamp: string;
  taskId: string;
  phase?: string;
  model: string;
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
  models: string;
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

// Log format (new, with model):
// [2026-03-23 12:15:45] TASK-029 | phase=task | model=claude-sonnet-4-20250514 | input=1500 cache_create=100 cache_read=0 output=2400 | turns=3 | duration=5230ms | cost=$0.045
// Log format (legacy, without model):
// [2026-03-23 12:15:45] TASK-029 | phase=task | input=1500 cache_create=100 cache_read=0 output=2400 | turns=3 | duration=5230ms | cost=$0.045
const LOG_LINE_REGEX_WITH_MODEL =
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+([\w-]+)\s+\|\s+phase=(\w+)\s+\|\s+model=([\w.:/\[\]-]+)\s+\|\s+input=(\d+)\s+cache_create=(\d+)\s+cache_read=(\d+)\s+output=(\d+)\s+\|\s+turns=(\d+)\s+\|\s+duration=(\d+)ms\s+\|\s+cost=\$([\d.]+)/;
const LOG_LINE_REGEX_LEGACY =
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+([\w-]+)\s+\|\s+phase=(\w+)\s+\|\s+input=(\d+)\s+cache_create=(\d+)\s+cache_read=(\d+)\s+output=(\d+)\s+\|\s+turns=(\d+)\s+\|\s+duration=(\d+)ms\s+\|\s+cost=\$([\d.]+)/;

const LOG_FILE = path.join(OUTPUT_DIR, "token-usage.log");

export function parseCostLogLine(line: string): CostEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try new format with model first
  const matchWithModel = trimmed.match(LOG_LINE_REGEX_WITH_MODEL);
  if (matchWithModel) {
    return {
      timestamp: matchWithModel[1] ?? "",
      taskId: matchWithModel[2] ?? "",
      phase: matchWithModel[3] ?? "",
      model: matchWithModel[4] ?? "",
      inputTokens: parseInt(matchWithModel[5] ?? "0", 10),
      cacheCreate: parseInt(matchWithModel[6] ?? "0", 10),
      cacheRead: parseInt(matchWithModel[7] ?? "0", 10),
      outputTokens: parseInt(matchWithModel[8] ?? "0", 10),
      turns: parseInt(matchWithModel[9] ?? "0", 10),
      durationMs: parseInt(matchWithModel[10] ?? "0", 10),
      costUsd: parseFloat(matchWithModel[11] ?? "0"),
    };
  }

  // Fall back to legacy format without model
  const matchLegacy = trimmed.match(LOG_LINE_REGEX_LEGACY);
  if (!matchLegacy) return null;

  return {
    timestamp: matchLegacy[1] ?? "",
    taskId: matchLegacy[2] ?? "",
    phase: matchLegacy[3] ?? "",
    model: "unknown",
    inputTokens: parseInt(matchLegacy[4] ?? "0", 10),
    cacheCreate: parseInt(matchLegacy[5] ?? "0", 10),
    cacheRead: parseInt(matchLegacy[6] ?? "0", 10),
    outputTokens: parseInt(matchLegacy[7] ?? "0", 10),
    turns: parseInt(matchLegacy[8] ?? "0", 10),
    durationMs: parseInt(matchLegacy[9] ?? "0", 10),
    costUsd: parseFloat(matchLegacy[10] ?? "0"),
  };
}

export function parseCostLog(): CostData {
  if (!fs.existsSync(LOG_FILE)) {
    return { entries: [], summaryByTask: [] };
  }

  const content = fs.readFileSync(LOG_FILE, "utf-8");
  const entries: CostEntry[] = [];

  for (const line of content.split("\n")) {
    // model_selection 로그는 비용이 아니므로 제외
    if (line.includes("model_selection")) continue;
    const entry = parseCostLogLine(line);
    if (entry) {
      entries.push(entry);
    }
  }

  // 최신순 정렬
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const summaryByTask = aggregateByTask(entries);

  return { entries, summaryByTask };
}

export function aggregateByTask(entries: CostEntry[]): TaskCostSummary[] {
  const map = new Map<string, TaskCostSummary>();
  const modelsMap = new Map<string, Set<string>>();

  for (const e of entries) {
    let summary = map.get(e.taskId);
    if (!summary) {
      summary = {
        taskId: e.taskId,
        models: "",
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
      modelsMap.set(e.taskId, new Set());
    }
    if (e.model && e.model !== "unknown") {
      modelsMap.get(e.taskId)!.add(e.model);
    }
    summary.totalInputTokens += e.inputTokens;
    summary.totalOutputTokens += e.outputTokens;
    summary.totalCacheCreate += e.cacheCreate;
    summary.totalCacheRead += e.cacheRead;
    summary.totalTurns += e.turns;
    summary.totalDurationMs += e.durationMs;
    summary.totalCostUsd = parseFloat(
      (summary.totalCostUsd + e.costUsd).toFixed(6),
    );
    summary.entries += 1;
  }

  // Set comma-separated model names on each summary
  for (const [taskId, summary] of map) {
    const models = modelsMap.get(taskId)!;
    summary.models =
      models.size > 0 ? Array.from(models).join(", ") : "unknown";
  }

  return Array.from(map.values());
}
