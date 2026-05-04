import { describe, it, expect } from "vitest";
import {
  parseClaudePrintJsonEnvelope,
  handleStreamJsonLine,
  usageFromCliResultRoot,
} from "./claude-cli-result";

describe("parseClaudePrintJsonEnvelope", () => {
  it("reads result text and usage from CLI json wrapper", () => {
    const stdout = JSON.stringify({
      result: '{"suggestions":[]}',
      total_cost_usd: 0.012,
      usage: { input_tokens: 100, output_tokens: 50 },
    });
    const { resultText, usage } = parseClaudePrintJsonEnvelope(stdout);
    expect(resultText).toBe('{"suggestions":[]}');
    expect(usage.costUsd).toBeCloseTo(0.012);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
  });
});

describe("usageFromCliResultRoot", () => {
  it("falls back to top-level token fields", () => {
    const u = usageFromCliResultRoot({
      cost_usd: 0.05,
      input_tokens: 10,
      output_tokens: 20,
    });
    expect(u.costUsd).toBeCloseTo(0.05);
    expect(u.inputTokens).toBe(10);
    expect(u.outputTokens).toBe(20);
  });
});

describe("handleStreamJsonLine", () => {
  it("extracts usage from result event", () => {
    const h = handleStreamJsonLine({
      type: "result",
      result: "hello",
      total_cost_usd: 0.001,
      usage: { input_tokens: 5, output_tokens: 3 },
    });
    expect(h.usage?.costUsd).toBeCloseTo(0.001);
    expect(h.resultText).toBe("hello");
  });

  it("extracts text_delta from stream_event", () => {
    const h = handleStreamJsonLine({
      type: "stream_event",
      event: {
        delta: { type: "text_delta", text: "Hi" },
      },
    });
    expect(h.textDelta).toBe("Hi");
  });
});
