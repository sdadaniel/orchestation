import type { CostEntry } from "./cost-parser";

export interface ModelCostSummary {
  model: string;
  displayName: string;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreate: number;
  totalCacheRead: number;
  entries: number;
}

/**
 * Extracts a human-friendly short name from a full model identifier.
 * e.g. "claude-sonnet-4-20250514" → "Sonnet 4"
 *      "claude-3-5-haiku-20241022" → "Haiku 3.5"
 *      "claude-opus-4-1-20250805" → "Opus 4.1"
 */
export function shortenModelName(model: string): string {
  if (!model || model === "unknown") return "Unknown";

  const lower = model.toLowerCase();

  // Match patterns like "opus-4-1", "sonnet-4", "haiku-3-5"
  const familyMatch = lower.match(/(opus|sonnet|haiku)[-_](\d+(?:[-_.]\d+)?)/);
  if (familyMatch) {
    const family = familyMatch[1].charAt(0).toUpperCase() + familyMatch[1].slice(1);
    const version = familyMatch[2].replace(/[-_]/g, ".");
    return `${family} ${version}`;
  }

  // Match "claude-3-5-haiku" style
  const altMatch = lower.match(/claude[-_](\d+(?:[-_.]\d+)?)[-_](opus|sonnet|haiku)/);
  if (altMatch) {
    const version = altMatch[1].replace(/[-_]/g, ".");
    const family = altMatch[2].charAt(0).toUpperCase() + altMatch[2].slice(1);
    return `${family} ${version}`;
  }

  // Fallback: just capitalize and trim date suffix
  return model.replace(/-\d{8,}$/, "").replace(/^claude-?/i, "").trim() || model;
}

/**
 * Aggregates cost entries by model name.
 * Returns sorted by totalCostUsd descending.
 */
export function aggregateByModel(entries: CostEntry[]): ModelCostSummary[] {
  const map = new Map<string, ModelCostSummary>();

  for (const e of entries) {
    const key = e.model || "unknown";
    let summary = map.get(key);
    if (!summary) {
      summary = {
        model: key,
        displayName: shortenModelName(key),
        totalCostUsd: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheCreate: 0,
        totalCacheRead: 0,
        entries: 0,
      };
      map.set(key, summary);
    }
    summary.totalCostUsd = parseFloat((summary.totalCostUsd + e.costUsd).toFixed(6));
    summary.totalInputTokens += e.inputTokens;
    summary.totalOutputTokens += e.outputTokens;
    summary.totalCacheCreate += e.cacheCreate;
    summary.totalCacheRead += e.cacheRead;
    summary.entries += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}
