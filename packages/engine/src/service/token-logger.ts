import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/config/paths";
import { getWritableDb } from "./db";

export interface TokenUsageResult {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  cacheCreate?: number;
  cacheRead?: number;
  turns?: number;
}

function formatLocalTimestampForCostLog(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function logTokenUsage(
  taskId: string,
  phase: string,
  model: string,
  result: TokenUsageResult,
  stepId?: string,
): void {
  const ts = formatLocalTimestampForCostLog(new Date());
  const cacheCreate = Math.max(0, Math.trunc(result.cacheCreate ?? 0));
  const cacheRead = Math.max(0, Math.trunc(result.cacheRead ?? 0));
  const turns = Math.max(0, Math.trunc(result.turns ?? 0));
  const input = Math.max(0, Math.trunc(result.inputTokens ?? 0));
  const output = Math.max(0, Math.trunc(result.outputTokens ?? 0));
  const durationMs = Math.max(0, Math.trunc(result.durationMs ?? 0));

  // Must match cost-parser.ts LOG_LINE_REGEX_WITH_MODEL
  // [YYYY-MM-DD HH:MM:SS] TASK-XXX | phase=task | model=... | input=.. cache_create=.. cache_read=.. output=.. | turns=.. | duration=..ms | cost=$..
  const logLine =
    `[${ts}] ${taskId} | phase=${phase} | model=${model} | ` +
    `input=${input} cache_create=${cacheCreate} cache_read=${cacheRead} output=${output} | ` +
    `turns=${turns} | duration=${durationMs}ms | cost=$${Number(result.costUsd ?? 0).toFixed(6)}\n`;

  try {
    const logPath = path.join(OUTPUT_DIR, "token-usage.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logLine);
  } catch {
    /* ignore */
  }

  try {
    const db = getWritableDb();
    if (db) {
      db.prepare(
        `INSERT INTO token_usage (task_id, step_id, phase, model, input_tokens, output_tokens, cost_usd, duration_ms, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        taskId,
        stepId ?? null,
        phase,
        model,
        result.inputTokens,
        result.outputTokens,
        result.costUsd,
        result.durationMs,
        new Date().toISOString(),
      );
    }
  } catch {
    /* ignore */
  }
}
