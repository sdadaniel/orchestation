import { test, expect } from "@playwright/test";
import { setupTaskListMocks } from "./helpers/mock";

/**
 * AutoImproveControl은 AppShell의 .global-header 영역에 위치한다.
 * /tasks 페이지로 이동 후 .global-header 내 버튼을 검증한다.
 *
 * 오케스트레이션 상태는 SSE mock의 orchestration-status 이벤트로 주입된다.
 */

test.describe("AutoImproveControl", () => {
  // ── idle → Run 버튼 ────────────────────────────────────────────────────────

  test("idle 상태에서 Run 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "idle" });
    await page.goto("/tasks");

    const header = page.locator(".global-header");
    const runBtn = header.getByRole("button", { name: /^Run$/ });
    await expect(runBtn).toBeVisible({ timeout: 5_000 });
    await expect(runBtn).not.toBeDisabled();

    // Stop button should NOT be visible in idle state
    await expect(header.getByRole("button", { name: /^Stop$/ })).not.toBeVisible();
    // "Stopping..." should NOT be visible
    await expect(header.getByText("Stopping...")).not.toBeVisible();
  });

  // ── running → Stop 버튼 ────────────────────────────────────────────────────

  test("running 상태에서 Stop 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "running" });
    await page.goto("/tasks");

    const header = page.locator(".global-header");
    const stopBtn = header.getByRole("button", { name: /^Stop$/ });
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });

    // Run button should NOT be visible when running
    await expect(header.getByRole("button", { name: /^Run$/ })).not.toBeVisible();
  });

  // ── stopping → "Stopping..." 표시 ─────────────────────────────────────────

  test("stopping 상태에서 'Stopping...' 텍스트가 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "stopping" });
    await page.goto("/tasks");

    const header = page.locator(".global-header");
    await expect(header.getByText("Stopping...")).toBeVisible({ timeout: 5_000 });

    // Neither Run nor Stop button should be shown
    await expect(header.getByRole("button", { name: /^Run$/ })).not.toBeVisible();
    await expect(header.getByRole("button", { name: /^Stop$/ })).not.toBeVisible();
  });

  // ── completed → Run 버튼 (idle과 동일) ────────────────────────────────────

  test("completed 상태에서 Run 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, { orchestrateStatus: "completed" });
    await page.goto("/tasks");

    const header = page.locator(".global-header");
    await expect(header.getByRole("button", { name: /^Run$/ })).toBeVisible({ timeout: 5_000 });
    await expect(header.getByText("Stopping...")).not.toBeVisible();
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

    const header = page.locator(".global-header");
    const runBtn = header.getByRole("button", { name: /^Run$/ });
    await expect(runBtn).toBeVisible({ timeout: 5_000 });
    await runBtn.click();

    expect(runCalled).toBe(true);
  });

  // ── Stop 클릭 → stop 요청 전송 ────────────────────────────────────────────

  test("Stop 버튼 클릭 시 orchestrate/stop POST 요청 전송", async ({ page }) => {
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

    const header = page.locator(".global-header");
    const stopBtn = header.getByRole("button", { name: /^Stop$/ });
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });
    await stopBtn.click();

    expect(stopCalled).toBe(true);
  });
});
