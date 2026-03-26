import { spawn, spawnSync, ChildProcess } from "child_process";
import { Readable, Writable } from "stream";
import { PROJECT_ROOT } from "@/lib/paths";

/** stdio: ["pipe","pipe","pipe"] 로 spawn된 프로세스 — 스트림이 항상 non-null */
export interface ClaudeChildProcess extends ChildProcess {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
}

export const CLAUDE_DEFAULT_MODEL = "claude-sonnet-4-6";
export const CLAUDE_DEFAULT_TIMEOUT_MS = 90_000;

function buildClaudeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
  };
}

export interface SpawnClaudeOptions {
  model?: string;
  timeout?: number;
}

/**
 * Claude CLI를 비동기(spawn) 방식으로 실행한다.
 * stdin에 prompt를 기록하고 즉시 닫는다.
 * 타임아웃이 지나면 SIGTERM으로 프로세스를 종료한다.
 * 타임아웃 타이머는 close 이벤트 발생 시 자동으로 해제된다.
 *
 * @returns ChildProcess — stdout/stderr 이벤트를 직접 구독해 사용한다.
 */
export function spawnClaude(
  prompt: string,
  options: SpawnClaudeOptions = {},
): ClaudeChildProcess {
  const model = options.model ?? CLAUDE_DEFAULT_MODEL;
  const timeoutMs = options.timeout ?? CLAUDE_DEFAULT_TIMEOUT_MS;

  const child = spawn(
    "claude",
    ["--print", "--model", model, "--output-format", "text"],
    {
      cwd: PROJECT_ROOT,
      env: buildClaudeEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  child.stdin.write(prompt);
  child.stdin.end();

  const timer = setTimeout(() => {
    child.kill("SIGTERM");
  }, timeoutMs);

  child.on("close", () => clearTimeout(timer));

  return child as ClaudeChildProcess;
}

export interface RunClaudeSyncOptions {
  model?: string;
  /** milliseconds */
  timeout?: number;
  /** additional CLI flags (e.g. ["--dangerously-skip-permissions"]) */
  extraArgs?: string[];
}

/**
 * Claude CLI를 동기(spawnSync) 방식으로 실행한다.
 * stdin pipe를 통해 prompt를 전달하므로 셸 인젝션 위험이 없다.
 *
 * @returns stdout 문자열
 * @throws Error — 프로세스가 0이 아닌 코드로 종료되거나 타임아웃 시
 */
export function runClaudeSync(
  prompt: string,
  options: RunClaudeSyncOptions = {},
): string {
  const model = options.model ?? CLAUDE_DEFAULT_MODEL;
  const timeoutMs = options.timeout ?? CLAUDE_DEFAULT_TIMEOUT_MS;
  const extraArgs = options.extraArgs ?? [];

  const result = spawnSync(
    "claude",
    ["--print", "--model", model, "--output-format", "text", ...extraArgs],
    {
      cwd: PROJECT_ROOT,
      env: buildClaudeEnv(),
      input: prompt,
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ?? "";
    throw new Error(
      `Claude CLI exited with code ${result.status}${stderr ? `: ${stderr}` : ""}`,
    );
  }

  return result.stdout ?? "";
}
