import type { Page } from "@playwright/test";

// ── Shared mock data ───────────────────────────────────────────────────────

export const MOCK_REQUESTS = [
  {
    id: "TASK-001",
    title: "Alpha Task",
    status: "in_progress",
    priority: "high",
    content: "## Alpha\n\nIn-progress task.",
    created: "2026-03-01T10:00:00",
    updated: "2026-03-10T10:00:00",
    scope: ["src/alpha.ts"],
    sort_order: 1,
  },
  {
    id: "TASK-002",
    title: "Beta Task",
    status: "pending",
    priority: "medium",
    content: "## Beta\n\nPending task.",
    created: "2026-03-02T10:00:00",
    updated: "2026-03-02T10:00:00",
    scope: [],
    sort_order: 2,
  },
  {
    id: "TASK-003",
    title: "Gamma Task",
    status: "pending",
    priority: "high",
    content: "## Gamma\n\nHigh priority pending.",
    created: "2026-03-03T10:00:00",
    updated: "2026-03-03T10:00:00",
    scope: [],
    sort_order: 3,
  },
  {
    id: "TASK-004",
    title: "Delta Task",
    status: "done",
    priority: "low",
    content: "## Delta\n\nDone task.",
    created: "2026-03-04T10:00:00",
    updated: "2026-03-04T10:00:00",
    scope: [],
    sort_order: 4,
  },
  {
    id: "TASK-005",
    title: "Epsilon Task",
    status: "reviewing",
    priority: "medium",
    content: "## Epsilon\n\nReview task.",
    created: "2026-03-05T10:00:00",
    updated: "2026-03-05T10:00:00",
    scope: [],
    sort_order: 5,
  },
];

/** Two tasks that form a dependency chain: TASK-007 depends on TASK-006 */
export const CHAIN_REQUESTS = [
  {
    id: "TASK-006",
    title: "Parent Task",
    status: "pending",
    priority: "high",
    content: "## Parent",
    created: "2026-03-06T10:00:00",
    updated: "2026-03-06T10:00:00",
    scope: [],
    sort_order: 1,
  },
  {
    id: "TASK-007",
    title: "Child Task",
    status: "pending",
    priority: "medium",
    content: "## Child (depends on Parent)",
    created: "2026-03-07T10:00:00",
    updated: "2026-03-07T10:00:00",
    scope: [],
    sort_order: 2,
  },
];

export const MOCK_TASKS = [
  {
    id: "TASK-001",
    title: "Alpha Task",
    status: "in_progress",
    priority: "high",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-002",
    title: "Beta Task",
    status: "pending",
    priority: "medium",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-003",
    title: "Gamma Task",
    status: "pending",
    priority: "high",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-004",
    title: "Delta Task",
    status: "done",
    priority: "low",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-005",
    title: "Epsilon Task",
    status: "reviewing",
    priority: "medium",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
];

export const CHAIN_TASKS = [
  {
    id: "TASK-006",
    title: "Parent Task",
    status: "pending",
    priority: "high",
    depends_on: [],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
  {
    id: "TASK-007",
    title: "Child Task",
    status: "pending",
    priority: "medium",
    depends_on: ["TASK-006"],
    role: "",
    blocks: [],
    parallel_with: [],
    affected_files: [],
  },
];

export const MOCK_NOTICES = [
  {
    id: "NOTICE-001",
    title: "Info notice",
    type: "info",
    content: "This is an info notice.",
    created: "2026-03-01T10:00:00",
    read: false,
  },
  {
    id: "NOTICE-002",
    title: "Warning notice",
    type: "warning",
    content: "This is a warning notice.",
    created: "2026-03-02T10:00:00",
    read: true,
  },
  {
    id: "NOTICE-003",
    title: "Error notice",
    type: "error",
    content: "This is an error notice.",
    created: "2026-03-03T10:00:00",
    read: false,
  },
];

// ── Base AppShell mocks (required for every page) ─────────────────────────

/** Mock every API that AppShell / layout hooks call */
async function mockAppShellApis(
  page: Page,
  opts: {
    requests?: object[];
    tasks?: object[];
    orchestrateStatus?: string;
    notices?: object[];
  } = {},
) {
  const {
    requests = [],
    tasks = [],
    orchestrateStatus = "idle",
    notices = [],
  } = opts;

  // SSE — return empty stream so reconnect loop doesn't fire
  await page.route("**/api/tasks/watch", (route) => {
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: ": keep-alive\n\n",
    });
  });

  // Requests list
  await page.route("**/api/requests", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: requests });
    } else {
      route.continue();
    }
  });

  // Tasks list
  await page.route("**/api/tasks", (route) => {
    if (!route.request().url().includes("/run") && !route.request().url().includes("/logs") && !route.request().url().includes("/result") && !route.request().url().includes("/watch")) {
      route.fulfill({ json: tasks });
    } else {
      route.continue();
    }
  });

  // Sprints
  await page.route("**/api/sprints", (route) => {
    route.fulfill({ json: [] });
  });

  // Orchestration status
  await page.route("**/api/orchestrate/status", (route) => {
    route.fulfill({ json: { status: orchestrateStatus } });
  });

  // Orchestration run/stop
  await page.route("**/api/orchestrate/run", (route) => {
    route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/orchestrate/stop", (route) => {
    route.fulfill({ json: { ok: true } });
  });

  // Notices
  await page.route("**/api/notices", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: notices });
    } else {
      route.continue();
    }
  });

  // Settings (used by DAGCanvas)
  await page.route("**/api/settings", (route) => {
    route.fulfill({ json: { maxParallel: 3 } });
  });

  // PRDs — returns Prd[] array
  await page.route("**/api/prds", (route) => {
    route.fulfill({ json: [] });
  });
  // Docs — returns Manifest { tree: DocNode[] }
  await page.route("**/api/docs", (route) => {
    if (route.request().method() === "GET" && !route.request().url().includes("/api/docs/")) {
      route.fulfill({ json: { tree: [] } });
    } else {
      route.continue();
    }
  });
}

