import { describe, it, expect } from "vitest";
import { canRetryReview } from "./task-transitions";

describe("canRetryReview", () => {
  it("현재 카운트가 max 미만이면 retry 가능", () => {
    expect(canRetryReview(0, 3)).toBe(true);
    expect(canRetryReview(2, 3)).toBe(true);
  });

  it("현재 카운트가 max 이상이면 retry 불가", () => {
    expect(canRetryReview(3, 3)).toBe(false);
    expect(canRetryReview(4, 3)).toBe(false);
  });

  it("max가 0이면 즉시 불가", () => {
    expect(canRetryReview(0, 0)).toBe(false);
  });
});
