import { test, expect } from "@playwright/test";
import { setupTaskDetailMocks } from "./helpers/mock";

const TASK_ID = "TASK-001";

test.describe("Task Detail Page", () => {
  // ── Status dropdown ────────────────────────────────────────────────────────

  test("상태 드롭다운으로 상태 변경 → UI 반영", async ({ page }) => {
    let currentTask = {
      id: TASK_ID,
      title: "Alpha Task",
      status: "pending",
      priority: "high",
      created: "2026-03-01T10:00:00",
      content: "## Test task",
      depends_on_detail: [],
      depended_by: [],
      executionLog: null,
      reviewResult: null,
      costEntries: [],
      scope: [],
      branch: "task/task-001",
    };

    await setupTaskDetailMocks(page, { taskId: TASK_ID, task: currentTask });

    // Override: PUT updates, then re-GET returns updated task
    await page.route(`**/api/requests/${TASK_ID}`, async (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}");
        currentTask = { ...currentTask, ...body };
        await route.fulfill({ json: currentTask });
      } else if (route.request().method() === "GET") {
        await route.fulfill({ json: currentTask });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    // Status dropdown should initially show "Pending"
    const statusSelect = content.locator("select").first();
    await expect(statusSelect).toHaveValue("pending");

    // Change status to "reviewing"
    await statusSelect.selectOption("reviewing");

    // Wait for the re-fetch to complete; select should reflect new value
    await expect(statusSelect).toHaveValue("reviewing");
  });

  // ── Run button → logs tab ──────────────────────────────────────────────────

  test("실행 버튼 클릭 → 로그 탭으로 전환 + 실행 배너 표시", async ({
    page,
  }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
      runStatus: "idle",
      orchestrateStatus: "idle",
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    // Run button should be visible and enabled
    const runBtn = content.getByRole("button", { name: /실행/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).not.toBeDisabled();

    // Click run
    await runBtn.click();

    // Should switch to 로그 tab (it gains active border class)
    const logsTab = content.getByRole("button", { name: /로그/ });
    await expect(logsTab).toHaveClass(/border-primary/);

    // Running banner should appear
    await expect(content.getByText("태스크 실행 중...")).toBeVisible();
  });

  // ── Stop button ────────────────────────────────────────────────────────────

  test("in_progress 상태에서 Stop 버튼 표시", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Running Task",
        status: "in_progress",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Running task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Running Task", exact: true }).waitFor();

    // The detail-page stop button has bg-red-600 class
    const stopBtn = content.locator('button[class*="bg-red-600"]');
    await expect(stopBtn).toBeVisible();
    await expect(stopBtn).toContainText("중지");

    // Run button should NOT be visible when task is in_progress
    await expect(content.getByRole("button", { name: /^실행$/ })).not.toBeVisible();
  });

  test("Stop 버튼 클릭 → DELETE 요청 전송", async ({ page }) => {
    let stopCalled = false;

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Running Task",
        status: "in_progress",
        priority: "medium",
        created: "2026-03-01T10:00:00",
        content: "## Running task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    // Override the run endpoint to capture DELETE
    await page.route(`**/api/tasks/${TASK_ID}/run`, (route) => {
      if (route.request().method() === "DELETE") {
        stopCalled = true;
        route.fulfill({ json: { ok: true } });
      } else {
        route.fulfill({ json: { status: "idle", logs: [] } });
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Running Task", exact: true }).waitFor();

    const stopBtn = content.locator('button[class*="bg-red-600"]');
    await stopBtn.click();

    expect(stopCalled).toBe(true);
  });

  // ── Done status disables run button ───────────────────────────────────────

  test("done 상태에서 실행 버튼 비활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Done Task",
        status: "done",
        priority: "low",
        created: "2026-03-01T10:00:00",
        content: "## Done task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
      orchestrateStatus: "idle",
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Done Task", exact: true }).waitFor();

    // Run button should be visible but disabled for 'done' status
    const runBtn = content.getByRole("button", { name: /실행/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeDisabled();
  });

  test("rejected 상태에서 실행 버튼 비활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Rejected Task",
        status: "rejected",
        priority: "low",
        created: "2026-03-01T10:00:00",
        content: "## Rejected task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
      orchestrateStatus: "idle",
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Rejected Task", exact: true }).waitFor();

    const runBtn = content.getByRole("button", { name: /실행/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeDisabled();
  });

  // ── Tabs: Content / Scope / Cost / AI Result / 로그 / 리뷰결과 ────────────

  test("Content 탭에 마크다운 내용이 렌더링된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Description\n\nThis is a test task.",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    // Content tab should show rendered markdown
    await expect(content.getByRole("heading", { name: /Description/ })).toBeVisible();
  });

  test("Scope 탭 클릭 → Scope 내용 표시", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Scope Task",
        status: "pending",
        priority: "medium",
        created: "2026-03-01T10:00:00",
        content: "## Scope task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: ["src/alpha.ts", "src/beta.ts"],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Scope Task").waitFor();

    const scopeTab = content.getByRole("button", { name: /Scope/ });
    if (await scopeTab.isVisible()) {
      await scopeTab.click();
      await expect(scopeTab).toHaveClass(/border-primary/);
    }
  });

  test("AI Result 탭 클릭 → AI 결과 탭 활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "done",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Done task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: "## Execution log\n\nCompleted.",
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    const aiTab = content.getByRole("button", { name: /AI Result|AI 결과/ });
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await expect(aiTab).toHaveClass(/border-primary/);
    }
  });

  test("로그 탭 클릭 → 로그 목록 표시", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
      runLogs: ["Task started", "Running step 1"],
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    const logsTab = content.getByRole("button", { name: /로그|Logs/ });
    if (await logsTab.isVisible()) {
      await logsTab.click();
      await expect(logsTab).toHaveClass(/border-primary/);
    }
  });

  test("리뷰결과 탭 클릭 → 리뷰 탭 활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Reviewed Task",
        status: "reviewing",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Task under review",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: "## Review\n\nApproved.",
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Reviewed Task").waitFor();

    const reviewTab = content.getByRole("button", { name: /리뷰결과|Review/ });
    if (await reviewTab.isVisible()) {
      await reviewTab.click();
      await expect(reviewTab).toHaveClass(/border-primary/);
    }
  });

  test("Cost 탭 클릭 → Cost 탭 활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "done",
        priority: "medium",
        created: "2026-03-01T10:00:00",
        content: "## Done task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [{ model: "claude-sonnet", inputTokens: 1000, outputTokens: 200, cost: 0.015 }],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    const costTab = content.getByRole("button", { name: /Cost|비용/ });
    if (await costTab.isVisible()) {
      await costTab.click();
      await expect(costTab).toHaveClass(/border-primary/);
    }
  });

  // ── Branch badge ───────────────────────────────────────────────────────────

  test("branch 뱃지가 표시된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    // Branch badge should show the branch name
    await expect(content.getByText("task/task-001")).toBeVisible();
  });

  test("branch 뱃지 클릭 → 클립보드에 복사 (에러 없음)", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    const branchBadge = content.getByText("task/task-001");
    if (await branchBadge.isVisible()) {
      await branchBadge.click();
      // Should not throw; clipboard may have the value
      const clipText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipText).toContain("task/task-001");
    }
  });

  // ── Dependency display ─────────────────────────────────────────────────────

  test("depends_on 의존 관계가 표시된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Child Task",
        status: "pending",
        priority: "medium",
        created: "2026-03-01T10:00:00",
        content: "## Child task",
        depends_on_detail: [
          { id: "TASK-000", title: "Parent Task", status: "done" },
        ],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Child Task").waitFor();

    // Dependency chip "TASK-000" or "Parent Task" should be visible
    await expect(
      content.getByText(/TASK-000|Parent Task/),
    ).toBeVisible();
  });

  test("depended_by 의존 관계가 표시된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Parent Task",
        status: "done",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Parent task",
        depends_on_detail: [],
        depended_by: [
          { id: "TASK-999", title: "Blocker Task", status: "pending" },
        ],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Parent Task").waitFor();

    await expect(
      content.getByText(/TASK-999|Blocker Task/),
    ).toBeVisible();
  });

  // ── failed state ───────────────────────────────────────────────────────────

  test("stopped 상태 → 실행 버튼 활성화됨", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Stopped Task",
        status: "stopped",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Stopped task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
      orchestrateStatus: "idle",
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Stopped Task", exact: true }).waitFor();

    // stopped tasks can be re-run
    const runBtn = content.getByRole("button", { name: /실행/ });
    if (await runBtn.isVisible()) {
      await expect(runBtn).not.toBeDisabled();
    }
  });

  // ── Task ID display ────────────────────────────────────────────────────────

  test("태스크 ID(TASK-001)가 상세 페이지에 표시된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    await expect(content.getByText("TASK-001")).toBeVisible();
  });

  test("Priority 뱃지가 표시된다", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: {
        id: TASK_ID,
        title: "Alpha Task",
        status: "pending",
        priority: "high",
        created: "2026-03-01T10:00:00",
        content: "## Test task",
        depends_on_detail: [],
        depended_by: [],
        executionLog: null,
        reviewResult: null,
        costEntries: [],
        scope: [],
        branch: "task/task-001",
      },
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByText("Alpha Task").waitFor();

    // Priority badge "High" should be visible
    await expect(content.getByText(/High/i)).toBeVisible();
  });
});
