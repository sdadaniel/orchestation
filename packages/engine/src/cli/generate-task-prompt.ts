#!/usr/bin/env tsx
/**
 * Generate the exact worker-task prompt for a task without running Claude.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { PROJECT_ROOT } from "../lib/config/paths";
import { parseTaskExecutionHints } from "../lib/task-execution-hints";
import { parseContext, parseScope } from "../lib/task-row-parsers";
import { buildTaskPrompt } from "../orchestrate/ops/context-builder";
import { getTask, getTaskDisplayId, taskRowToMarkdown } from "../service/task-store";
import { getPromptLogPath } from "./prompt-log-paths";

type CliOptions = {
  taskRef?: string;
  stdout: boolean;
};

function printUsage(): void {
  console.error(
    [
      "Usage: generate-task-prompt.ts <taskId|TASK-###|###> [--stdout]",
      "",
      "Examples:",
      "  pnpm tsx src/cli/generate-task-prompt.ts 369",
      "  pnpm tsx src/cli/generate-task-prompt.ts TASK-369 --stdout",
    ].join("\n"),
  );
}

function normalizeTaskRef(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return `TASK-${trimmed.padStart(3, "0")}`;
  return trimmed;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { stdout: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--stdout") {
      options.stdout = true;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (options.taskRef) throw new Error(`Unexpected extra argument: ${arg}`);
    options.taskRef = normalizeTaskRef(arg);
  }

  return options;
}

function pathBase(pattern: string): string {
  return pattern
    .replace(/\*\*.*/, "")
    .replace(/\*.*/, "")
    .replace(/\/$/, "");
}

function hasAnyPromptContextPath(root: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const base = pathBase(pattern);
    if (!base) return false;
    return fs.existsSync(path.join(root, base));
  });
}

export function writeWorkerTaskPromptLog(
  taskRef: string,
  opts?: { stdout?: boolean },
): string {
  const task = getTask(normalizeTaskRef(taskRef));
  if (!task) throw new Error(`Task not found: ${taskRef}`);

  const taskDisplayId = getTaskDisplayId(task);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestration-task-prompt-"));
  const tmpTaskFile = path.join(tmpDir, `${taskDisplayId}-task.md`);

  try {
    fs.writeFileSync(tmpTaskFile, taskRowToMarkdown(task));

    const taskWorktreePath = task.worktree
      ? path.resolve(PROJECT_ROOT, task.worktree)
      : null;
    const promptPaths = [...parseScope(task), ...parseContext(task)];
    const worktreePath =
      taskWorktreePath &&
      fs.existsSync(taskWorktreePath) &&
      hasAnyPromptContextPath(taskWorktreePath, promptPaths)
        ? taskWorktreePath
        : PROJECT_ROOT;
    if (taskWorktreePath && worktreePath === PROJECT_ROOT) {
      console.error(
        `Worktree prompt paths not found, using PROJECT_ROOT for injected file contents: ${taskWorktreePath}`,
      );
    }
    const prompt = buildTaskPrompt({
      taskFile: tmpTaskFile,
      taskFilename: `${taskDisplayId}-task.md`,
      scope: parseScope(task),
      context: parseContext(task),
      executionHints: parseTaskExecutionHints(task.content),
      worktreePath,
    });

    if (opts?.stdout) {
      process.stdout.write(prompt);
      if (!prompt.endsWith("\n")) process.stdout.write("\n");
    }

    const outFile = getPromptLogPath({
      category: "work",
      taskDisplayId,
      filename: "worker-task.md",
    });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, prompt);
    console.error(`Prompt written: ${outFile}`);
    return outFile;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function isCliEntry(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === path.resolve(fileURLToPath(import.meta.url));
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (!options.taskRef) {
    printUsage();
    process.exit(1);
  }

  writeWorkerTaskPromptLog(options.taskRef, { stdout: options.stdout });
}

if (isCliEntry()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
