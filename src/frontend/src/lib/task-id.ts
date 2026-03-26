import fs from "fs";

/**
 * Scans `dir` for files matching TASK-XXX*.md and returns the next
 * available TASK-XXX id (zero-padded to 3 digits).
 */
export function generateNextTaskId(dir: string): string {
  const existingFiles = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("TASK-") && f.endsWith(".md"));

  let maxNum = 0;
  for (const f of existingFiles) {
    const m = f.match(/TASK-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `TASK-${String(nextNum).padStart(3, "0")}`;
}
