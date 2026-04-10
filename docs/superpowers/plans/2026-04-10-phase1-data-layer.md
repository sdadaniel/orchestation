# Phase 1: Data Layer 완전 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SQLite를 유일한 진실의 원천으로 확립 — 파일 기반 폴백/이중쓰기 완전 제거

**Architecture:** `request-parser.ts`의 파일 읽기 로직을 `task-store.ts` SQLite 조회로 교체. API 라우트들이 파일 시스템 대신 DB를 직접 읽고 씁니다. 마지막으로 `.orchestration/tasks/` 디렉토리와 `TASKS_DIR` 상수를 제거합니다.

**Tech Stack:** better-sqlite3, Next.js App Router API Routes, TypeScript

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `src/frontend/src/app/api/requests/[id]/route.ts` | Rewrite | GET/PUT/DELETE → SQLite only |
| `src/frontend/src/app/api/requests/[id]/reorder/route.ts` | Rewrite | `writeSortOrder()` → `updateTask()` |
| `src/frontend/src/app/api/requests/route.ts` | Modify | POST에서 파일 쓰기 제거 |
| `src/frontend/src/app/api/tasks/[id]/run/route.ts` | Modify | `markTaskAsStopped()` + dep check → SQLite |
| `src/frontend/src/parser/task-log-parser.ts` | Modify | `taskExists()` → `getTask()` |
| `src/frontend/src/lib/paths.ts` | Modify | `TASKS_DIR` 제거 |
| `src/frontend/src/lib/request-parser.ts` | Delete | 완전 제거 (모든 소비자 마이그레이션 후) |

---

### Task 1: `api/requests/[id]/route.ts` — GET/PUT/DELETE SQLite 전환

**Files:**
- Modify: `src/frontend/src/app/api/requests/[id]/route.ts`

