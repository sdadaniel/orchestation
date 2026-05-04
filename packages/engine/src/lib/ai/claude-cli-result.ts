/**
 * Claude CLI `--output-format json` / `stream-json` stdout 파싱 — claude-worker와 동일한 필드 폴백.
 */

export interface ClaudeCliUsageSnapshot {
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreate: number;
  cacheRead: number;
  turns: number;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function usageFromCliResultRoot(
  obj: Record<string, unknown>,
): ClaudeCliUsageSnapshot {
  const usage =
    obj.usage && typeof obj.usage === "object"
      ? (obj.usage as Record<string, unknown>)
      : undefined;

  const cacheCreate = num(
    usage?.cache_creation_input_tokens ??
      usage?.cache_create_input_tokens ??
      obj.cache_create_input_tokens,
  );
  const cacheRead = num(
    usage?.cache_read_input_tokens ?? obj.cache_read_input_tokens,
  );

  return {
    costUsd: num(obj.total_cost_usd ?? obj.cost_usd ?? obj.costUsd),
    inputTokens: num(
      usage?.input_tokens ?? obj.input_tokens ?? obj.inputTokens,
    ),
    outputTokens: num(
      usage?.output_tokens ?? obj.output_tokens ?? obj.outputTokens,
    ),
    cacheCreate,
    cacheRead,
    turns: num(obj.num_turns ?? obj.turns ?? usage?.num_turns),
  };
}

/** `--output-format json` 한 덩어리 stdout → assistant result 문자열 + usage */
export function parseClaudePrintJsonEnvelope(stdout: string): {
  resultText: string;
  usage: ClaudeCliUsageSnapshot;
} {
  const root = JSON.parse(stdout.trim()) as Record<string, unknown>;
  const raw = root.result;
  const resultText =
    typeof raw === "string"
      ? raw
      : raw !== undefined && raw !== null
        ? JSON.stringify(raw)
        : "";
  return { resultText, usage: usageFromCliResultRoot(root) };
}

export function handleStreamJsonLine(obj: Record<string, unknown>): {
  textDelta?: string;
  usage?: ClaudeCliUsageSnapshot;
  resultText?: string;
} {
  if (obj.type === "result") {
    const raw = obj.result;
    const resultText =
      typeof raw === "string"
        ? raw
        : raw !== undefined && raw !== null
          ? JSON.stringify(raw)
          : "";
    return {
      usage: usageFromCliResultRoot(obj),
      resultText,
    };
  }

  if (obj.type === "stream_event") {
    const t = extractTextDeltaFromStreamEvent(obj);
    if (t) return { textDelta: t };
  }

  return {};
}

function extractTextDeltaFromStreamEvent(obj: Record<string, unknown>): string | null {
  const ev = obj.event;
  if (!ev || typeof ev !== "object") return null;
  const e = ev as Record<string, unknown>;

  const deltas: unknown[] = [
    e.delta,
    (e as { content_block_delta?: { delta?: unknown } }).content_block_delta
      ?.delta,
  ];

  for (const d of deltas) {
    if (!d || typeof d !== "object") continue;
    const delta = d as Record<string, unknown>;
    if (delta.type === "text_delta" && typeof delta.text === "string") {
      return delta.text;
    }
  }

  return null;
}
