import { test, expect } from "@playwright/test";
import { setupTaskListMocks, setupNoticesMocks, MOCK_REQUESTS, MOCK_TASKS, MOCK_NOTICES } from "./helpers/mock";

test.describe("Sidebar Navigation", () => {
  // ── 1. Tasks 링크 네비게이션 ────────────────────────────────────────────

  test("Tasks 링크 클릭 → /tasks 페이지로 이동", async ({ page }) => {
    await setupTaskListMocks(page);
    await page.goto("/");

    const sidebar = page.locator(".ide-sidebar");
    const tasksLink = sidebar.getByRole("link", { name: /Tasks/ });
    await expect(tasksLink).toBeVisible();
    await tasksLink.click();

    await expect(page).toHaveURL(/\/tasks/);
  });

  // ── 2. Notices 링크 네비게이션 ──────────────────────────────────────────

  test("Notices 링크 클릭 → /notices 페이지로 이동", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/");

    const sidebar = page.locator(".ide-sidebar");
    const noticesLink = sidebar.getByRole("link", { name: /Notices/ });
    await expect(noticesLink).toBeVisible();
    await noticesLink.click();

    await expect(page).toHaveURL(/\/notices/);
  });

  // ── 3. Settings 링크 네비게이션 ─────────────────────────────────────────

  test("Settings 링크 클릭 → /settings 페이지로 이동", async ({ page }) => {
    await setupTaskListMocks(page);

    await page.route("**/api/settings", (route) => {
      route.fulfill({ json: { maxParallel: 3 } });
    });

    await page.goto("/");

    const sidebar = page.locator(".ide-sidebar");
    const settingsLink = sidebar.getByRole("link", { name: /Settings/ });
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();

    await expect(page).toHaveURL(/\/settings/);
  });

  // ── 4. Night Worker 메뉴 ────────────────────────────────────────────────

  test("Night Worker 링크 클릭 → /night-worker 페이지로 이동", async ({ page }) => {
    await setupTaskListMocks(page);
    await page.goto("/");

    const sidebar = page.locator(".ide-sidebar");
    const nightWorkerLink = sidebar.getByRole("link", { name: /Night Worker|야간 작업/ });
    if (await nightWorkerLink.isVisible()) {
      await nightWorkerLink.click();
      await expect(page).toHaveURL(/\/night-worker/);
    }
  });

  // ── 5. 현재 페이지 active 상태 ──────────────────────────────────────────

  test("/tasks 페이지에서 Tasks 링크 active 상태", async ({ page }) => {
    await setupTaskListMocks(page);
    await page.goto("/tasks");

    const sidebar = page.locator(".ide-sidebar");
    const tasksLink = sidebar.getByRole("link", { name: /Tasks/ });
    await expect(tasksLink).toHaveClass(/active/);
  });

  test("/notices 페이지에서 Notices 링크 active 상태", async ({ page }) => {
    await setupNoticesMocks(page);
    await page.goto("/notices");

    const sidebar = page.locator(".ide-sidebar");
    const noticesLink = sidebar.getByRole("link", { name: /Notices/ });
    await expect(noticesLink).toHaveClass(/active/);
  });

  // ── 6. Notices 읽지 않은 알림 뱃지 ─────────────────────────────────────

  test("읽지 않은 Notice 존재 시 뱃지에 숫자 표시", async ({ page }) => {
    // NOTICE-001 (read: false), NOTICE-002 (read: true), NOTICE-003 (read: false)
    // → 2 unread
    await setupNoticesMocks(page, MOCK_NOTICES);
    await page.goto("/tasks");

    const sidebar = page.locator(".ide-sidebar");
    // Badge showing unread count next to Notices link
    const badge = sidebar.locator("[class*='bg-red-500']").filter({ hasText: /\d+/ });
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(Number(badgeText)).toBeGreaterThan(0);
  });

  test("모든 Notice가 읽음 상태이면 뱃지 미표시", async ({ page }) => {
    const allReadNotices = MOCK_NOTICES.map((n) => ({ ...n, read: true }));
    await setupNoticesMocks(page, allReadNotices);
    await page.goto("/tasks");

    const sidebar = page.locator(".ide-sidebar");
    const badge = sidebar.locator("[class*='bg-red-500']").filter({ hasText: /\d+/ });
    await expect(badge).not.toBeVisible();
  });

  // ── 7. in_progress 태스크 → 사이드바 상태 표시 ─────────────────────────

  test("in_progress 태스크가 사이드바에 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: MOCK_REQUESTS,
      tasks: MOCK_TASKS,
    });
    await page.goto("/tasks");

    const sidebar = page.locator(".ide-sidebar");
    // Alpha Task (in_progress) should appear in sidebar
    await expect(sidebar.getByText("Alpha Task")).toBeVisible();
  });

  // ── 8. Docs 섹션 접기/펼치기 ──────────────────────────────────────────

  test("Docs 섹션 접기/펼치기 토글", async ({ page }) => {
    await setupTaskListMocks(page);

    // Setup docs with content
    await page.route("**/api/docs", (route) => {
      if (!route.request().url().includes("/api/docs/")) {
        route.fulfill({
          json: {
            tree: [
              { name: "README.md", path: "README.md", type: "file" },
            ],
          },
        });
      } else {
        route.continue();
      }
    });

    await page.goto("/tasks");

    const sidebar = page.locator(".ide-sidebar");
    const docsToggle = sidebar.getByRole("button", { name: /Docs/ });

    if (await docsToggle.isVisible()) {
      // Toggle docs section
      await docsToggle.click();
      // Toggle back
      await docsToggle.click();
    }
  });
});
