import { test, expect } from "@playwright/test";
import { setupTaskDetailMocks } from "./helpers/mock";

const TASK_ID = "TASK-001";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    title: "Lifecycle Test Task",
    status: "pending",
    priority: "high",
    created: "2026-03-01T10:00:00",
    content: "## Test task for lifecycle",
    depends_on_detail: [],
    depended_by: [],
    executionLog: null,
    reviewResult: null,
    costEntries: [],
    scope: ["src/components/**"],
    branch: "task/task-001",
    ...overrides,
  };
}

test.describe("Task Run Lifecycle - 개별 실행 상태 전이", () => {
  // ── 실행 시 POST 전송 + 실행 배너 표시 ──────────────────────────────────

  test("실행 버튼 클릭 → POST /run 전송 + 실행 배너 표시", async ({ page }) => {
    let runPosted = false;

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "pending" }),
      runStatus: "idle",
    });

    await page.route(`**/api/tasks/${TASK_ID}/run`, async (route) => {
      if (route.request().method() === "POST") {
        runPosted = true;
        await route.fulfill({ json: { message: `Task ${TASK_ID} started`, taskId: TASK_ID } });
      } else if (route.request().method() === "GET") {
        await route.fulfill({ json: { status: runPosted ? "running" : "idle", logs: [] } });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    // 실행 버튼 클릭
    const runBtn = content.getByRole("button", { name: /실행/ });
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // POST 요청 전송 확인
    expect(runPosted).toBe(true);

    // "태스크 실행 중..." 배너
    await expect(content.getByText("태스크 실행 중...")).toBeVisible();

    // 로그 탭으로 전환
    const logsTab = content.getByRole("button", { name: /로그/ });
    await expect(logsTab).toHaveClass(/border-primary/);
  });

  // ── 중지 시 DELETE 전송 ───────────────────────────────────────────────────

  test("중지 버튼 클릭 → DELETE /run 전송", async ({ page }) => {
    let deleteCalled = false;

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "in_progress" }),
      runStatus: "running",
    });

    await page.route(`**/api/tasks/${TASK_ID}/run`, async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        await route.fulfill({ json: { message: `Task ${TASK_ID} stopped`, status: "stopped" } });
      } else if (route.request().method() === "GET") {
        await route.fulfill({ json: { status: deleteCalled ? "failed" : "running", logs: [] } });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    // 중지 버튼 클릭
    const stopBtn = content.locator('button[class*="bg-red-600"]');
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    expect(deleteCalled).toBe(true);
  });

  // ── in_progress 상태에서 중지 버튼 표시 / 실행 버튼 숨김 ─────────────────

  test("in_progress 상태 → 중지 버튼 표시, 실행 버튼 숨김", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "in_progress" }),
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    // 중지 버튼 보임
    const stopBtn = content.locator('button[class*="bg-red-600"]');
    await expect(stopBtn).toBeVisible();
    await expect(stopBtn).toContainText("중지");

    // 실행 버튼 안 보임
    await expect(content.getByRole("button", { name: /^실행$/ })).not.toBeVisible();
  });

  // ── done 상태에서 실행 버튼 비활성화 ──────────────────────────────────────

  test("done 상태 → 실행 버튼 비활성화", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "done", title: "Done Task" }),
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Done Task", exact: true }).waitFor();

    const runBtn = content.getByRole("button", { name: /실행/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeDisabled();
  });

  // ── 파이프라인 실행 중이면 개별 실행 차단 (API 409) ─────────────────────

  test("파이프라인 실행 중 POST /run → 409 에러 반환", async ({ page }) => {
    let postStatus = 0;

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "pending" }),
    });

    // POST /run이 409를 반환하도록 mock
    await page.route(`**/api/tasks/${TASK_ID}/run`, async (route) => {
      if (route.request().method() === "POST") {
        postStatus = 409;
        await route.fulfill({
          status: 409,
          json: { error: "파이프라인 실행 중입니다. 중지 후 다시 시도하세요." },
        });
      } else if (route.request().method() === "GET") {
        await route.fulfill({ json: { status: "idle", logs: [] } });
      } else {
        await route.continue();
      }
    });

    // alert를 가로채서 메시지 확인
    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    await content.getByRole("button", { name: /실행/ }).click();

    // 409 에러 alert
    await page.waitForTimeout(500);
    expect(postStatus).toBe(409);
    expect(alertMessage).toContain("파이프라인");
  });

  // ── refetch로 status 변경 반영 ────────────────────────────────────────────

  test("GET /requests 재호출 시 변경된 status 반영", async ({ page }) => {
    let currentTask = makeTask({ status: "pending" });

    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: currentTask,
    });

    await page.route(`**/api/requests/${TASK_ID}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: currentTask });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    // 초기: Pending
    const statusSelect = content.locator("select").first();
    await expect(statusSelect).toHaveValue("pending");

    // 서버 측에서 status 변경
    currentTask = { ...currentTask, status: "in_progress" };

    // 페이지 reload로 refetch
    await page.reload();
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    await expect(statusSelect).toHaveValue("in_progress");
  });

  // ── 실행 실패(failed) 시 배너 표시 ────────────────────────────────────────

  test("runStatus=failed → 실행 실패 배너 표시", async ({ page }) => {
    await setupTaskDetailMocks(page, {
      taskId: TASK_ID,
      task: makeTask({ status: "failed" }),
      runStatus: "failed",
    });

    await page.goto(`/tasks/${TASK_ID}`);
    const content = page.locator(".content-container");
    await content.getByRole("heading", { name: "Lifecycle Test Task", exact: true }).waitFor();

    await expect(content.getByText("실행 실패")).toBeVisible();
  });
});
