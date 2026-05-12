import path from "path";
import { OUTPUT_DIR } from "../lib/config/paths";

export type PromptLogCategory = "create" | "work" | "suggest";

export function getPromptLogPath(opts: {
  category: PromptLogCategory;
  taskDisplayId?: string;
  filename: string;
}): string {
  const owner = opts.taskDisplayId ?? "_global";
  return path.join(
    OUTPUT_DIR,
    "prompt-logs",
    "tasks",
    owner,
    opts.category,
    opts.filename,
  );
}

export function getPromptRunLogPath(opts: {
  category: PromptLogCategory;
  taskDisplayId?: string;
  filename: string;
}): string {
  const owner = opts.taskDisplayId ?? "_global";
  return path.join(
    OUTPUT_DIR,
    "prompt-logs",
    "tasks",
    owner,
    opts.category,
    "runs",
    opts.filename,
  );
}
