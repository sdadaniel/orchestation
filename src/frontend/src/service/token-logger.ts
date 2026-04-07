import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/paths";
import { getDb } from "./db";

export interface TokenUsageResult {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export function logTokenUsage(
  taskId: string,
  phase: string,
  model: string,
  result: TokenUsageResult,
): void {
  const logLine = `[${new Date().toISOString()}] ${taskId} | phase=${phase} | model=${model} | input=${result.inputTokens} | output=${result.outputTokens} | cost=$${result.costUsd.toFixed(4)} | duration=${result.durationMs}ms\n`;

  try {
    const logPath = path.join(OUTPUT_DIR, "token-usage.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, logLine);
  } catch { /* ignore */ }

  try {
    const db = getDb();
    if (db) {
      db.prepare(
        `INSERT INTO token_usage (task_id, phase, model, input_tokens, output_tokens, cost_usd, duration_ms, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(taskId, phase, model, result.inputTokens, result.outputTokens, result.costUsd, result.durationMs, new Date().toISOString());
    }
  } catch { /* ignore */ }
}
