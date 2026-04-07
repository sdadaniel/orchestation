import fs from "fs";
import path from "path";

export interface RunHistoryEntry {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "failed";
  exitCode: number | null;
  taskResults: { taskId: string; status: "success" | "failure" }[];
  totalCostUsd: number;
  totalDurationMs: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export interface RunHistoryData {
  runs: RunHistoryEntry[];
}

const HISTORY_FILE = path.join(process.cwd(), "../../output/run-history.json");

export function readRunHistory(): RunHistoryData {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return { runs: [] };
    }
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.runs)) {
      return { runs: [] };
    }
    return parsed as RunHistoryData;
  } catch {
    return { runs: [] };
  }
}

export function appendRunHistory(entry: RunHistoryEntry): void {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const history = readRunHistory();
  history.runs.push(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}
