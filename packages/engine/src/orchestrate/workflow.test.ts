import { describe, it, expect } from "vitest";
import { defaultWorkflow, parseWorkflowFromTaskContent } from "./workflow";

describe("defaultWorkflow", () => {
  it("work(task) → review(review) 순서", () => {
    const wf = defaultWorkflow();
    expect(wf).toEqual([
      { key: "work", type: "task" },
      { key: "review", type: "review" },
    ]);
  });
});

describe("parseWorkflowFromTaskContent", () => {
  it("frontmatter 없으면 default workflow 반환", () => {
    expect(parseWorkflowFromTaskContent("")).toEqual(defaultWorkflow());
    expect(parseWorkflowFromTaskContent("본문만 있음")).toEqual(
      defaultWorkflow(),
    );
  });

  it("workflow 필드 없으면 default", () => {
    const md = "---\ntitle: Foo\n---\n본문";
    expect(parseWorkflowFromTaskContent(md)).toEqual(defaultWorkflow());
  });

  it("workflow 배열이 비어있으면 default", () => {
    const md = "---\nworkflow: []\n---\n본문";
    expect(parseWorkflowFromTaskContent(md)).toEqual(defaultWorkflow());
  });

  it("workflow 배열이 있으면 파싱", () => {
    const md = [
      "---",
      "workflow:",
      "  - { key: build, type: task }",
      "  - { key: qa, type: check, maxAttempts: 2 }",
      "---",
      "",
    ].join("\n");
    expect(parseWorkflowFromTaskContent(md)).toEqual([
      { key: "build", type: "task" },
      { key: "qa", type: "check", maxAttempts: 2 },
    ]);
  });

  it("유효하지 않은 항목은 버리고 남은 것만 반환", () => {
    const md = [
      "---",
      "workflow:",
      "  - { key: build, type: task }",
      "  - { key: '', type: review }", // empty key
      "  - { key: review }", // missing type
      "---",
      "",
    ].join("\n");
    expect(parseWorkflowFromTaskContent(md)).toEqual([
      { key: "build", type: "task" },
    ]);
  });

  it("모든 항목이 유효하지 않으면 default로 폴백", () => {
    const md = [
      "---",
      "workflow:",
      "  - not-a-record",
      "  - { key: '' }",
      "---",
      "",
    ].join("\n");
    expect(parseWorkflowFromTaskContent(md)).toEqual(defaultWorkflow());
  });

  it("maxAttempts가 숫자 문자열이면 정수로 변환", () => {
    const md = [
      "---",
      "workflow:",
      '  - { key: build, type: task, maxAttempts: "5" }',
      "---",
      "",
    ].join("\n");
    expect(parseWorkflowFromTaskContent(md)).toEqual([
      { key: "build", type: "task", maxAttempts: 5 },
    ]);
  });

  it("maxAttempts가 0 이하면 무시", () => {
    const md = [
      "---",
      "workflow:",
      "  - { key: build, type: task, maxAttempts: 0 }",
      "  - { key: qa, type: check, maxAttempts: -1 }",
      "---",
      "",
    ].join("\n");
    expect(parseWorkflowFromTaskContent(md)).toEqual([
      { key: "build", type: "task" },
      { key: "qa", type: "check" },
    ]);
  });
});
