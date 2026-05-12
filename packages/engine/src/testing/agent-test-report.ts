import fs from "fs";
import path from "path";

export type AgentTestArtifactSnapshot = {
  token_usage_log_path: string | null;
  /** token-usage.log 마지막 N줄 (없으면 []) */
  token_usage_tail: string[];
  dashboard_ai_jsonl_paths: string[];
  /** dashboard-ai-*.jsonl에서 파싱에 성공한 마지막 M건 */
  dashboard_ai_records_tail: Record<string, unknown>[];
};

export type AgentTestEvent = {
  step: string;
  ts: string;
  note?: string;
  task?: Record<string, unknown>;
  artifacts?: AgentTestArtifactSnapshot;
  /** 단일 이벤트에 붙이는 원시 대화/비용 조각 */
  conversation_excerpt?: Record<string, unknown>;
  cost_excerpt?: Record<string, unknown>;
  log_file?: string;
};

let currentLogFile: string | null = null;

function readTailLines(filePath: string, maxLines: number): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function listDashboardAiJsonl(logsDir: string): string[] {
  try {
    if (!fs.existsSync(logsDir)) return [];
    return fs
      .readdirSync(logsDir)
      .filter((f) => /^dashboard-ai-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => path.join(logsDir, f))
      .sort();
  } catch {
    return [];
  }
}

function parseJsonlTail(filePath: string, maxRecords: number): Record<string, unknown>[] {
  const lines = readTailLines(filePath, maxRecords * 2);
  const out: Record<string, unknown>[] = [];
  for (const line of lines.slice(-maxRecords)) {
    try {
      out.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      out.push({ _parse_error: true, _line: line.slice(0, 500) });
    }
  }
  return out;
}

/**
 * 수동 태스크 생성 직후(또는 각 에이전트 단계 직후) 스냅샷.
 * 실제 LLM 호출이 없으면 token_usage / dashboard_ai 는 비어 있을 수 있다.
 */
export function collectOrchestrationLogArtifacts(opts: {
  outputDir: string;
  logsDir: string;
  tokenUsageTailLines?: number;
  dashboardAiMaxFiles?: number;
  dashboardAiRecordsPerFile?: number;
}): AgentTestArtifactSnapshot {
  const tokenTailN = opts.tokenUsageTailLines ?? 40;
  const maxFiles = opts.dashboardAiMaxFiles ?? 2;
  const perFile = opts.dashboardAiRecordsPerFile ?? 8;

  const tokenPath = path.join(opts.outputDir, "token-usage.log");
  const token_usage_tail = readTailLines(tokenPath, tokenTailN);

  const allAi = listDashboardAiJsonl(opts.logsDir);
  const dashboard_ai_jsonl_paths = allAi.slice(-maxFiles);

  const dashboard_ai_records_tail: Record<string, unknown>[] = [];
  for (const p of dashboard_ai_jsonl_paths) {
    dashboard_ai_records_tail.push(...parseJsonlTail(p, perFile));
  }

  return {
    token_usage_log_path: fs.existsSync(tokenPath) ? tokenPath : null,
    token_usage_tail,
    dashboard_ai_jsonl_paths,
    dashboard_ai_records_tail: dashboard_ai_records_tail.slice(-perFile * maxFiles),
  };
}

export function startAgentTestRun(opts: { suite: string; projectRoot: string }): string {
  const dir = path.join(
    opts.projectRoot,
    ".orchestration",
    "output",
    "logs",
    "agent-tests",
  );
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  currentLogFile = path.join(dir, `${opts.suite}__${stamp}.jsonl`);
  appendAgentTestEvent({
    step: "run_start",
    ts: new Date().toISOString(),
    note: "agent-tests JSONL — 대화(dashboard-ai JSONL)·비용(token-usage.log) 스냅샷은 단계마다 수집",
    log_file: currentLogFile,
    conversation_excerpt: { source: "none_until_llm_steps" },
    cost_excerpt: { source: "token_usage_log_tail", lines: 0 },
  });
  return currentLogFile;
}

export function appendAgentTestEvent(
  event: Omit<AgentTestEvent, "ts"> & { ts?: string },
): void {
  if (!currentLogFile) {
    throw new Error("startAgentTestRun()을 먼저 호출하세요.");
  }
  const line = JSON.stringify({
    ...event,
    ts: event.ts ?? new Date().toISOString(),
  });
  fs.appendFileSync(currentLogFile, `${line}\n`, "utf-8");
  process.stdout.write(`[agent-test] ${event.step}\n`);
}

export function getCurrentAgentTestLogPath(): string | null {
  return currentLogFile;
}

export function resetAgentTestLogForTests(): void {
  currentLogFile = null;
}
