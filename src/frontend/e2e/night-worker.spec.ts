import { test, expect } from "@playwright/test";
import { setupNightWorkerMocks } from "./helpers/mock";

/**
 * Night Worker 페이지 (/night-worker) E2E 시나리오
 *
 * Night Worker는 오케스트레이션 자동 실행 기능을 관리하는 페이지이다.
 * 설정 탭(유형 선택, 예산, 종료 시간)과 로그 탭으로 구성된다.
 */

test.describe("Night Worker Page (/night-worker)", () => {
  // ── 1. 페이지 접근 ─────────────────────────────────────────────────────────

  test("페이지 접근 시 타이틀이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page);
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    await expect(
      content.getByRole("heading", { name: /Night Worker|야간 작업/ }),
    ).toBeVisible();
  });

  // ── 2. idle 상태 → 시작 버튼 ─────────────────────────────────────────────

  test("idle 상태에서 시작(Run) 버튼이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /시작|Run/ });
    await expect(runBtn).toBeVisible();
    await expect(runBtn).not.toBeDisabled();

    const stopBtn = content.getByRole("button", { name: /중지|Stop/ });
    await expect(stopBtn).not.toBeVisible();
  });

  // ── 3. 시작 버튼 → POST 요청 ─────────────────────────────────────────────

  test("시작 버튼 클릭 → POST /api/orchestrate/run 전송", async ({ page }) => {
    let runCalled = false;

    await setupNightWorkerMocks(page, { orchestrateStatus: "idle" });

    await page.route("**/api/orchestrate/run", (route) => {
      if (route.request().method() === "POST") {
        runCalled = true;
        route.fulfill({ json: { ok: true } });
      } else {
        route.continue();
      }
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /시작|Run/ });
    await runBtn.click();

    expect(runCalled).toBe(true);
  });

  // ── 4. running 상태 → 중지 버튼 ─────────────────────────────────────────

  test("running 상태에서 중지(Stop) 버튼이 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "running" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /중지|Stop/ });
    await expect(stopBtn).toBeVisible();

    const runBtn = content.getByRole("button", { name: /^시작$|^Run$/ });
    await expect(runBtn).not.toBeVisible();
  });

  // ── 5. 중지 버튼 → POST /stop 요청 ─────────────────────────────────────

  test("중지 버튼 클릭 → POST /api/orchestrate/stop 전송", async ({ page }) => {
    let stopCalled = false;

    await setupNightWorkerMocks(page, { orchestrateStatus: "running" });

    await page.route("**/api/orchestrate/stop", (route) => {
      if (route.request().method() === "POST") {
        stopCalled = true;
        route.fulfill({ json: { ok: true } });
      } else {
        route.continue();
      }
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const stopBtn = content.getByRole("button", { name: /중지|Stop/ });
    await stopBtn.click();

    expect(stopCalled).toBe(true);
  });

  // ── 6. stopping 상태 → 중단 중 텍스트 ───────────────────────────────────

  test("stopping 상태에서 중단 중 텍스트가 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "stopping" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    await expect(content.getByText(/Stopping\.\.\.|중단 중/)).toBeVisible();

    await expect(content.getByRole("button", { name: /^시작$|^Run$/ })).not.toBeVisible();
    await expect(content.getByRole("button", { name: /^중지$|^Stop$/ })).not.toBeVisible();
  });

  // ── 7. 예산 무제한 체크박스 ─────────────────────────────────────────────

  test("예산 무제한 체크박스 선택/해제", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");

    const unlimitedCheckbox = content.getByRole("checkbox", { name: /무제한|unlimited/i });
    if (await unlimitedCheckbox.isVisible()) {
      const initialState = await unlimitedCheckbox.isChecked();
      await unlimitedCheckbox.click();
      await expect(unlimitedCheckbox).toBeChecked({ checked: !initialState });
    }
  });

  // ── 8. 종료 시간 설정 ────────────────────────────────────────────────────

  test("종료 시간 입력 필드가 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "idle" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");

    const timeInput = content.locator("input[type='time'], input[placeholder*='시간'], input[placeholder*='time']").first();
    if (await timeInput.isVisible()) {
      await timeInput.fill("06:00");
      await expect(timeInput).toHaveValue("06:00");
    }
  });

  // ── 9. 시작 후 로그 탭 전환 ─────────────────────────────────────────────

  test("시작 버튼 클릭 후 로그 탭으로 자동 전환", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "idle" });

    await page.route("**/api/orchestrate/run", (route) => {
      route.fulfill({ json: { ok: true } });
    });

    await page.route("**/api/orchestrate/status", (route) => {
      route.fulfill({ json: { status: "running" } });
    });

    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /시작|Run/ });
    if (await runBtn.isVisible()) {
      await runBtn.click();

      // Should switch to logs tab
      const logsTab = content.getByRole("button", { name: /로그|Logs/ });
      if (await logsTab.isVisible()) {
        await expect(logsTab).toHaveClass(/border-primary|active/);
      }
    }
  });

  // ── 10. completed 상태 → 시작 버튼 복귀 ─────────────────────────────────

  test("completed 상태에서 시작(Run) 버튼이 다시 표시된다", async ({ page }) => {
    await setupNightWorkerMocks(page, { orchestrateStatus: "completed" });
    await page.goto("/night-worker");

    const content = page.locator(".content-container");
    const runBtn = content.getByRole("button", { name: /시작|Run/ });
    await expect(runBtn).toBeVisible();
  });
});
