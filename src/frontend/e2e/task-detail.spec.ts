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
});
