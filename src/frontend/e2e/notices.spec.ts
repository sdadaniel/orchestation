import { test, expect } from "@playwright/test";
import { setupNoticesMocks, MOCK_NOTICES } from "./helpers/mock";

test.describe("Notices Page (/notices)", () => {
  // ── Notice 목록 표시 ───────────────────────────────────────────────────────

  test("Notice 목록이 표시된다", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const content = page.locator(".content-container");

    // Page title
    await expect(content.getByRole("heading", { name: "Notices" })).toBeVisible();

    // All mock notices should be visible (using exact text + scope)
    await expect(content.getByText("Info notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Warning notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Error notice", { exact: true })).toBeVisible();
  });

  test("알림이 없을 때 '알림이 없습니다.' 표시", async ({ page }) => {
    await setupNoticesMocks(page, []);
    await page.goto("/notices");

    await expect(
      page.locator(".content-container").getByText("알림이 없습니다."),
    ).toBeVisible();
  });

  // ── 필터 탭 active 상태 ────────────────────────────────────────────────────

  test("필터 탭 기본 active 상태는 'All'", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const content = page.locator(".content-container");
    const allFilter = content.getByRole("button", { name: /^All$/ });
    await expect(allFilter).toHaveClass(/active/);
  });

  test("Info 필터 클릭 시 active 상태 변경 및 필터링", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const content = page.locator(".content-container");
    await content.getByText("Info notice", { exact: true }).waitFor();

    const allFilter = content.getByRole("button", { name: /^All$/ });
    const infoFilter = content.getByRole("button", { name: /^Info$/ });

    // Click Info filter
    await infoFilter.click();
    // Info filter becomes active (has bg-blue-500 badge class)
    await expect(infoFilter).toHaveClass(/bg-blue-500/);
    await expect(allFilter).not.toHaveClass(/active/);

    // Only info notices should remain visible
    await expect(content.getByText("Info notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Warning notice", { exact: true })).not.toBeVisible();
    await expect(content.getByText("Error notice", { exact: true })).not.toBeVisible();
  });

  test("Warning 필터 클릭 시 warning 알림만 표시", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const content = page.locator(".content-container");
    await content.getByText("Warning notice", { exact: true }).waitFor();

    const warningFilter = content.getByRole("button", { name: /^Warning$/ });
    await warningFilter.click();

    await expect(content.getByText("Warning notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Info notice", { exact: true })).not.toBeVisible();
    await expect(content.getByText("Error notice", { exact: true })).not.toBeVisible();
  });

  test("Error 필터 클릭 후 All 클릭 시 전체 복원", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const content = page.locator(".content-container");
    await content.getByText("Error notice", { exact: true }).waitFor();

    const errorFilter = content.getByRole("button", { name: /^Error$/ });
    const allFilter = content.getByRole("button", { name: /^All$/ });

    await errorFilter.click();
    await expect(content.getByText("Info notice", { exact: true })).not.toBeVisible();

    // Reset to All
    await allFilter.click();
    await expect(allFilter).toHaveClass(/active/);
    await expect(content.getByText("Info notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Warning notice", { exact: true })).toBeVisible();
    await expect(content.getByText("Error notice", { exact: true })).toBeVisible();
  });

  // ── 알림 type 배지 표시 ────────────────────────────────────────────────────

  test("각 알림에 type 배지가 표시된다", async ({ page }) => {
    await setupNoticesMocks(page, [MOCK_NOTICES[0]]);
    await page.goto("/notices");

    const content = page.locator(".content-container");
    await content.getByText("Info notice", { exact: true }).waitFor();

    // 'Info' badge should appear on the notice card (exact match excludes "Info notice")
    const noticeCard = content.locator(".board-card").filter({ hasText: "Info notice" });
    await expect(noticeCard.getByText("Info", { exact: true })).toBeVisible();
  });
});
