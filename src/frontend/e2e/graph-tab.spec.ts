import { test, expect } from "@playwright/test";
import { setupTaskListMocks } from "./helpers/mock";

const GRAPH_REQUESTS = [
  {
    id: "TASK-A",
    title: "Node A",
    status: "pending",
    priority: "high",
    content: "## Node A",
    created: "2026-03-01T10:00:00",
    updated: "2026-03-01T10:00:00",
    scope: [],
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
    scope: [],
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

test.describe("Graph Tab (/tasks?tab=current)", () => {
  // ── DAG 노드 렌더링 ────────────────────────────────────────────────────────

  test("DAG 노드 렌더링 확인", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=current");

    // Wait for DAG canvas SVG to appear
    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    // foreignObject elements represent nodes
    const nodes = dagCanvas.locator("foreignObject");
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // Node titles should be visible in the canvas
    await expect(dagCanvas.getByText("Node A")).toBeVisible();
    await expect(dagCanvas.getByText("Node B")).toBeVisible();
  });

  test("DAG에 태스크가 없을 때 'No tasks yet.' 표시", async ({ page }) => {
    await setupTaskListMocks(page, { requests: [], tasks: [] });
    await page.goto("/tasks?tab=current");

    await expect(
      page.locator(".content-container").getByText("No tasks yet."),
    ).toBeVisible();
    // SVG canvas should NOT be rendered
    await expect(page.locator("svg.dag-canvas")).not.toBeVisible();
  });

  // ── 의존 화살표 ────────────────────────────────────────────────────────────

  test("의존 관계 화살표(edge) 렌더링 확인", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=current");

    const dagCanvas = page.locator("svg.dag-canvas");
    await expect(dagCanvas).toBeVisible({ timeout: 10_000 });

    // Edge paths have marker-end attribute pointing to arrow-head markers
    const edgePaths = dagCanvas.locator("path[marker-end]");
    const edgeCount = await edgePaths.count();
    expect(edgeCount).toBeGreaterThan(0);
  });

  test("Graph 탭 버튼이 violet active 스타일 유지", async ({ page }) => {
    await setupTaskListMocks(page, {
      requests: GRAPH_REQUESTS,
      tasks: GRAPH_TASKS_WITH_DEP,
    });
    await page.goto("/tasks?tab=current");

    const content = page.locator(".content-container");
    const graphTab = content.getByRole("button", { name: /Graph/ });
    await expect(graphTab).toHaveClass(/border-violet-400/);
    await expect(graphTab).toHaveClass(/text-violet-400/);
  });
});
