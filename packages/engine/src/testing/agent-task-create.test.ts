/**
 * 에이전트 단계별 회귀용: 수동 태스크 생성(createTask) 후
 * 대시보드 AI 대화 로그(dashboard-ai-*.jsonl)와 비용 로그(token-usage.log) 꼬리를 한 JSONL에 모은다.
 *
 * createTask 자체는 LLM을 부르지 않으므로, 이 테스트만 실행하면 대화/비용 꼬리는 비어 있을 수 있다.
 * (이후 /api/tasks/analyze 등 LLM 단계 테스트를 같은 리포터로 붙이면 한 파일에 누적된다.)
 *
 * 실행:
 *   pnpm --filter @orchestration/dashboard run test:agent:task-create
 * 리포트 사본: packages/engine/agent-test-reports/latest-task-create.jsonl
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  appendAgentTestEvent,
  collectOrchestrationLogArtifacts,
  getCurrentAgentTestLogPath,
  resetAgentTestLogForTests,
  startAgentTestRun,
} from "./agent-test-report";

describe("agent — manual task creation (logged)", () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orch-agent-task-"));
  });

  afterAll(() => {
    resetAgentTestLogForTests();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("writes agent-test JSONL with task row + conversation/cost tails", async () => {
    vi.resetModules();
    resetAgentTestLogForTests();
    process.env.PROJECT_ROOT = tmpRoot;

    const logPath = startAgentTestRun({
      suite: "task-create-manual",
      projectRoot: tmpRoot,
    });

    const { resetDbConnectionsForTests, closeDb } = await import("../service/db");
    resetDbConnectionsForTests();

    const { OUTPUT_DIR, LOGS_DIR } = await import("../lib/config/paths");
    const { createTask, getTask, getTaskSteps } = await import("../service/task-store");

    const created = createTask({
      title: "[agent-test] manual task",
      content:
        "---\nworkflow:\n  - key: work\n    type: task\n    max_attempts: 1\n---\n\nDo work.",
      priority: "medium",
      role: "general",
    });

    const full = getTask(created.id);
    const steps = getTaskSteps(created.id);

    const artifacts = collectOrchestrationLogArtifacts({
      outputDir: OUTPUT_DIR,
      logsDir: LOGS_DIR,
    });

    appendAgentTestEvent({
      step: "manual_create_task",
      note: "DB insert via createTask — no Claude call in this step",
      task: {
        id: full?.id,
        display_id: full?.display_id,
        title: full?.title,
        status: full?.status,
        priority: full?.priority,
        role: full?.role,
        content_preview: (full?.content ?? "").slice(0, 400),
        step_count: steps.length,
        step_keys: steps.map((s) => s.step_key),
      },
      artifacts,
      conversation_excerpt: {
        dashboard_ai_record_count: artifacts.dashboard_ai_records_tail.length,
        message:
          artifacts.dashboard_ai_records_tail.length === 0
            ? "이 단계에서는 LLM 미호출 — analyze/suggest API 테스트 시 여기 채워짐"
            : "dashboard-ai JSONL tail attached in artifacts",
      },
      cost_excerpt: {
        token_usage_line_count: artifacts.token_usage_tail.length,
        message:
          artifacts.token_usage_tail.length === 0
            ? "이 단계에서는 token-usage.log 비어 있음 — 워커/대시보드 AI 호출 후 tail 생김"
            : "token-usage.log tail in artifacts.token_usage_tail",
      },
    });

    appendAgentTestEvent({
      step: "run_finished",
      note: "리포트 경로는 stdout에도 출력됨",
      log_file: logPath,
    });

    const engineReports = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "agent-test-reports",
    );
    fs.mkdirSync(engineReports, { recursive: true });
    const copyTo = path.join(engineReports, "latest-task-create.jsonl");
    fs.copyFileSync(logPath, copyTo);

    closeDb();

    expect(full?.title).toBe("[agent-test] manual task");
    expect(full?.status).toBe("pending");
    expect(steps.length).toBeGreaterThan(0);

    const raw = fs.readFileSync(logPath, "utf-8");
    const events = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { step: string });
    expect(events.some((e) => e.step === "run_start")).toBe(true);
    expect(events.some((e) => e.step === "manual_create_task")).toBe(true);
    expect(events.some((e) => e.step === "run_finished")).toBe(true);

    console.info(`\n[agent-test] full log: ${getCurrentAgentTestLogPath() ?? logPath}`);
    console.info(`[agent-test] latest copy: ${copyTo}\n`);
  });
});
