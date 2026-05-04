import fs from "fs";
import path from "path";
import { LOGS_DIR } from "../lib/config/paths";
import { loadSettings } from "../lib/config/settings";
import type { DashboardAiPhase, TokenUsageResult } from "./token-logger";

const JSONL_BASENAME = "dashboard-ai";

function maxFieldBytes(): number {
  const raw = process.env.DASHBOARD_AI_LOG_MAX_FIELD_BYTES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 100_000) return n;
  return 6_000_000;
}

function truncateUtf8(s: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(s, "utf-8");
  if (buf.length <= maxBytes) {
    return { text: s, truncated: false };
  }
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) {
    end -= 1;
  }
  return {
    text: buf.subarray(0, end).toString("utf-8") + "\n\n[truncated by DASHBOARD_AI_LOG_MAX_FIELD_BYTES]\n",
    truncated: true,
  };
}

export interface DashboardAiConversationLogRecord {
  ts: string;
  phase: DashboardAiPhase;
  model: string;
  exitCode: number | null;
  durationMs: number;
  timedOut?: boolean;
  /** 클라이언트가 fetch를 중단해 서버가 프로세스를 끊은 경우 */
  clientAborted?: boolean;
  spawnError?: string;
  /** stdin으로 Claude CLI에 전달한 전체 프롬프트 */
  prompt: string;
  /** CLI stdout 원문 */
  stdout: string;
  /** CLI stderr 원문 */
  stderr: string;
  usage?: Partial<TokenUsageResult>;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  promptTruncated?: boolean;
}

let lastPruneUtcDay: string | null = null;

function pruneDashboardAiJsonlIfNeeded(todayUtcDay: string): void {
  if (lastPruneUtcDay === todayUtcDay) return;
  lastPruneUtcDay = todayUtcDay;

  try {
    if (!fs.existsSync(LOGS_DIR)) return;
    const retentionDays = loadSettings().orchestrateLogRetentionDays;
    const keepAfter =
      Date.now() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOGS_DIR);
    const re = new RegExp(
      `^${JSONL_BASENAME}-(\\d{4}-\\d{2}-\\d{2})\\.jsonl$`,
    );
    for (const f of files) {
      const m = f.match(re);
      if (!m) continue;
      const day = m[1];
      const ts = Date.parse(`${day}T00:00:00.000Z`);
      if (Number.isNaN(ts)) continue;
      if (ts < keepAfter) {
        try {
          fs.unlinkSync(path.join(LOGS_DIR, f));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * 대시보드 Claude 호출(analyze / refine / suggest / chat) 1회당 JSONL 1행 append.
 * 파일: `.orchestration/output/logs/dashboard-ai-YYYY-MM-DD.jsonl` (UTC 날짜)
 * 보존: `orchestrateLogRetentionDays` 설정과 동일 규칙으로 날짜 파일 삭제 (UTC 자정 기준 파일명).
 */
export function appendDashboardAiConversationLog(
  partial: Omit<DashboardAiConversationLogRecord, "ts"> & { ts?: string },
): void {
  const maxB = maxFieldBytes();
  const promptT = truncateUtf8(partial.prompt, maxB);
  const stdoutT = truncateUtf8(partial.stdout, maxB);
  const stderrT = truncateUtf8(partial.stderr, maxB);

  const record: DashboardAiConversationLogRecord = {
    ...partial,
    ts: partial.ts ?? new Date().toISOString(),
    prompt: promptT.text,
    stdout: stdoutT.text,
    stderr: stderrT.text,
    promptTruncated: promptT.truncated || partial.promptTruncated,
    stdoutTruncated: stdoutT.truncated || partial.stdoutTruncated,
    stderrTruncated: stderrT.truncated || partial.stderrTruncated,
  };

  const day = record.ts.slice(0, 10);
  const file = path.join(LOGS_DIR, `${JSONL_BASENAME}-${day}.jsonl`);

  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf-8");
    pruneDashboardAiJsonlIfNeeded(day);
  } catch {
    /* ignore */
  }
}
