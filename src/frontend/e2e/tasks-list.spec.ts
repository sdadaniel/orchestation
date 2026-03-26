import { test, expect } from "@playwright/test";
import {
  setupTaskListMocks,
  CHAIN_REQUESTS,
  CHAIN_TASKS,
} from "./helpers/mock";

test.describe("Tasks List Page", () => {
  // ── Tab active style ──────────────────────────────────────────────────────

  test("탭 클릭 시 active 스타일 변경", async ({ page }) => {
    await setupTaskListMocks(page);
    await page.goto("/tasks");

    const content = page.locator(".content-container");

    // Default tab is 'stack' (Graph)
    const graphTab = content.getByRole("button", { name: /Graph/ });
    await expect(graphTab).toHaveClass(/border-violet-400/);

    // Click 'pending' tab
    const pendingTab = content.getByRole("button", { name: /Pending/ });
    await pendingTab.click();

    // pending tab should become active
    await expect(pendingTab).toHaveClass(/text-primary/);
    await expect(pendingTab).not.toHaveClass(/text-muted-foreground/);

    // Graph tab should no longer be active
    await expect(graphTab).not.toHaveClass(/text-violet-400/);

    // Click 'in_progress' tab
    const inProgressTab = content.getByRole("button", { name: /In Progress/ });
    await inProgressTab.click();
    await expect(inProgressTab).toHaveClass(/text-primary/);
    await expect(pendingTab).not.toHaveClass(/text-primary/);
  });

  // ── Priority filter ────────────────────────────────────────────────────────

  test("Priority 필터 클릭 시 active 상태 변경", async ({ page }) => {
    await setupTaskListMocks(page);
    await page.goto("/tasks?tab=all");

    const content = page.locator(".content-container");

    // Wait for list to load
    await content.getByText("Alpha Task", { exact: true }).waitFor();

    // Default: 'All' filter is active
    const allFilter = content.getByRole("button", { name: /^All$/ }).first();
    await expect(allFilter).toHaveClass(/active/);

    // Click 'High' priority filter
    const highFilter = content.getByRole("button", { name: /^High$/ });
    await highFilter.click();
    await expect(highFilter).toHaveClass(/active/);
    await expect(allFilter).not.toHaveClass(/active/);

    // Only high-priority tasks should be visible in content area
    await expect(content.getByText("Alpha Task", { exact: true })).toBeVisible();
    await expect(content.getByText("Gamma Task", { exact: true })).toBeVisible();
    // medium-priority 'Beta Task' should be filtered out
    await expect(content.getByText("Beta Task", { exact: true })).not.toBeVisible();

    // Click 'Medium' filter
    const mediumFilter = content.getByRole("button", { name: /^Medium$/ });
    await mediumFilter.click();
    await expect(mediumFilter).toHaveClass(/active/);
    await expect(highFilter).not.toHaveClass(/active/);
    await expect(content.getByText("Beta Task", { exact: true })).toBeVisible();
    await expect(content.getByText("Alpha Task", { exact: true })).not.toBeVisible();
  });

  // ── Empty tab message ──────────────────────────────────────────────────────

  test("빈 탭 진입 시 '해당 조건의 태스크가 없습니다' 표시", async ({ page }) => {
    await setupTaskListMocks(page);
    // Navigate to 'stopped' tab which has no tasks in mock data
    await page.goto("/tasks?tab=stopped");

    await expect(
      page.locator(".content-container").getByText("해당 조건의 태스크가 없습니다."),
    ).toBeVisible();
  });

  test("태스크가 전혀 없을 때 'No tasks yet.' 표시", async ({ page }) => {
    await setupTaskListMocks(page, { requests: [], tasks: [] });
    await page.goto("/tasks?tab=all");

    await expect(
      page.locator(".content-container").getByText("No tasks yet."),
    ).toBeVisible();
  });

  // ── Dependency chain accordion ─────────────────────────────────────────────

  test("의존 체인 아코디언 펼침/접힘", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: CHAIN_REQUESTS,
      tasks: CHAIN_TASKS,
    });
    await page.goto("/tasks?tab=pending");

    const content = page.locator(".content-container");

    // Wait for chain group to appear (shows "외 N건")
    const chainHeader = content.locator(".board-card").filter({ hasText: "외 1건" });
    await expect(chainHeader).toBeVisible({ timeout: 10_000 });

    // The chevron icon: first svg inside the clickable row
    const chevronContainer = chainHeader.locator(".cursor-pointer").first();
    const chevron = chevronContainer.locator("svg").first();

    // Initially collapsed: chevron should NOT have rotate-90
    await expect(chevron).not.toHaveClass(/rotate-90/);

    // Content should be hidden (maxHeight: 0)
    const content2 = chainHeader.locator(".overflow-hidden").first();
    await expect(content2).toHaveCSS("max-height", "0px");

    // Click to expand
    await chevronContainer.click();

    // Chevron should rotate
    await expect(chevron).toHaveClass(/rotate-90/);

    // Content should be visible (opacity: 1)
    await expect(content2).toHaveCSS("opacity", "1");

    // Both tasks should be visible inside the expanded accordion
    // "Parent Task" appears in header + in expanded content — check nth(1)
    await expect(chainHeader.getByText("Parent Task").nth(1)).toBeVisible();
    await expect(chainHeader.getByText("Child Task")).toBeVisible();

    // Click again to collapse
    await chevronContainer.click();
    await expect(chevron).not.toHaveClass(/rotate-90/);
    await expect(content2).toHaveCSS("max-height", "0px");
  });
});
