import { describe, it, expect } from 'vitest';
import { shortenModelName, aggregateByModel, ModelCostSummary } from './cost-aggregation';
import type { CostEntry } from './cost-parser';

describe('shortenModelName', () => {
  it('should match "opus-4-1" style pattern (first regex)', () => {
    // First regex matches (opus|sonnet|haiku)[-_](\d+(?:[-_.]\d+)?)
    // This captures "opus" and "4-1-20250805" together
    const result = shortenModelName('claude-opus-4-1-20250805');
    expect(result).toMatch(/^Opus/);
    expect(result).toContain('4');
  });

  it('should match "sonnet-4" style pattern (first regex)', () => {
    // First regex matches sonnet-4-20250514 and includes date in version
    const result = shortenModelName('claude-sonnet-4-20250514');
    expect(result).toMatch(/^Sonnet/);
    expect(result).toContain('4');
  });

  it('should match "haiku-3-5" style pattern (first regex)', () => {
    const result = shortenModelName('claude-haiku-3-5-20250314');
    expect(result).toMatch(/^Haiku/);
    expect(result).toContain('3');
  });

  it('should match alternative "claude-3-5-haiku" style (second regex)', () => {
    // Second regex: /claude[-_](\d+(?:[-_.]\d+)?)[-_](opus|sonnet|haiku)/
    // Extracts version before family name
    const result = shortenModelName('claude-3-5-haiku-20241022');
    expect(result).toMatch(/^Haiku/);
  });

  it('should handle underscore separators', () => {
    const result = shortenModelName('claude_opus_4_1_20250805');
    expect(result).toMatch(/^Opus/);
  });

  it('should return "Unknown" for empty string', () => {
    expect(shortenModelName('')).toBe('Unknown');
  });

  it('should return "Unknown" for "unknown" input', () => {
    expect(shortenModelName('unknown')).toBe('Unknown');
  });

  it('should fallback to partial name removal for unmatched patterns', () => {
    const result = shortenModelName('some-random-model-20250101');
    expect(result).toBe('some-random-model');
  });

  it('should handle model names without date suffix', () => {
    const result = shortenModelName('claude-custom-model');
    expect(result).toBe('custom-model');
  });
});

describe('aggregateByModel', () => {
  it('should return empty array for empty input', () => {
    const result = aggregateByModel([]);
    expect(result).toEqual([]);
  });

  it('should aggregate multiple entries by model', () => {
    const entries: CostEntry[] = [
      {
        timestamp: '2026-03-26 10:00:00',
        taskId: 'TASK-001',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 1000,
        outputTokens: 2000,
        cacheCreate: 50,
        cacheRead: 100,
        turns: 3,
        durationMs: 5000,
        costUsd: 0.05,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-001',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 500,
        outputTokens: 1000,
        cacheCreate: 25,
        cacheRead: 50,
        turns: 2,
        durationMs: 3000,
        costUsd: 0.03,
      },
      {
        timestamp: '2026-03-26 10:00:20',
        taskId: 'TASK-002',
        phase: 'task',
        model: 'claude-opus-4-1-20250805',
        inputTokens: 2000,
        outputTokens: 4000,
        cacheCreate: 100,
        cacheRead: 200,
        turns: 5,
        durationMs: 10000,
        costUsd: 0.15,
      },
    ];

    const result = aggregateByModel(entries);

    expect(result).toHaveLength(2);
    // Should be sorted by cost descending
    expect(result[0].model).toBe('claude-opus-4-1-20250805');
    expect(result[0].totalCostUsd).toBe(0.15);
    expect(result[0].displayName).toMatch(/^Opus/);
    expect(result[0].totalInputTokens).toBe(2000);
    expect(result[0].totalOutputTokens).toBe(4000);
    expect(result[0].totalCacheCreate).toBe(100);
    expect(result[0].totalCacheRead).toBe(200);
    expect(result[0].entries).toBe(1);

    expect(result[1].model).toBe('claude-sonnet-4-20250514');
    expect(result[1].totalCostUsd).toBe(0.08);
    expect(result[1].displayName).toMatch(/^Sonnet/);
    expect(result[1].totalInputTokens).toBe(1500);
    expect(result[1].totalOutputTokens).toBe(3000);
    expect(result[1].totalCacheCreate).toBe(75);
    expect(result[1].totalCacheRead).toBe(150);
    expect(result[1].entries).toBe(2);
  });

  it('should handle unknown model (missing model field)', () => {
    const entries: CostEntry[] = [
      {
        timestamp: '2026-03-26 10:00:00',
        taskId: 'TASK-001',
        phase: 'task',
        model: '',
        inputTokens: 100,
        outputTokens: 200,
        cacheCreate: 10,
        cacheRead: 20,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.01,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-002',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 500,
        outputTokens: 1000,
        cacheCreate: 50,
        cacheRead: 100,
        turns: 2,
        durationMs: 3000,
        costUsd: 0.05,
      },
    ];

    const result = aggregateByModel(entries);

    expect(result).toHaveLength(2);
    // Sonnet comes first due to higher cost
    expect(result[0].model).toBe('claude-sonnet-4-20250514');
    expect(result[0].displayName).toMatch(/^Sonnet/);

    expect(result[1].model).toBe('unknown');
    expect(result[1].displayName).toBe('Unknown');
    expect(result[1].totalCostUsd).toBe(0.01);
  });

  it('should handle floating point precision correctly', () => {
    const entries: CostEntry[] = [
      {
        timestamp: '2026-03-26 10:00:00',
        taskId: 'TASK-001',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.01,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-002',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.01,
      },
      {
        timestamp: '2026-03-26 10:00:20',
        taskId: 'TASK-003',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.01,
      },
    ];

    const result = aggregateByModel(entries);

    expect(result).toHaveLength(1);
    expect(result[0].totalCostUsd).toBe(0.03);
    expect(result[0].entries).toBe(3);
  });
});
