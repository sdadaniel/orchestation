#!/usr/bin/env tsx
/**
 * Run a saved prompt with Claude and tee stream-json output into prompt-logs.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../lib/config/paths";
import { getTask, getTaskDisplayId } from "../service/task-store";
import {
  getPromptLogPath,
  getPromptRunLogPath,
  type PromptLogCategory,
} from "./prompt-log-paths";
import { writeTaskCreatePromptFromTask } from "./generate-task-create-prompt";
import { writeWorkerTaskPromptLog } from "./generate-task-prompt";

type PromptKind = "work" | "create" | "refine" | "suggest";

type CliOptions = {
  taskRef?: string;
  promptFile?: string;
  kind: PromptKind;
  cwd?: string;
  model?: string;
  skipPermissions: boolean;
};

function printUsage(): void {
  console.error(
    [
      "Usage: run-prompt-log.ts [--task <taskId|TASK-###|###>] [--kind work|create|refine|suggest]",
      "       run-prompt-log.ts --prompt <file>",
      "",
      "Options:",
      "  --task <taskId|TASK-###|###>  Use a generated prompt-log file for the task",
      "  --kind <kind>                 Prompt kind (default: work)",
      "  --prompt <file>               Run an explicit prompt file",
      "  --cwd <dir>                   Claude working directory (default: project root)",
      "  --model <model>               Pass --model to Claude",
      "  --skip-permissions            Pass --dangerously-skip-permissions to Claude",
      "",
      "Examples:",
      "  pnpm tsx src/cli/run-prompt-log.ts --task 369",
      "  pnpm tsx src/cli/run-prompt-log.ts --task 369 --kind create",
      "  pnpm tsx src/cli/run-prompt-log.ts --prompt .orchestration/output/prompt-logs/tasks/TASK-369/work/worker-task.md",
    ].join("\n"),
  );
}

function normalizeTaskRef(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return `TASK-${trimmed.padStart(3, "0")}`;
  return trimmed;
}

function parseKind(value: string): PromptKind {
  if (
    value === "work" ||
    value === "create" ||
    value === "refine" ||
    value === "suggest"
  ) {
    return value;
  }
  throw new Error(`Invalid --kind: ${value}`);
}

function readOptionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    kind: "work",
    skipPermissions: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--skip-permissions") {
      options.skipPermissions = true;
      continue;
    }
    if (arg === "--task") {
      options.taskRef = normalizeTaskRef(readOptionValue(argv, i, arg));
      i += 1;
      continue;
    }
    if (arg.startsWith("--task=")) {
      options.taskRef = normalizeTaskRef(arg.slice("--task=".length));
      continue;
    }
    if (arg === "--kind") {
      options.kind = parseKind(readOptionValue(argv, i, arg));
      i += 1;
      continue;
    }
    if (arg.startsWith("--kind=")) {
      options.kind = parseKind(arg.slice("--kind=".length));
      continue;
    }
    if (arg === "--prompt") {
      options.promptFile = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--prompt=")) {
      options.promptFile = arg.slice("--prompt=".length);
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--cwd=")) {
      options.cwd = arg.slice("--cwd=".length);
      continue;
    }
    if (arg === "--model") {
      options.model = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--model=")) {
      options.model = arg.slice("--model=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function promptInfoForKind(kind: PromptKind): {
  category: PromptLogCategory;
  promptFilename: string;
} {
  switch (kind) {
    case "work":
      return { category: "work", promptFilename: "worker-task.md" };
    case "create":
      return { category: "create", promptFilename: "task-analyze.md" };
    case "refine":
      return { category: "create", promptFilename: "task-analyze-refine.md" };
    case "suggest":
      return { category: "suggest", promptFilename: "task-suggest.md" };
  }
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function resolveTaskDisplayId(taskRef?: string): string | undefined {
  if (!taskRef) return undefined;
  const task = getTask(taskRef);
  if (!task) throw new Error(`Task not found: ${taskRef}`);
  return getTaskDisplayId(task);
}

function resolvePromptFile(options: CliOptions): {
  promptFile: string;
  category: PromptLogCategory;
  taskDisplayId?: string;
} {
  const { category, promptFilename } = promptInfoForKind(options.kind);
  const taskDisplayId = resolveTaskDisplayId(options.taskRef);

  if (options.promptFile) {
    return {
      promptFile: path.resolve(PROJECT_ROOT, options.promptFile),
      category,
      taskDisplayId,
    };
  }

  if (options.kind !== "suggest" && !taskDisplayId) {
    throw new Error("--task is required unless --prompt is provided");
  }

  return {
    promptFile: getPromptLogPath({
      category,
      taskDisplayId,
      filename: promptFilename,
    }),
    category,
    taskDisplayId,
  };
}

function ensurePromptFile(options: CliOptions, promptFile: string): void {
  if (fs.existsSync(promptFile)) return;

  if (options.promptFile) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  if (!options.taskRef) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  switch (options.kind) {
    case "work":
      console.error(`프롬프트가 없어 worker-task.md를 생성합니다: ${promptFile}`);
      writeWorkerTaskPromptLog(options.taskRef);
      break;
    case "create":
      console.error(`프롬프트가 없어 task-analyze.md를 생성합니다: ${promptFile}`);
      writeTaskCreatePromptFromTask(options.taskRef, "analyze");
      break;
    case "suggest":
      console.error(`프롬프트가 없어 task-suggest.md를 생성합니다: ${promptFile}`);
      writeTaskCreatePromptFromTask(options.taskRef, "suggest");
      break;
    case "refine":
      throw new Error(
        [
          `Prompt file not found: ${promptFile}`,
          "refine 프롬프트는 자동 생성할 수 없습니다.",
          "예: pnpm tsx packages/engine/src/cli/generate-task-create-prompt.ts --kind refine --from-task <id> --revision-notes \"...\" --current-tasks <json>",
        ].join("\n"),
      );
  }

  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt was generated but file is still missing: ${promptFile}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { promptFile, category, taskDisplayId } = resolvePromptFile(options);

  ensurePromptFile(options, promptFile);

  const prompt = fs.readFileSync(promptFile, "utf-8");
  const runLogFile = getPromptRunLogPath({
    category,
    taskDisplayId,
    filename: `${timestampForFilename()}.jsonl`,
  });
  fs.mkdirSync(path.dirname(runLogFile), { recursive: true });

  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--include-partial-messages",
    "--include-hook-events",
    "--verbose",
  ];
  if (options.skipPermissions) args.push("--dangerously-skip-permissions");
  if (options.model) args.push("--model", options.model);

  const cwd = options.cwd ? path.resolve(PROJECT_ROOT, options.cwd) : PROJECT_ROOT;
  console.error(`시작: ${new Date().toISOString()}`);

  const exitCode = await new Promise<number>((resolve, reject) => {
    const logStream = fs.createWriteStream(runLogFile);
    const child = spawn("claude", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    child.stdout.on("data", (chunk: Buffer) => {
      logStream.write(chunk);
    });
    child.on("error", (error) => {
      logStream.end();
      reject(error);
    });
    child.on("close", (code) => {
      logStream.end();
      resolve(code ?? 1);
    });
  });

  console.error(`종료: ${new Date().toISOString()} (exit=${exitCode})`);
  console.error(`저장파일: ${runLogFile}`);
  if (exitCode !== 0) process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
