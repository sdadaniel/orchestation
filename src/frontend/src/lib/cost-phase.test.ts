import { describe, it, expect } from 'vitest';
import { aggregateCostByPhase } from './cost-phase';
import type { CostEntry } from './cost-parser';

describe('aggregateCostByPhase', () => {
  it('should return all zeros for empty input', () => {
    const result = aggregateCostByPhase([]);

    expect(result.taskCost).toBe(0);
    expect(result.reviewCost).toBe(0);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe('0.0');
    expect(result.reviewPct).toBe('0.0');
    expect(result.otherPct).toBe('0.0');
  });

  it('should aggregate costs by phase correctly', () => {
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
        costUsd: 0.10,
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
        costUsd: 0.05,
      },
      {
        timestamp: '2026-03-26 10:00:20',
        taskId: 'TASK-001',
        phase: 'review',
        model: 'claude-opus-4-1-20250805',
        inputTokens: 2000,
        outputTokens: 4000,
        cacheCreate: 100,
        cacheRead: 200,
        turns: 5,
        durationMs: 10000,
        costUsd: 0.20,
      },
      {
        timestamp: '2026-03-26 10:00:30',
        taskId: 'TASK-001',
        phase: 'other',
        model: 'claude-haiku-3-5-20250314',
        inputTokens: 300,
        outputTokens: 600,
        cacheCreate: 30,
        cacheRead: 60,
        turns: 1,
        durationMs: 2000,
        costUsd: 0.05,
      },
    ];

    const result = aggregateCostByPhase(entries);

    expect(result.taskCost).toBeCloseTo(0.15, 5);
    expect(result.reviewCost).toBeCloseTo(0.20, 5);
    expect(result.otherCost).toBeCloseTo(0.05, 5);

    // Total = 0.40
    // task: 0.15 / 0.40 = 37.5%
    // review: 0.20 / 0.40 = 50.0%
    // other: 0.05 / 0.40 = 12.5%
    expect(result.taskPct).toBe('37.5');
    expect(result.reviewPct).toBe('50.0');
    expect(result.otherPct).toBe('12.5');
  });

  it('should handle case-insensitive phase names', () => {
    const entries: CostEntry[] = [
      {
        timestamp: '2026-03-26 10:00:00',
        taskId: 'TASK-001',
        phase: 'TASK',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.10,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-001',
        phase: 'REVIEW',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.10,
      },
    ];

    const result = aggregateCostByPhase(entries);

    expect(result.taskCost).toBe(0.10);
    expect(result.reviewCost).toBe(0.10);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe('50.0');
    expect(result.reviewPct).toBe('50.0');
  });

  it('should treat undefined/empty phase as "other"', () => {
    const entries: CostEntry[] = [
      {
        timestamp: '2026-03-26 10:00:00',
        taskId: 'TASK-001',
        phase: '',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.10,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-001',
        phase: 'task',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.10,
      },
    ];

    const result = aggregateCostByPhase(entries);

    expect(result.taskCost).toBe(0.10);
    expect(result.reviewCost).toBe(0);
    expect(result.otherCost).toBe(0.10);
    expect(result.taskPct).toBe('50.0');
    expect(result.reviewPct).toBe('0.0');
    expect(result.otherPct).toBe('50.0');
  });

  it('should handle total cost = 0 without division by zero', () => {
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
        costUsd: 0,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-001',
        phase: 'review',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0,
      },
    ];

    const result = aggregateCostByPhase(entries);

    expect(result.taskCost).toBe(0);
    expect(result.reviewCost).toBe(0);
    expect(result.otherCost).toBe(0);
    expect(result.taskPct).toBe('0.0');
    expect(result.reviewPct).toBe('0.0');
    expect(result.otherPct).toBe('0.0');
  });

  it('should handle mixed phases with correct percentage rounding', () => {
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
        costUsd: 0.333,
      },
      {
        timestamp: '2026-03-26 10:00:10',
        taskId: 'TASK-001',
        phase: 'review',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.333,
      },
      {
        timestamp: '2026-03-26 10:00:20',
        taskId: 'TASK-001',
        phase: 'deployment',
        model: 'claude-sonnet-4-20250514',
        inputTokens: 100,
        outputTokens: 100,
        cacheCreate: 0,
        cacheRead: 0,
        turns: 1,
        durationMs: 1000,
        costUsd: 0.334,
      },
    ];

    const result = aggregateCostByPhase(entries);

    expect(result.taskCost).toBe(0.333);
    expect(result.reviewCost).toBe(0.333);
    expect(result.otherCost).toBe(0.334);

    // Total = 1.0
    // Each should be 33.3%, 33.3%, 33.4%
    expect(result.taskPct).toBe('33.3');
    expect(result.reviewPct).toBe('33.3');
    expect(result.otherPct).toBe('33.4');
  });
});
