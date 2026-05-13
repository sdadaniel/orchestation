#!/usr/bin/env tsx
/**
 * Generate dashboard task-creation prompts without calling Claude.
 *
 * This mirrors packages/dashboard/src/app/api/tasks/analyze/route.ts and
 * packages/dashboard/src/app/api/tasks/suggest/route.ts prompt construction.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ROLES_DIR } from "../lib/config/paths";
import { renderTemplate, readTemplate } from "../lib/template";
import { getTask, getTaskDisplayId } from "../service/task-store";
import { getPromptLogPath, type PromptLogCategory } from "./prompt-log-paths";

type PromptKind = "analyze" | "refine" | "suggest";

export type TaskCreatePromptCliOptions = {
  kind: PromptKind;
  title?: string;
  description?: string;
  revisionNotes?: string;
  currentTasksFile?: string;
  fromTask?: string;
  stdout: boolean;
};

function printUsage(): void {
  console.error(
    [
      "Usage: generate-task-create-prompt.ts [options]",
      "",
      "Options:",
      "  --kind analyze|refine|suggest   Prompt type (default: analyze)",
      "  --title <text>                   Request title for analyze/refine",
      "  --description <text>             Request description for analyze/refine",
      "  --from-task <taskId|TASK-###|###> Use an existing task row as title/description",
      "  --revision-notes <text>          Refine instructions (required for --kind refine)",
      "  --current-tasks <file>           JSON array/object for current proposed tasks",
      "  --stdout                         Print prompt to stdout",
      "",
      "Examples:",
      "  pnpm tsx src/cli/generate-task-create-prompt.ts --title \"Add sidebar toggle\" --description \"...\"",
      "  pnpm tsx src/cli/generate-task-create-prompt.ts --from-task 369",
      "  pnpm tsx src/cli/generate-task-create-prompt.ts --kind suggest --stdout",
      "  pnpm tsx src/cli/generate-task-create-prompt.ts --kind refine --title \"...\" --revision-notes \"...\" --current-tasks /tmp/tasks.json",
    ].join("\n"),
  );
}

function normalizeTaskRef(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return `TASK-${trimmed.padStart(3, "0")}`;
  return trimmed;
}

function parseKind(value: string): PromptKind {
  if (value === "analyze" || value === "refine" || value === "suggest") {
    return value;
  }
  throw new Error(`Invalid --kind: ${value}`);
}

function readOptionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: string[]): TaskCreatePromptCliOptions {
  const options: TaskCreatePromptCliOptions = { kind: "analyze", stdout: false };

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
    if (arg === "--kind") {
      options.kind = parseKind(readOptionValue(argv, i, arg));
      i += 1;
      continue;
    }
    if (arg.startsWith("--kind=")) {
      options.kind = parseKind(arg.slice("--kind=".length));
      continue;
    }
    if (arg === "--title") {
      options.title = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--title=")) {
      options.title = arg.slice("--title=".length);
      continue;
    }
    if (arg === "--description") {
      options.description = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--description=")) {
      options.description = arg.slice("--description=".length);
      continue;
    }
    if (arg === "--revision-notes") {
      options.revisionNotes = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--revision-notes=")) {
      options.revisionNotes = arg.slice("--revision-notes=".length);
      continue;
    }
    if (arg === "--current-tasks") {
      options.currentTasksFile = readOptionValue(argv, i, arg);
      i += 1;
      continue;
    }
    if (arg.startsWith("--current-tasks=")) {
      options.currentTasksFile = arg.slice("--current-tasks=".length);
      continue;
    }
    if (arg === "--from-task") {
      options.fromTask = normalizeTaskRef(readOptionValue(argv, i, arg));
      i += 1;
      continue;
    }
    if (arg.startsWith("--from-task=")) {
      options.fromTask = normalizeTaskRef(arg.slice("--from-task=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getAvailableRoles(): string[] {
  try {
    return fs
      .readdirSync(ROLES_DIR)
      .filter(
        (file) =>
          file.endsWith(".md") &&
          !file.startsWith("reviewer-") &&
          file !== "README.md",
      )
      .map((file) => file.replace(".md", ""));
  } catch {
    return ["general"];
  }
}

function loadCurrentTasksJson(filePath: string): string {
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const tasks =
    parsed && typeof parsed === "object" && "tasks" in parsed
      ? (parsed as { tasks: unknown }).tasks
      : parsed;
  if (!Array.isArray(tasks)) {
    throw new Error("--current-tasks must contain a JSON array or {\"tasks\": [...]}");
  }
  return JSON.stringify(tasks, null, 2);
}

function hydrateFromTask(
  options: TaskCreatePromptCliOptions,
): { taskDisplayId?: string } {
  if (!options.fromTask) return {};
  const task = getTask(options.fromTask);
  if (!task) throw new Error(`Task not found: ${options.fromTask}`);

  options.title ??= task.title;
  options.description ??= task.content;
  return { taskDisplayId: getTaskDisplayId(task) };
}

function buildPrompt(options: TaskCreatePromptCliOptions): {
  prompt: string;
  category: PromptLogCategory;
  filename: string;
  taskDisplayId?: string;
} {
  const { taskDisplayId } = hydrateFromTask(options);

  if (options.kind === "suggest") {
    return {
      prompt: readTemplate("prompt/task-suggest.md"),
      category: "suggest",
      filename: "task-suggest.md",
      taskDisplayId,
    };
  }

  const title = options.title?.trim() ?? "";
  if (!title) throw new Error("--title is required unless --from-task is provided");

  const description = options.description?.trim() ?? "";
  const rolesDescription = getAvailableRoles().map((role) => `  - ${role}`).join("\n");
  const descriptionLine = description ? `Description: ${description}` : "";

  if (options.kind === "refine") {
    const revisionNotes = options.revisionNotes?.trim() ?? "";
    if (!revisionNotes) throw new Error("--revision-notes is required for --kind refine");
    if (!options.currentTasksFile) {
      throw new Error("--current-tasks is required for --kind refine");
    }

    return {
      prompt: renderTemplate("prompt/task-analyze-refine.md", {
        title,
        description_line: descriptionLine,
        revision_notes: revisionNotes,
        current_tasks_json: loadCurrentTasksJson(options.currentTasksFile),
        available_roles: rolesDescription,
      }),
      category: "create",
      filename: "task-analyze-refine.md",
      taskDisplayId,
    };
  }

  return {
    prompt: renderTemplate("prompt/task-analyze.md", {
      title,
      description_line: descriptionLine,
      available_roles: rolesDescription,
    }),
    category: "create",
    filename: "task-analyze.md",
    taskDisplayId,
  };
}

export function writeTaskCreatePromptFromTask(
  taskRef: string,
  kind: "analyze" | "suggest",
  opts?: { stdout?: boolean },
): string {
  const options: TaskCreatePromptCliOptions = {
    kind,
    stdout: opts?.stdout ?? false,
    fromTask: normalizeTaskRef(taskRef),
  };
  return writeTaskCreatePromptLog(options);
}

export function writeTaskCreatePromptLog(
  options: TaskCreatePromptCliOptions,
): string {
  const { prompt, category, filename, taskDisplayId } = buildPrompt(options);

  if (options.stdout) {
    process.stdout.write(prompt);
    if (!prompt.endsWith("\n")) process.stdout.write("\n");
  }

  const outFile = getPromptLogPath({ category, taskDisplayId, filename });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, prompt);
  console.error(`Prompt written: ${outFile}`);
  return outFile;
}

function isCliEntry(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === path.resolve(fileURLToPath(import.meta.url));
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  writeTaskCreatePromptLog(options);
}

if (isCliEntry()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