- [ ] **Step 1: 파일 전체를 아래 코드로 교체**

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "@/lib/error-utils";
import { OUTPUT_DIR } from "@/lib/paths";
import { getTask, getAllTasks, updateTask, updateTaskStatus, deleteTask, parseScope, parseDependsOn } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Execution log (file-based, remains in OUTPUT_DIR)
  let executionLog: Record<string, unknown> | null = null;
  const taskJsonPath = path.join(OUTPUT_DIR, `${id}-task.json`);
  if (fs.existsSync(taskJsonPath)) {
    try { executionLog = JSON.parse(fs.readFileSync(taskJsonPath, "utf-8")); } catch { /* ignore */ }
  }

  // Review result
  let reviewResult: Record<string, unknown> | null = null;
  const reviewJsonPath = path.join(OUTPUT_DIR, `${id}-review.json`);
  if (fs.existsSync(reviewJsonPath)) {
    try { reviewResult = JSON.parse(fs.readFileSync(reviewJsonPath, "utf-8")); } catch { /* ignore */ }
  }

  // Cost info from token-usage.log
  let costEntries: { phase: string; cost: string; duration: string; tokens: string }[] = [];
  const tokenLogPath = path.join(OUTPUT_DIR, "token-usage.log");
  if (fs.existsSync(tokenLogPath)) {
    try {
      const lines = fs.readFileSync(tokenLogPath, "utf-8").split("\n")
        .filter(l => l.includes(id) && !l.includes("model_selection"));
      costEntries = lines.map(line => ({
        phase: line.match(/phase=(\w+)/)?.[1] || "unknown",
        cost: `$${parseFloat(line.match(/cost=\$([0-9.]+)/)?.[1] || "0").toFixed(4)}`,
        duration: `${(parseInt(line.match(/duration=(\d+)ms/)?.[1] || "0") / 1000).toFixed(1)}s`,
        tokens: `in:${line.match(/input=(\d+)/)?.[1] || "0"} out:${line.match(/output=(\d+)/)?.[1] || "0"}`,
      }));
    } catch { /* ignore */ }
  }

  const allTasks = getAllTasks();
  const dependsOnIds = parseDependsOn(task);
  const dependedBy = allTasks
    .filter(t => parseDependsOn(t).includes(task.id))
    .map(t => ({ id: t.id, title: t.title, status: t.status }));
  const dependsOnResolved = dependsOnIds.map(depId => {
    const dep = allTasks.find(t => t.id === depId);
    return dep ? { id: dep.id, title: dep.title, status: dep.status } : { id: depId, title: "", status: "unknown" };
  });

  return NextResponse.json({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority ?? "medium",
    created: task.created ?? "",
    updated: task.updated ?? "",
    content: task.content ?? "",
    depends_on: dependsOnIds,
    scope: parseScope(task),
    sort_order: task.sort_order ?? 0,
    branch: task.branch ?? "",
    depends_on_detail: dependsOnResolved,
    depended_by: dependedBy,
    executionLog,
    reviewResult,
    costEntries,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    const body = await request.json();

    // Dependency validation for in_progress
    if (body.status === "in_progress") {
      const dependsOnIds = parseDependsOn(task);
      if (dependsOnIds.length > 0) {
        const allTasks = getAllTasks();
        const unmetDeps = dependsOnIds.filter(depId => {
          const dep = allTasks.find(t => t.id === depId);
          return !dep || dep.status !== "done";
        });
        if (unmetDeps.length > 0) {
          const details = unmetDeps.map(depId => {
            const dep = allTasks.find(t => t.id === depId);
            return dep ? `${depId} (status: ${dep.status})` : `${depId} (not found)`;
          });
          return NextResponse.json(
            { error: `의존성 미충족: 선행 태스크가 완료되지 않았습니다 - ${details.join(", ")}` },
            { status: 400 },
          );
        }
      }
    }

    const validStatuses = ["pending", "in_progress", "reviewing", "done", "rejected", "stopped", "failed"];
    if (body.status && validStatuses.includes(body.status)) {
      updateTaskStatus(id, body.status, task.status);
    }

    const fieldUpdates: Parameters<typeof updateTask>[1] = {};
    if (body.title && typeof body.title === "string") fieldUpdates.title = body.title.trim();
    if (body.priority && ["high", "medium", "low"].includes(body.priority)) fieldUpdates.priority = body.priority;
    if (body.content !== undefined) fieldUpdates.content = String(body.content).trim();

    if (Object.keys(fieldUpdates).length > 0) {
      updateTask(id, fieldUpdates);
    }

    return NextResponse.json(getTask(id) || { ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to update") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  try {
    deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to delete") },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 타입 체크 통과 확인**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors related to `api/requests/[id]/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/frontend/src/app/api/requests/\\[id\\]/route.ts
git commit -m "refactor: requests/[id] API — file I/O → SQLite"
```

---

### Task 2: `api/requests/[id]/reorder/route.ts` — SQLite 전환

**Files:**
- Modify: `src/frontend/src/app/api/requests/[id]/reorder/route.ts`

- [ ] **Step 1: 파일 전체를 아래 코드로 교체**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAllTasks, updateTask } from "@/service/task-store";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { direction } = await req.json();

  if (direction !== "up" && direction !== "down") {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const allTasks = getAllTasks();
  const target = allTasks.find(t => t.id === id);
  if (!target) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const siblings = allTasks
    .filter(t => t.status === target.status)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));

  const idx = siblings.findIndex(t => t.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "Task not in group" }, { status: 400 });
  }

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return NextResponse.json({ ok: true });
  }

  const other = siblings[swapIdx];
  let targetOrder = target.sort_order ?? 0;
  let otherOrder = other.sort_order ?? 0;

  if (targetOrder === otherOrder) {
    for (let i = 0; i < siblings.length; i++) {
      updateTask(siblings[i].id, { sort_order: i });
    }
    targetOrder = idx;
    otherOrder = swapIdx;
  }

  updateTask(id, { sort_order: otherOrder });
  updateTask(other.id, { sort_order: targetOrder });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/frontend/src/app/api/requests/\\[id\\]/reorder/route.ts
git commit -m "refactor: requests/[id]/reorder — file I/O → SQLite"
```

---

### Task 3: `api/requests/route.ts` POST — 파일 쓰기 제거

**Files:**
- Modify: `src/frontend/src/app/api/requests/route.ts`

- [ ] **Step 1: POST 핸들러에서 파일 쓰기 로직 제거**

`export async function POST(request: Request)` 내부에서 다음 블록을 제거합니다 (lines 85-141 근방):
- `const dir = getRequestsDir()` 이하 `fs.mkdirSync`, `fs.writeFileSync(filePath, fileContent)` 관련 코드
- `fileContent` 조합 문자열 전체
- `fileName`, `filePath` 변수

최종 POST 핸들러:

```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, priority, scope, context, depends_on, role } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const validPriorities = ["high", "medium", "low"];
    const taskPriority = validPriorities.includes(priority) ? priority : "medium";

    const taskId = getNextTaskId();
    const sanitizedTitle = title.trim();
    const bodyContent = (content && typeof content === "string") ? content.trim() : "";

    const now = new Date();
    const today = formatTimestamp(now);

    let validRoles: string[];
    try {
      validRoles = fs.readdirSync(ROLES_DIR)
        .filter((f) => f.endsWith(".md") && !f.startsWith("reviewer-") && f !== "README.md")
        .map((f) => f.replace(".md", ""));
    } catch {
      validRoles = ["general"];
    }
    const taskRole = typeof role === "string" && validRoles.includes(role) ? role : "";

    createTask({
      id: taskId,
      title: sanitizedTitle,
      status: "pending",
      priority: taskPriority,
      role: taskRole || "general",
      scope: Array.isArray(scope) ? scope : [],
      context: Array.isArray(context) ? context : [],
      depends_on: Array.isArray(depends_on) ? depends_on : [],
      content: bodyContent,
    });

    return NextResponse.json(
      { id: taskId, title: sanitizedTitle, status: "pending", priority: taskPriority, created: today, updated: today, content: bodyContent },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create task") },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: 불필요한 import 정리**

파일 상단에서 더 이상 필요 없는 import 제거:
```typescript
// 제거:
import { parseAllRequests, getRequestsDir } from "@/lib/request-parser";
import type { RequestData } from "@/lib/request-parser";
import { generateSlug } from "@/lib/slug-utils";

// 유지:
import { getDb, isDbAvailable } from "@/service/db";
import { getNextTaskId, createTask } from "@/service/task-store";
import { formatTimestamp } from "@/lib/date-utils";
import { ROLES_DIR } from "@/lib/paths";
```

- [ ] **Step 3: 타입 체크 후 Commit**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -30
git add src/frontend/src/app/api/requests/route.ts
git commit -m "refactor: requests POST — remove dual file+DB write, DB only"
```

---

### Task 4: `api/tasks/[id]/run/route.ts` — SQLite 전환

**Files:**
- Modify: `src/frontend/src/app/api/tasks/[id]/run/route.ts`

- [ ] **Step 1: import 교체**

파일 상단 import를 다음과 같이 수정합니다:

```typescript
// 제거:
import { parseAllRequests, findRequestFile, parseRequestFile } from "@/lib/request-parser";

// 추가:
import { getTask, getAllTasks, updateTaskStatus, parseDependsOn } from "@/service/task-store";
```

- [ ] **Step 2: `markTaskAsStopped()` 함수 교체**

```typescript
// 기존 (file-based):
function markTaskAsStopped(taskId: string): void {
  const taskFile = findRequestFile(taskId);
  if (!taskFile) return;
  try {
    const raw = fs.readFileSync(taskFile, "utf-8");
    const updated = raw.replace(/^status:\s*.+$/m, "status: stopped");
    fs.writeFileSync(taskFile, updated, "utf-8");
  } catch {}
}

// 교체 후 (SQLite):
function markTaskAsStopped(taskId: string): void {
  const task = getTask(taskId);
  if (!task) return;
  updateTaskStatus(taskId, "stopped", task.status as string);
}
```

- [ ] **Step 3: POST 핸들러의 의존성 체크 교체**

```typescript
// 기존 (file-based):
const taskFile = findRequestFile(id);
if (taskFile) {
  const taskData = parseRequestFile(taskFile);
  if (taskData && taskData.depends_on.length > 0) {
    const allTasks = parseAllRequests();
    ...
  }
}

// 교체 후 (SQLite):
const taskRow = getTask(id);
if (taskRow) {
  const dependsOnIds = parseDependsOn(taskRow);
  if (dependsOnIds.length > 0) {
    const allTasks = getAllTasks();
    const unmetDeps = dependsOnIds.filter(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return !dep || dep.status !== "done";
    });
    if (unmetDeps.length > 0) {
      return NextResponse.json(
        { error: `의존성 미충족: ${unmetDeps.join(", ")}이(가) 아직 완료되지 않았습니다.` },
        { status: 409 },
      );
    }
  }
}
```

- [ ] **Step 4: POST 핸들러의 branch/worktree 자동추가 블록 제거**

다음 블록(file 기반 branch 추가)을 제거합니다 — orchestrate-engine.ts의 `startTask()`에서 이미 처리합니다:
```typescript
// 제거:
if (taskFile) {
  const raw = fs.readFileSync(taskFile, "utf-8");
  if (!raw.includes("\nbranch:")) {
    ...
    fs.writeFileSync(taskFile, updated, "utf-8");
  }
}
```

- [ ] **Step 5: 타입 체크 후 Commit**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -30
git add src/frontend/src/app/api/tasks/\\[id\\]/run/route.ts
git commit -m "refactor: tasks/[id]/run — file I/O → SQLite"
```

---

### Task 5: `task-log-parser.ts` — `taskExists()` SQLite 전환

**Files:**
- Modify: `src/frontend/src/parser/task-log-parser.ts`

- [ ] **Step 1: import 수정**

```typescript
// 제거:
import { OUTPUT_DIR, TASKS_DIR } from "../lib/paths";

// 교체:
import { OUTPUT_DIR } from "../lib/paths";
import { getTask } from "../service/task-store";
```

- [ ] **Step 2: `taskExists()` 함수 교체**

```typescript
// 기존:
export function taskExists(taskId: string): boolean {
  if (!fs.existsSync(TASKS_DIR)) return false;
  const tasksDir = TASKS_DIR;
  const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
  return files.some((f) => f.startsWith(taskId));
}

// 교체:
export function taskExists(taskId: string): boolean {
  return getTask(taskId) !== null;
}
```

- [ ] **Step 3: 타입 체크 후 Commit**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -30
git add src/frontend/src/parser/task-log-parser.ts
git commit -m "refactor: taskExists() — file scan → SQLite"
```

---

### Task 6: `paths.ts` — `TASKS_DIR` 제거

**Files:**
- Modify: `src/frontend/src/lib/paths.ts`

- [ ] **Step 1: `TASKS_DIR` export 제거**

```typescript
// 제거 (lines 12-15):
export const TASKS_DIR = (() => {
  const o = path.join(ORCH_DIR, "tasks");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "docs", "task");
})();
```

- [ ] **Step 2: `TASKS_DIR` 참조가 없는지 확인**

```bash
cd src/frontend && grep -r "TASKS_DIR" src/ --include="*.ts" --include="*.tsx"
```
Expected: no output (0 matches)

- [ ] **Step 3: 타입 체크 후 Commit**

```bash
cd src/frontend && npx tsc --noEmit 2>&1 | head -30
git add src/frontend/src/lib/paths.ts
git commit -m "refactor: remove TASKS_DIR from paths.ts"
```

---

### Task 7: `request-parser.ts` 삭제 + `.orchestration/tasks/` 디렉토리 삭제

**Files:**
- Delete: `src/frontend/src/lib/request-parser.ts`
- Delete: `.orchestration/tasks/` (290개 .md 파일)

- [ ] **Step 1: `request-parser.ts` import가 남아있지 않은지 확인**

```bash
grep -r "request-parser" src/frontend/src/ --include="*.ts" --include="*.tsx"
```
Expected: no output

- [ ] **Step 2: `request-parser.ts` 삭제**

```bash
rm src/frontend/src/lib/request-parser.ts
```

- [ ] **Step 3: DB row count 검증 후 `.orchestration/tasks/` 삭제**

```bash
# DB에 태스크가 있는지 먼저 확인
cd src/frontend && node -e "
  const Database = require('better-sqlite3');
  const db = new Database('../../.orchestration/orchestration.db');
  const count = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get();
  console.log('DB task count:', count.cnt);
  db.close();
"
```
Expected: DB task count: N (N > 0)

```bash
# 디렉토리 삭제
rm -rf .orchestration/tasks/
```

- [ ] **Step 4: 최종 타입 체크 + 빌드**

```bash
cd src/frontend && npx tsc --noEmit && echo "✅ tsc passed"
```
Expected: `✅ tsc passed`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete request-parser.ts and .orchestration/tasks/ legacy .md files"
```
