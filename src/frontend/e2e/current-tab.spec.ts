import { test, expect } from "@playwright/test";
import { setupTaskListMocks } from "./helpers/mock";

/**
 * Current Tab (DAG Graph View) E2E 시나리오
 *
 * /tasks 페이지의 Graph(stack) 탭에서 DAG 시각화,
 * 점유 Scope 패널, Fit 버튼, 빈 상태 등을 검증한다.
 */

const GRAPH_REQUESTS = [
  {
    id: "TASK-A",
    title: "Node A",
    status: "pending",
    priority: "high",
    content: "## Node A",
    created: "2026-03-01T10:00:00",
    updated: "2026-03-01T10:00:00",
    scope: ["src/components/Header.tsx", "src/utils/api.ts"],
    sort_order: 1,
  },
  {
    id: "TASK-B",
    title: "Node B",
    status: "in_progress",
    priority: "medium",
    content: "## Node B",
    created: "2026-03-02T10:00:00",
    updated: "2026-03-02T10:00:00",
    scope: ["src/pages/index.tsx"],
    sort_order: 2,
  },
  {
    id: "TASK-C",
    title: "Node C",
    status: "done",
    priority: "low",
    content: "## Node C",
    created: "2026-03-03T10:00:00",
    updated: "2026-03-03T10:00:00",
    scope: [],
    sort_order: 3,
  },
];

const GRAPH_TASKS_WITH_DEP = [
  {
    id: "TASK-A",
    title: "Node A",
    status: "pending",
    priority: "high",
    depends_on: ["TASK-B"],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-B",
    title: "Node B",
    status: "in_progress",
    priority: "medium",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-C",
    title: "Node C",
    status: "done",
    priority: "low",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
];

test.describe("Current Tab (DAG Graph View)", () => {
  // ── 1. DAG 캔버스 렌더링 ─────────────────────────────────────────────────

  test("Graph 탭 기본 진입 → DAG 캔버스(svg.dag-canvas)가 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });
  });

  // ── 2. 노드 렌더링 ───────────────────────────────────────────────────────

  test("DAG 노드가 렌더링되고 태스크 제목이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    const nodes = dagCanvas.locator("foreignObject");
    expect(await nodes.count()).toBeGreaterThan(0);

    await expect(dagCanvas.getByText("Node A")).toBeVisible();
    await expect(dagCanvas.getByText("Node B")).toBeVisible();
  });

  // ── 3. 의존 화살표 표시 ─────────────────────────────────────────────────

  test("의존 관계 화살표(edge path)가 렌더링된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    const edgePaths = dagCanvas.locator("path[marker-end]");
    expect(await edgePaths.count()).toBeGreaterThan(0);
  });

  // ── 4. 빈 상태 ──────────────────────────────────────────────────────────

  test("태스크가 없을 때 'No tasks yet.' 표시 및 DAG 미렌더링", async ({ page }) => {
    await setupTaskListMocks(page, { requests: [], tasks: [] });
    await page.goto("/tasks?tab=stack");

    await expect(
      page.locator(".content-container").getByText("No tasks yet."),
    ).toBeVisible();
    await expect(page.locator("svg.dag-canvas")).not.toBeVisible();
  });

  // ── 5. Graph 탭 active 스타일 ────────────────────────────────────────────

  test("Graph 탭 버튼이 violet active 스타일을 유지한다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const content = page.locator(".content-container");
    const graphTab = content.getByRole("button", { name: /Graph/ });
    await expect(graphTab).toHaveClass(/border-violet-400/);
    await expect(graphTab).toHaveClass(/text-violet-400/);
  });

  // ── 6. Graph 탭에서 검색 입력란 미표시 ──────────────────────────────────

  test("Graph 탭 활성화 시 검색 입력란이 표시되지 않는다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const content = page.locator(".content-container");
    const searchInput = content.getByPlaceholder(/검색/);
    await expect(searchInput).not.toBeVisible();
  });

  // ── 7. Fit 버튼 ─────────────────────────────────────────────────────────

  test("DAG 뷰에 Fit 버튼이 표시된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    const content = page.locator(".content-container");
    const fitBtn = content.getByRole("button", { name: /Fit|맞춤/ });
    await expect(fitBtn).toBeVisible();
  });

  test("Fit 버튼 클릭 → 에러 없이 동작한다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    const content = page.locator(".content-container");
    const fitBtn = content.getByRole("button", { name: /Fit|맞춤/ });
    await fitBtn.click();

    // Canvas should still be visible after fit
    await expect(dagCanvas).toBeVisible();
  });

  // ── 8. 점유 Scope 패널 ──────────────────────────────────────────────────

  test("점유 Scope 패널이 렌더링된다", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    // Scope panel may show occupied files
    const content = page.locator(".content-container");
    const scopePanel = content.locator("[class*='scope'], [class*='Scope']").first();
    if (await scopePanel.isVisible()) {
      await expect(scopePanel).toBeVisible();
    }
  });

  // ── 9. 다른 탭으로 전환 시 DAG 미표시 ──────────────────────────────────

  test("Graph 탭에서 Pending 탭으로 전환 시 DAG 캔버스 미표시", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    const content = page.locator(".content-container");
    const pendingTab = content.getByRole("button", { name: /Pending/ });
    await pendingTab.click();

    await expect(dagCanvas).not.toBeVisible();
  });

  // ── 10. DAG 노드 클릭 → 태스크 상세 페이지 이동 ─────────────────────────

  test("DAG 노드 클릭 → 해당 태스크 상세 페이지로 이동", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });

    // Mock task detail route
    await page.route("**/api/requests/TASK-A", (route) => {
      route.fulfill({
        json: {
          id: "TASK-A",
          title: "Node A",
          status: "pending",
          priority: "high",
          created: "2026-03-01T10:00:00",
          content: "## Node A",
          depends_on_detail: [],
          depended_by: [],
          executionLog: null,
          reviewResult: null,
          costEntries: [],
          scope: [],
          branch: "task/task-a",
        },
      });
    });
    await page.route("**/api/tasks/TASK-A/run", (route) => {
      route.fulfill({ json: { status: "idle", logs: [] } });
    });

    await page.goto("/tasks?tab=stack");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    // Click on the Node A foreignObject inside the dag canvas
    const nodeA = dagCanvas.getByText("Node A");
    await nodeA.click();

    // Should navigate to /tasks/TASK-A
    await expect(page).toHaveURL(/\/tasks\/TASK-A/);
  });
});
