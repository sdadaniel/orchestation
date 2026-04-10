import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../lib/paths";
import { getTask } from "../service/task-store";

export interface TaskLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

/**
 * Interface for conversation log entries (JSONL format)
 */
interface ConversationLogEntry {
  timestamp?: string;
  created_at?: string;
  role?: string;
  content?: string | unknown;
  [key: string]: unknown;
}

/**
 * Interface for task result data (JSON format)
 */
interface TaskResultData {
  timestamp?: string;
  created_at?: string;
  result?: unknown;
  is_error?: boolean;
  num_turns?: number;
  cost_usd?: number;
  [key: string]: unknown;
}

// OUTPUT_DIR is imported from paths.ts
const TOKEN_LOG = path.join(OUTPUT_DIR, "token-usage.log");

// TASK-ID format: alphanumeric with hyphens
const TASK_ID_REGEX = /^[A-Za-z0-9][\w-]*$/;

/**
 * Validate task ID format
 */
export function isValidTaskId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (id.length > 100) return false;
  return TASK_ID_REGEX.test(id);
}

/**
 * Check if a task exists in the database
 */
export function taskExists(taskId: string): boolean {
  return getTask(taskId) !== null;
}

/**
 * Parse token-usage.log lines for a specific task ID
 */
function parseTokenUsageLogs(taskId: string): TaskLogEntry[] {
  if (!fs.existsSync(TOKEN_LOG)) return [];

  const content = fs.readFileSync(TOKEN_LOG, "utf-8");
  const lines = content.split("\n");
  const entries: TaskLogEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this line contains the task ID
    // Format: [2026-03-23 12:15:45] TASK-029 | phase=task | ...
    const timestampMatch = trimmed.match(
      /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]\s+([\w-]+)\s+\|/
    );
    if (!timestampMatch) continue;
    if (timestampMatch[2] !== taskId) continue;

    const timestamp = timestampMatch[1] ?? "";

    // Extract phase
    const phaseMatch = trimmed.match(/phase=(\w+)/);
    const phase = phaseMatch ? phaseMatch[1] : "unknown";

    // Extract cost
    const costMatch = trimmed.match(/cost=\$([\d.]+)/);
    const cost = costMatch ? costMatch[1] : "0";

    // Extract duration
    const durationMatch = trimmed.match(/duration=(\d+)ms/);
    const duration = durationMatch ? durationMatch[1] : "0";

    // Extract turns
    const turnsMatch = trimmed.match(/turns=(\d+)/);
    const turns = turnsMatch ? turnsMatch[1] : "0";

    const message = `phase=${phase} | turns=${turns} | duration=${duration}ms | cost=$${cost}`;

    entries.push({
      timestamp,
      level: "info",
      message,
    });
  }

  return entries;
}

/**
 * Parse JSONL conversation files for a specific task ID
 */
function parseConversationLogs(taskId: string): TaskLogEntry[] {
  const entries: TaskLogEntry[] = [];
  const suffixes = ["-task-conversation.jsonl", "-review-conversation.jsonl"];

  for (const suffix of suffixes) {
    const filePath = path.join(OUTPUT_DIR, `${taskId}${suffix}`);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const phase = suffix.includes("task") ? "task" : "review";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry: ConversationLogEntry = JSON.parse(trimmed);
        const timestamp =
          entry.timestamp ||
          entry.created_at ||
          new Date().toISOString().replace("T", " ").substring(0, 19);
        const role = entry.role || "system";
        const msg =
          typeof entry.content === "string"
            ? entry.content.substring(0, 500)
            : `[${phase}] ${role} message`;

        entries.push({
          timestamp,
          level: role === "error" ? "error" : "info",
          message: msg,
        });
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  return entries;
}

/**
 * Parse task result JSON files
 */
function parseResultLogs(taskId: string): TaskLogEntry[] {
  const entries: TaskLogEntry[] = [];
  const suffixes = ["-task.json", "-review.json"];

  for (const suffix of suffixes) {
    const filePath = path.join(OUTPUT_DIR, `${taskId}${suffix}`);
    if (!fs.existsSync(filePath)) continue;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data: TaskResultData = JSON.parse(content);
      const phase = suffix.includes("task") ? "task" : "review";
      const timestamp =
        data.timestamp ||
        data.created_at ||
        new Date().toISOString().replace("T", " ").substring(0, 19);

      const resultStatus = data.result || data.is_error ? "error" : "success";
      const level = data.is_error ? "error" : "info";

      entries.push({
        timestamp,
        level,
        message: `[${phase}] result=${resultStatus}${data.num_turns ? ` turns=${data.num_turns}` : ""}${data.cost_usd ? ` cost=$${data.cost_usd}` : ""}`,
      });
    } catch {
      // Skip malformed JSON
    }
  }

  return entries;
}

/**
 * Parse orchestration signal logs (if they exist)
 */
function parseSignalLogs(taskId: string): TaskLogEntry[] {
  // Worker logs stored in output/logs/ by orchestrate engine
  const logFile = path.join(OUTPUT_DIR, "logs", `${taskId}.log`);
  if (!fs.existsSync(logFile)) return [];

  const content = fs.readFileSync(logFile, "utf-8");
  const lines = content.split("\n");
  const entries: TaskLogEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try to extract timestamp from common log formats
    const tsMatch = trimmed.match(
      /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\]?\s*(.*)/
    );

    if (tsMatch) {
      const timestamp = (tsMatch[1] ?? "").replace("T", " ");
      const msg = tsMatch[2] ?? "";
      const level = /error|fail|exception/i.test(msg) ? "error" : /warn/i.test(msg) ? "warn" : "info";
      entries.push({ timestamp, level, message: msg });
    } else {
      entries.push({
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        level: "info",
        message: trimmed,
      });
    }
  }

  return entries;
}

/**
 * Get all logs for a specific task, sorted by timestamp
 */
export function getTaskLogs(taskId: string): TaskLogEntry[] {
  const allEntries: TaskLogEntry[] = [
    ...parseTokenUsageLogs(taskId),
    ...parseConversationLogs(taskId),
    ...parseResultLogs(taskId),
    ...parseSignalLogs(taskId),
  ];

  // Sort by timestamp
  allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return allEntries;
}

/**
 * Check if any log sources exist for a task
 */
export function hasLogSources(taskId: string): boolean {
  // Check token-usage.log for entries
  if (fs.existsSync(TOKEN_LOG)) {
    const content = fs.readFileSync(TOKEN_LOG, "utf-8");
    if (content.includes(taskId)) return true;
  }

  // Check output files
  const suffixes = [
    "-task-conversation.jsonl",
    "-review-conversation.jsonl",
    "-task.json",
    "-review.json",
  ];
  for (const suffix of suffixes) {
    if (fs.existsSync(path.join(OUTPUT_DIR, `${taskId}${suffix}`))) return true;
  }
  // Check worker log in output/logs/
  if (fs.existsSync(path.join(OUTPUT_DIR, "logs", `${taskId}.log`))) return true;

  return false;
}
