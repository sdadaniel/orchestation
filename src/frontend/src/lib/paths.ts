import fs from "fs";
import path from "path";

export const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");

export const TASKS_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "tasks");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "docs", "task");
})();

export const OUTPUT_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "output");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "output");
})();