// ── Public helpers ─────────────────────────────────────────────────────────

export async function setupTaskListMocks(
  page: Page,
  opts: {
    requests?: object[];
    tasks?: object[];
    orchestrateStatus?: string;
  } = {},
) {
  const {
    requests = MOCK_REQUESTS,
    tasks = MOCK_TASKS,
    orchestrateStatus = "idle",
  } = opts;

  await mockAppShellApis(page, { requests, tasks, orchestrateStatus });
}

export async function setupTaskDetailMocks(
  page: Page,
  opts: {
    taskId?: string;
    task?: object;
    runStatus?: string;
    runLogs?: string[];
    orchestrateStatus?: string;
  } = {},
) {
  const {
    taskId = "TASK-001",
    task = {
      id: "TASK-001",
      title: "Alpha Task",
      status: "pending",
      priority: "high",
      created: "2026-03-01T10:00:00",
      content: "## Description\n\nThis is a test task.",
      depends_on_detail: [],
      depended_by: [],
      executionLog: null,
      reviewResult: null,
      costEntries: [],
      scope: ["src/alpha.ts"],
      branch: "task/task-001",
    },
    runStatus = "idle",
    runLogs = [],
    orchestrateStatus = "idle",
  } = opts;

  // AppShell needs these — use empty lists so sidebar shows nothing
  await mockAppShellApis(page, {
    requests: [],
    tasks: [],
    orchestrateStatus,
  });

  // Task detail endpoint
  await page.route(`**/api/requests/${taskId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: task });
    } else if (route.request().method() === "PUT") {
      try {
        const body = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({ json: { ...(task as object), ...body } });
      } catch {
        await route.fulfill({ json: task });
      }
    } else {
      await route.continue();
    }
  });

  // Task run endpoints
  await page.route(`**/api/tasks/${taskId}/run`, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: { status: runStatus, logs: runLogs } });
    } else if (route.request().method() === "POST") {
      route.fulfill({ json: { status: "running", logs: [] } });
    } else if (route.request().method() === "DELETE") {
      route.fulfill({ json: { ok: true } });
    } else {
      route.continue();
    }
  });

  // Task logs
  await page.route(`**/api/tasks/${taskId}/logs`, (route) => {
    route.fulfill({
      json: [
        { timestamp: "10:00:01", level: "info", message: "Task started" },
        { timestamp: "10:00:02", level: "info", message: "Running step 1" },
      ],
    });
  });

  // Task result
  await page.route(`**/api/tasks/${taskId}/result`, (route) => {
    route.fulfill({
      json: { result: "## AI Result\n\nCompleted successfully." },
    });
  });
}

export async function setupNoticesMocks(
  page: Page,
  notices = MOCK_NOTICES,
) {
  await mockAppShellApis(page, { notices });

  // Override notices route with the specific notices data
  await page.route("**/api/notices", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: notices });
    } else {
      route.continue();
    }
  });
}
