/**
 * claude-worker.ts — Claude CLI 호출 래퍼
 * job-task.sh, job-review.sh에서 사용하던 claude CLI 호출 패턴을 Node.js로 포팅
 */
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

export interface ClaudeWorkerOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  cwd: string;
  convFile?: string;   // conversation JSONL 저장 경로
  timeout?: number;     // ms (기본 600000 = 10분)
  env?: Record<string, string>;
  onLine?: (line: string) => void;  // 각 stdout 라인 콜백
}

export interface ClaudeStreamResult {
  result: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  exitCode: number;
  durationMs: number;
}

export interface ClaudeJsonResult {
  result: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  exitCode: number;
  durationMs: number;
}

/**
 * Claude CLI를 stream-json 모드로 호출한다.
 * job-task.sh에서 사용하던 패턴의 Node.js 구현.
 */
export function runClaudeStreamJson(opts: ClaudeWorkerOptions): Promise<ClaudeStreamResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeoutMs = opts.timeout ?? 600000;

    const args = [
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--print",
    ];
    if (opts.model) args.push("--model", opts.model);
    if (opts.systemPrompt) args.push("--system-prompt", opts.systemPrompt);
    args.push(opts.prompt);

    const proc = spawn("claude", args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let resultText = "";
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let convStream: fs.WriteStream | null = null;

    if (opts.convFile) {
      fs.mkdirSync(path.dirname(opts.convFile), { recursive: true });
      convStream = fs.createWriteStream(opts.convFile);
    }

    let stdoutBuf = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf-8");
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (convStream) convStream.write(line + "\n");
        opts.onLine?.(line);

        try {
          const obj = JSON.parse(line);
          if (obj.type === "result") {
            resultText = typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result);
            costUsd = obj.total_cost_usd ?? obj.cost_usd ?? obj.costUsd ?? 0;
            inputTokens = obj.usage?.input_tokens ?? obj.input_tokens ?? obj.inputTokens ?? 0;
            outputTokens = obj.usage?.output_tokens ?? obj.output_tokens ?? obj.outputTokens ?? 0;
          }
        } catch { /* 비-JSON 라인 무시 */ }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8").trim();
      if (text) opts.onLine?.(`[stderr] ${text}`);
    });

    // 타임아웃 워치독 — proc.kill 사용 (process group kill 회피)
    const timer = setTimeout(() => {
      opts.onLine?.("[timeout] Claude CLI 타임아웃 → SIGTERM");
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* ignore */ }
      }, 5000);
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      convStream?.end();

      // 남은 버퍼 처리
      if (stdoutBuf.trim()) {
        try {
          const obj = JSON.parse(stdoutBuf);
          if (obj.type === "result") {
            resultText = typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result);
            costUsd = obj.total_cost_usd ?? obj.cost_usd ?? obj.costUsd ?? 0;
            inputTokens = obj.usage?.input_tokens ?? obj.input_tokens ?? obj.inputTokens ?? 0;
            outputTokens = obj.usage?.output_tokens ?? obj.output_tokens ?? obj.outputTokens ?? 0;
          }
        } catch { /* ignore */ }
      }

      resolve({
        result: resultText,
        costUsd,
        inputTokens,
        outputTokens,
        exitCode: code ?? 1,
        durationMs: Date.now() - startTime,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      convStream?.end();
      reject(err);
    });
  });
}

/**
 * Claude CLI를 json 모드로 호출한다.
 * job-review.sh, night-worker.sh에서 사용하던 패턴.
 */
export function runClaudeJson(opts: ClaudeWorkerOptions): Promise<ClaudeJsonResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timeoutMs = opts.timeout ?? 600000;

    const args = [
      "--output-format", "json",
      "--dangerously-skip-permissions",
      "--print",
    ];
    if (opts.model) args.push("--model", opts.model);
    if (opts.systemPrompt) args.push("--system-prompt", opts.systemPrompt);
    args.push(opts.prompt);

    const proc = spawn("claude", args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
      opts.onLine?.(`[stderr] ${chunk.toString("utf-8").trim()}`);
    });

    const timer = setTimeout(() => {
      opts.onLine?.("[timeout] Claude CLI 타임아웃 → SIGTERM");
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* ignore */ }
      }, 5000);
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);

      let resultText = "";
      let costUsd = 0;
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const obj = JSON.parse(stdout.trim());
        resultText = typeof obj.result === "string" ? obj.result : stdout.trim();
        costUsd = obj.total_cost_usd ?? obj.cost_usd ?? obj.costUsd ?? 0;
        inputTokens = obj.usage?.input_tokens ?? obj.input_tokens ?? obj.inputTokens ?? 0;
        outputTokens = obj.usage?.output_tokens ?? obj.output_tokens ?? obj.outputTokens ?? 0;
      } catch {
        resultText = stdout.trim();
      }

      // conversation 파일 저장
      if (opts.convFile) {
        try {
          fs.mkdirSync(path.dirname(opts.convFile), { recursive: true });
          fs.writeFileSync(opts.convFile, stdout);
        } catch { /* ignore */ }
      }

      resolve({
        result: resultText,
        costUsd,
        inputTokens,
        outputTokens,
        exitCode: code ?? 1,
        durationMs: Date.now() - startTime,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
