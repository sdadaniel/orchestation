import { test, expect } from "@playwright/test";
import { setupTaskListMocks } from "./helpers/mock";

/**
 * AutoImproveControl is embedded in the Tasks page header.
 * We test it by mocking /api/orchestrate/status and navigating to /tasks.
 */

test.describe("AutoImproveControl", () => {
  // ── idle → Run 버튼 ────────────────────────────────────────────────────────

  test("idle 상태에서 Run 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "idle" });
    await page.goto("/tasks");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /^Run$/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).not.toBeDisabled();

    // Stop button should NOT be visible in idle state
    await expect(content.getByRole("button", { name: /^Stop$/ })).not.toBeVisible();
    // "Stopping..." should NOT be visible
    await expect(content.getByText("Stopping...")).not.toBeVisible();
  });

  // ── running → Stop 버튼 ────────────────────────────────────────────────────

  test("running 상태에서 Stop 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "running" });
    await page.goto("/tasks");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /^Stop$/ });
    await expect(stopBtn).toBeVisible();

    // Run button should NOT be visible when running
    await expect(content.getByRole("button", { name: /^Run$/ })).not.toBeVisible();
  });

  // ── stopping → "Stopping..." 표시 ─────────────────────────────────────────

  test("stopping 상태에서 'Stopping...' 텍스트가 표시된다", async ({
    page,
  }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "stopping" });
    await page.goto("/tasks");

    const content = page.locator(".content-container");
    await expect(content.getByText("Stopping...")).toBeVisible();

    // Neither Run nor Stop button should be shown
    await expect(content.getByRole("button", { name: /^Run$/ })).not.toBeVisible();
    await expect(content.getByRole("button", { name: /^Stop$/ })).not.toBeVisible();
  });

  // ── completed → Run 버튼 (idle과 동일) ────────────────────────────────────

  test("completed 상태에서 Run 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "completed" });
    await page.goto("/tasks");

    const content = page.locator(".content-container");
    await expect(content.getByRole("button", { name: /^Run$/ })).toBeVisible();
    await expect(content.getByText("Stopping...")).not.toBeVisible();
  });

  // ── Run 클릭 → running 상태로 전환 ────────────────────────────────────────

  test("Run 버튼 클릭 시 orchestrate/run POST 요청 전송", async ({ page }) => {
    let runCalled = false;

    await setupTaskListMocks(page, { orchestrateStatus: "idle" });

    // Override orchestrate run route
    await page.route("**/api/orchestrate/run", (route) => {
      if (route.request().method() === "POST") {
        runCalled = true;
        route.fulfill({ json: { ok: true } });
      } else {
        route.continue();
      }
    });

    await page.goto("/tasks");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /^Run$/ });
    await runBtn.click();

    expect(runCalled).toBe(true);
  });

  // ── Stop 클릭 → stop 요청 전송 ────────────────────────────────────────────

  test("Stop 버튼 클릭 시 orchestrate/stop POST 요청 전송", async ({
    page,
  }) => {
    let stopCalled = false;

    await setupTaskListMocks(page, { orchestrateStatus: "running" });

    await page.route("**/api/orchestrate/stop", (route) => {
      if (route.request().method() === "POST") {
        stopCalled = true;
        route.fulfill({ json: { ok: true } });
      } else {
        route.continue();
      }
    });

    await page.goto("/tasks");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /^Stop$/ });
    await stopBtn.click();

    expect(stopCalled).toBe(true);
  });
});
