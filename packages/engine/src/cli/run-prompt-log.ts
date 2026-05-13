#!/usr/bin/env tsx
/**
 * Run a saved prompt with Claude and tee stream-json output into prompt-logs.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { PROJECT_ROOT } from "../lib/config/paths";
import { formatTimestamp } from "../lib/time/date-utils";
import { getTask, getTaskDisplayId } from "../service/task-store";
import {
  getPromptLogPath,
  getPromptRunLogPath,
  type PromptLogCategory,
} from "./prompt-log-paths";
import {
  writeTaskCreatePromptFromTask,
  writeTaskCreatePromptLog,
  type TaskCreatePromptCliOptions,
} from "./generate-task-create-prompt";
import { writeWorkerTaskPromptLog } from "./generate-task-prompt";

type PromptKind = "work" | "create" | "refine" | "suggest";

type CliOptions = {
  taskRef?: string;
  promptFile?: string;
  kind: PromptKind;
  title?: string;
  description?: string;
  revisionNotes?: string;
  currentTasksFile?: string;
  fromTask?: string;
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
      "  --title <text>                Create/refine title when generating create prompts",
      "  --description <text>          Create/refine description when generating create prompts",
      "  --from-task <taskRef>         Use an existing task row as create/refine input",
      "  --revision-notes <text>       Refine notes for --kind refine",
      "  --current-tasks <file>        Refine current tasks JSON for --kind refine",
      "  --cwd <dir>                   Claude working directory (default: project root)",
      "  --model <model>               Pass --model to Claude",
      "  --skip-permissions            Pass --dangerously-skip-permissions to Claude",
      "",
      "Examples:",
      "  pnpm tsx src/cli/run-prompt-log.ts --task 369",
      "  pnpm tsx src/cli/run-prompt-log.ts --task 369 --kind create",
      "  pnpm tsx src/cli/run-prompt-log.ts --kind create --title \"Add sidebar toggle\" --description \"...\"",
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
  const local = formatTimestamp(new Date());
  return local.replace(" ", "_").replace(/:/g, "-");
}

function buildPromptForReplay(basePrompt: string, taskRef?: string): string {
  const replayNotice = [
    "## Prompt-Log Replay Notice",
    "- 이 실행은 프롬프트 로그 재현/측정용이다.",
    "- 이 실행에서는 절대 커밋하지 마라.",
    "- `git add`, `git commit`, 브랜치 조작 등 git 쓰기 작업을 하지 마라.",
    "- 구현이 끝나면 변경사항은 워킹트리에만 남기고 result로 요약만 출력해라.",
    "- 구현이 끝나면 추가 탐색 없이 바로 종료해라.",
    "- 이 재현 실행에서는 패키지 전체 `tsc`, `test`, `build`를 돌리지 마라.",
    "- 검증은 바뀐 파일의 코드 자체를 짧게 점검하는 수준으로 끝내라. 의존성/환경 검증은 생략해라.",
    "- `ToolSearch`와 `TodoWrite`는 쓰지 마라.",
    "- 긴 계획 설명을 쓰지 마라. 필요한 파일을 읽은 뒤에는 바로 수정해라.",
    "",
  ].join("\n");

  const normalizedTaskRef = taskRef ? normalizeTaskRef(taskRef) : undefined;
  const taskSpecificNotice =
    normalizedTaskRef === "TASK-370"
      ? [
          "## TASK-370 Replay Hint",
          "- collapsed 아이콘 tooltip은 새 Tooltip 컴포넌트 없이 네이티브 `title` + `aria-label`로만 처리해라.",
          "- `packages/dashboard/src/components/ui/tooltip*` 또는 `components/ui/*`를 검색하지 마라.",
          "- `SidebarTooltip.tsx` 같은 새 tooltip/helper 파일을 만들지 마라.",
          "- scope 해석은 이미 끝났다. 디렉터리 구조를 다시 확인하려고 `ls`, `find`, `Bash` listing을 하지 마라.",
          "- 먼저 이 파일들만 직접 열어라: `Sidebar.tsx`, `AppShell.tsx`, `components/DocsSection.tsx`, `components/TaskListSection.tsx`, `components/NoticesSection.tsx`, `components/SidebarFooter.tsx`, `components/index.ts`, `components/types/index.ts`, `types/index.ts`.",
          "- 구현 스케치: `components/types/index.ts`에 각 섹션 prop의 `collapsed?: boolean`만 추가하고, `Sidebar.tsx`에서 `collapsed`/`onToggleCollapsed` props와 폭 상수(56/220) 및 토글 버튼을 추가해 각 섹션으로 전달해라.",
          "- 구현 스케치: `AppShell.tsx`에서 `collapsed` state와 localStorage(`sidebar:collapsed`)를 관리하고 `Sidebar`와 로딩 스켈레톤 폭에만 연결해라.",
          "- 구현 스케치: `DocsSection.tsx`/`TaskListSection.tsx`/`NoticesSection.tsx`/`SidebarFooter.tsx`는 collapsed일 때 텍스트 대신 아이콘 중심 UI와 네이티브 `title`/`aria-label`만 사용해라.",
          "- 읽기 단계가 끝난 뒤 다음 assistant 응답은 반드시 둘 중 하나여야 한다: `거절:` 또는 `Edit`/`Write` 도구 호출.",
          "- 읽기 단계 후에는 같은 내용을 다시 설명하는 계획 문장, 구현 아이디어 독백, 이미 읽은 파일 재열람을 금지한다.",
          "- 이 태스크에서는 위 파일들만으로 구현을 끝내는 것을 기본값으로 삼아라. 추가 파일 읽기는 실제 prop/type/style 근거가 부족할 때만 허용된다.",
          "- 위 파일을 다 읽은 뒤에는 긴 구현 계획을 다시 쓰지 말고 바로 수정해라.",
          "- `ToolSearch`, `TodoWrite`, 구현 전 장문 status 메시지는 금지다.",
          "- `components/types.ts` 같은 추측 경로를 만들지 마라. 타입 파일은 `components/types/index.ts`와 `types/index.ts`만 본다.",
          "- `ide-sidebar`, `tree-item` 같은 클래스명을 찾기 위해 `packages/dashboard` 전체를 grep하지 마라. 스타일이 필요하면 `src/app/globals.css`만 직접 열어라.",
          "- `src/app/globals.css`는 이번 재현에서는 기본적으로 열지 마라. 폭은 inline style로 처리하고, 활성 스타일은 기존 클래스 재사용으로 끝내라.",
          "- 구현 중에는 `e2e/sidebar.spec.ts` 같은 테스트 파일을 읽지 마라. 테스트는 마지막 검증 단계에서만 본다.",
          "- `DocsSection`에서 collapsed 처리가 필요하더라도, 먼저 `DocsSection.tsx`를 수정하고 실제 prop이 부족할 때만 `DocTreeNode.tsx`까지 내려가라.",
          "- `AppShell/index.ts`, `AppShell/components/index.ts`, `Sidebar/index.ts`는 export 수정이 정말 필요할 때만 마지막에 열어라.",
          "- `components/index.ts`도 실제 export 변경이 필요할 때만 마지막에 열어라.",
          "- `components/index.ts`와 `Sidebar/index.ts`는 기본적으로 수정하지 마라. export가 실제로 깨질 때만 마지막에 1회 확인해라.",
          "- 구현 후에는 full typecheck나 환경 검증을 하지 말고 바로 result를 출력해라.",
          "",
        ].join("\n")
      : "";

  return `${replayNotice}${taskSpecificNotice}\n${basePrompt}`;
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
  const createOwnerRef = options.taskRef ?? options.fromTask;
  const taskDisplayId = resolveTaskDisplayId(createOwnerRef);

  if (options.promptFile) {
    return {
      promptFile: path.resolve(PROJECT_ROOT, options.promptFile),
      category,
      taskDisplayId,
    };
  }

  const hasCreateInputs =
    options.kind === "create"
      ? Boolean(options.title?.trim() || options.fromTask)
      : options.kind === "refine"
        ? Boolean(
            (options.title?.trim() || options.fromTask) &&
              options.revisionNotes?.trim() &&
              options.currentTasksFile,
          )
        : false;

  if (options.kind === "work" && !taskDisplayId) {
    throw new Error("--task is required unless --prompt is provided");
  }
  if (
    (options.kind === "create" || options.kind === "refine") &&
    !taskDisplayId &&
    !hasCreateInputs
  ) {
    throw new Error(
      "--kind create/refine requires --task, --from-task, or explicit create inputs unless --prompt is provided",
    );
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

function buildCreatePromptOptions(
  options: CliOptions,
): TaskCreatePromptCliOptions {
  return {
    kind:
      options.kind === "create"
        ? "analyze"
        : options.kind === "refine"
          ? "refine"
          : "suggest",
    title: options.title,
    description: options.description,
    revisionNotes: options.revisionNotes,
    currentTasksFile: options.currentTasksFile,
    fromTask: options.fromTask ?? options.taskRef,
    stdout: false,
  };
}

function ensurePromptFile(options: CliOptions, promptFile: string): void {
  if (options.promptFile) {
    if (fs.existsSync(promptFile)) return;
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  const shouldRegeneratePrompt = options.kind !== "work";
  if (fs.existsSync(promptFile) && !shouldRegeneratePrompt) return;

  if (
    !options.taskRef &&
    !options.fromTask &&
    options.kind === "work"
  ) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }

  if (shouldRegeneratePrompt && fs.existsSync(promptFile)) {
    fs.rmSync(promptFile, { force: true });
  }

  switch (options.kind) {
    case "work":
      console.error(`프롬프트가 없어 worker-task.md를 생성합니다: ${promptFile}`);
      writeWorkerTaskPromptLog(options.taskRef);
      break;
    case "create":
      console.error(`프롬프트가 없어 task-analyze.md를 생성합니다: ${promptFile}`);
      if (options.title?.trim() || options.fromTask) {
        writeTaskCreatePromptLog(buildCreatePromptOptions(options));
      } else if (options.taskRef) {
        writeTaskCreatePromptFromTask(options.taskRef, "analyze");
      } else {
        throw new Error(
          "--kind create requires --task, --from-task, or --title when auto-generating the prompt",
        );
      }
      break;
    case "suggest":
      console.error(`프롬프트가 없어 task-suggest.md를 생성합니다: ${promptFile}`);
      if (options.taskRef || options.fromTask) {
        writeTaskCreatePromptFromTask(options.fromTask ?? options.taskRef!, "suggest");
      } else {
        writeTaskCreatePromptLog(buildCreatePromptOptions(options));
      }
      break;
    case "refine":
      console.error(
        `프롬프트가 없어 task-analyze-refine.md를 생성합니다: ${promptFile}`,
      );
      writeTaskCreatePromptLog(buildCreatePromptOptions(options));
      break;
  }

  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt was generated but file is still missing: ${promptFile}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { promptFile, category, taskDisplayId } = resolvePromptFile(options);

  ensurePromptFile(options, promptFile);

  const prompt = buildPromptForReplay(
    fs.readFileSync(promptFile, "utf-8"),
    options.taskRef,
  );
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
  console.error(`시작: ${formatTimestamp(new Date())}`);

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

  console.error(`종료: ${formatTimestamp(new Date())} (exit=${exitCode})`);
  console.error(`저장파일: ${runLogFile}`);
  if (exitCode !== 0) process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
