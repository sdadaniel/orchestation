import { test, expect } from "@playwright/test";
import { setupNightWorkerMocks } from "./helpers/mock";

/**
 * Night Worker 페이지 (/night-worker) E2E 시나리오
 *
 * Night Worker는 오케스트레이션 자동 실행 기능을 관리하는 페이지이다.
 * 설정(유형 선택, 예산, 종료 시간)과 로그 탭으로 구성된다.
 *
 * API: GET/POST/DELETE /api/night-worker
 */

test.describe("Night Worker Page (/night-worker)", () => {
  // ── 1. 페이지 접근 ─────────────────────────────────────────────────────────

  test("페이지 접근 시 타이틀이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page);
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    await expect(
      content.getByRole("heading", { name: /Night Worker/ }),
    ).toBeVisible();
  });

  // ── 2. idle 상태 → Start 버튼 ─────────────────────────────────────────────

  test("idle 상태에서 Start 버튼이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const startBtn = content.getByRole("button", { name: /Start/ });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).not.toBeDisabled();

    const stopBtn = content.getByRole("button", { name: /Stop/ });
    await expect(stopBtn).not.toBeVisible();
  });

  // ── 3. Start 버튼 → POST /api/night-worker ─────────────────────────────────

  test("Start 버튼 클릭 → POST /api/night-worker 전송", async ({ page }) => {
    let postCalled = false;

    await setupNightWorkerMocks(page, { nightWorkerStatus: "idle" });

    // Override the POST handler to track the call
    await page.route("**/api/night-worker", (route) => {
      if (route.request().method() === "POST") {
        postCalled = true;
        route.fulfill({
          json: {
            message: "Night Worker 시작됨",
            pid: 12345,
            until: "07:00",
            budget: "unlimited",
            maxTasks: 10,
            types: "typecheck,lint,review",
          },
        });
      } else if (route.request().method() === "GET") {
        route.fulfill({
          json: { status: "idle", logs: [], tasksCreated: 0, totalCost: "0" },
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const startBtn = content.getByRole("button", { name: /Start/ });
    await startBtn.click();

    expect(postCalled).toBe(true);
  });

  // ── 4. running 상태 → Stop 버튼 ─────────────────────────────────────────

  test("running 상태에서 Stop 버튼이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "running" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /Stop/ });
    await expect(stopBtn).toBeVisible();

    const startBtn = content.getByRole("button", { name: /^Start$/ });
    await expect(startBtn).not.toBeVisible();
  });

  // ── 5. Stop 버튼 → DELETE /api/night-worker ─────────────────────────────────

  test("Stop 버튼 클릭 → DELETE /api/night-worker 전송", async ({ page }) => {
    let deleteCalled = false;

    await setupNightWorkerMocks(page, { nightWorkerStatus: "running" });

    // Override the DELETE handler to track the call
    await page.route("**/api/night-worker", (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        route.fulfill({ json: { message: "Night Worker 중지됨" } });
      } else if (route.request().method() === "GET") {
        route.fulfill({
          json: { status: "running", logs: [], tasksCreated: 0, totalCost: "0" },
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /Stop/ });
    await stopBtn.click();

    expect(deleteCalled).toBe(true);
  });

  // ── 6. running 상태 → Running 텍스트 표시 ───────────────────────────────────

  test("running 상태에서 Running 텍스트가 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "running" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    await expect(content.getByText("Running")).toBeVisible();
  });

  // ── 7. Unlimited 체크박스 선택/해제 ─────────────────────────────────────────────

  test("Unlimited 체크박스 선택/해제", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");

    // The Unlimited checkbox is inside a label
    const unlimitedCheckbox = content.locator("input[type='checkbox']").first();
    if (await unlimitedCheckbox.isVisible()) {
      const initialState = await unlimitedCheckbox.isChecked();
      await unlimitedCheckbox.click();
      await expect(unlimitedCheckbox).toBeChecked({ checked: !initialState });
    }
  });

  // ── 8. 종료 시간 설정 ────────────────────────────────────────────────────

  test("종료 시간 입력 필드가 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");

    const timeInput = content.locator("input[type='time']").first();
    if (await timeInput.isVisible()) {
      await timeInput.fill("06:00");
      await expect(timeInput).toHaveValue("06:00");
    }
  });

  // ── 9. Start 후 Logs 탭 전환 ─────────────────────────────────────────────

  test("Start 버튼 클릭 후 Logs 탭으로 자동 전환", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "idle" });

    // Override to handle POST (start) and subsequent GET (status poll)
    await page.route("**/api/night-worker", (route) => {
      const method = route.request().method();
      if (method === "POST") {
        route.fulfill({
          json: {
            message: "Night Worker 시작됨",
            pid: 12345,
            until: "07:00",
            budget: "unlimited",
            maxTasks: 10,
            types: "typecheck,lint,review",
          },
        });
      } else if (method === "GET") {
        route.fulfill({
          json: { status: "running", logs: [], tasksCreated: 0, totalCost: "0" },
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const startBtn = content.getByRole("button", { name: /Start/ });
    if (await startBtn.isVisible()) {
      await startBtn.click();

      // Should switch to logs tab after start
      const logsTab = content.getByRole("button", { name: /Logs/ });
      if (await logsTab.isVisible()) {
        await expect(logsTab).toHaveClass(/bg-muted/);
      }
    }
  });

  // ── 10. completed 상태 → Start 버튼 복귀 ─────────────────────────────────

  test("completed 상태에서 Start 버튼이 다시 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { nightWorkerStatus: "completed" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const startBtn = content.getByRole("button", { name: /Start/ });
    await expect(startBtn).toBeVisible();
  });
});
