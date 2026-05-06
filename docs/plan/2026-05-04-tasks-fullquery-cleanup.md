# Tasks 전수 조회(`full=1`) 정리 — 작업 계획

작성일: 2026-05-04

## 목표

`/api/tasks?full=1` 같은 전수 조회 우회 경로를 제거하고, dashboard의 task 데이터 흐름을
**list / graph / summary** 3채널로 깔끔하게 분리한다. `requests` 명칭은 모두 `tasks`로
통일한다(메모리: "Request 개념 제거 — Task만 사용").

## 현재 상태 분석 (수정 시작 전 기준)

### 전수 조회를 하는 경로

| 경로 | 호출처 | 비고 |
|------|--------|------|
| `GET /api/tasks?full=1` | `useRequests` (TanStack Query), `tasksStore.fetchRequests` (zustand) | **제거 대상** — 응답 전체 배열 |
| `GET /api/tasks?summary=1` | `tasksStore.fetchRequestSummary` | 서버 내부에선 `getAllTasks()`로 전수 스캔하지만 응답은 `{items[10], counts, active, pending}` (light) |
| `GET /api/tasks/graph` | `useTasks`, `tasksStore.fetchTasks` | 그래프 시각화용. 사실상 전수 — 응답 형태만 다름 |

### 전수 조회 응답을 소비하는 곳

| 소비처 | 사용 데이터 | 변경 방향 |
|--------|------------|-----------|
| `RequestsPageView` (`/requests` 페이지) | `useRequests` → `?full=1` | **페이지 자체 삭제** (`/tasks`와 중복) |
| `TasksPageView` (`/tasks`) | `tasksStore.requests` (`?full=1`) | graph API 데이터로 전환하거나 서버 페이지네이션 |
| `GlobalSearch` | `tasksStore.requests` (`?full=1`) | graph API 데이터로 검색 인덱스 구성 |
| `gateway-ws/handlers.ts` | `store.requests`, `store.fetchAll` | 의존 제거. invalidate / fetchTasksSummary만 |

### `requests` 네이밍 잔재

- **API 라우트**: `app/api/requests/route.ts`, `app/api/requests/[id]/route.ts`,
  `app/api/requests/[id]/reorder/route.ts` — 모두 `app/api/tasks/...` 의 단순 re-export
- **페이지**: `app/requests/page.tsx`
- **뷰**: `views/requests/{RequestsPageView, components/...}`
- **훅**: `hooks/useRequests.ts`
- **스토어 필드/액션**: `requests`, `requestSummary`, `fetchRequests`, `fetchRequestSummary`,
  `createRequest`, `updateRequest`, `deleteRequest`, `reorderRequest`, `patchRequest`,
  `hasLoadedRequests`, `fetchAll`
- **타입**: `RequestItem`, `RequestSummaryItem`, `RequestSummaryCounts`, `RequestSummaryData`
- **카드/그룹 컴포넌트**: `views/tasks/components/RequestCard.tsx`,
  `views/tasks/components/ChainGroup.tsx` — `RequestItem` import 다수
- **쿼리 키**: `queryKeys.requests.{all, list, summary, detail}` (engine 패키지)

### graph API 응답 부족 필드

`buildWaterfallGroups`가 받는 `TaskFrontmatter`에는
`{id, display_id, title, status, phase, priority, depends_on, blocks, parallel_with, role,
affected_files}`만 있어서 list view에 필요한 `created/updated/content/sort_order/scope/branch`가
없다. graph API를 list view source로 재사용하려면 응답을 풍부화해야 한다.

또 `affected_files` vs `scope` 네이밍 불일치 — list view/UI는 `scope`, waterfall type/parser는
`affected_files`. 통일 필요.

## 지금까지 한 작업 (이번 세션)

1. ✅ 전체 호출 경로 매핑 — 어떤 파일이 `?full=1` / `useRequests` / `tasksStore.requests`를
   쓰는지 파악
2. ⚠️ `packages/dashboard/src/app/api/tasks/graph/route.ts` 응답 풍부화 시도
   → `TaskGraphItem` 타입을 정의하지 않은 채 import만 추가 → **원복 완료** (현재 코드는
   원래 상태로 되돌림). 이 변경은 단계 1로 다시 시작해야 함.

## 남은 작업 — 단계별 체크리스트

### Phase 1. graph API + 클라이언트 타입 정비 (작은 변경)

- [ ] `packages/dashboard/src/types/task-graph.ts` 신설:
  ```ts
  export type TaskGraphItem = {
    id: string;
    display_id: string;
    title: string;
    status: TaskStatus;
    phase: string | null;
    priority: TaskPriority;
    depends_on: string[];
    blocks: string[];
    parallel_with: string[];
    role: string;
    scope: string[];          // affected_files 대신 scope로 통일
    content: string;
    created: string;
    updated: string;
    sort_order: number;
    branch: string;
  };
  ```
- [ ] `app/api/tasks/graph/route.ts` 응답을 `TaskGraphItem[]` 형태로 (위 풍부화 다시 적용)
- [ ] `WaterfallTask`(engine)의 `affected_files` → `scope` rename, `buildWaterfallGroups`도
  맞춰 수정. 사용처: `Waterfall/TaskDetailPanel.tsx`, `TaskLogModal.tsx`,
  `views/plan/PlanPageView.tsx`, `DAGCanvas.tsx`
- [ ] `TaskFrontmatter`(engine)의 `affected_files` → `scope` rename (또는 `TaskFrontmatter`
  자체를 dashboard 의존에서 분리하고 `TaskGraphItem`만 쓰도록 — 결정 필요)

### Phase 2. `/api/tasks` 라우트 정리

- [ ] `app/api/tasks/route.ts`에서 `full=1` 분기 완전 삭제 (62~80행 블록)
- [ ] `summary=1` 분기는 유지하되 응답 형태 점검 — counts/active/pending이 paginated items와
  중복되지 않도록
- [ ] `app/api/requests/route.ts`, `app/api/requests/[id]/route.ts`,
  `app/api/requests/[id]/reorder/route.ts` 디렉터리 통째로 삭제
  - 단, 클라이언트 어디에서도 `/api/requests/...`를 호출하지 않는지 grep 검증 후

### Phase 3. `tasksStore` 리팩터

- [ ] 필드/액션 rename:
  - `RequestItem` → `TaskListItem`
  - `RequestSummaryItem/Counts/Data` → `TaskSummaryItem/Counts/Data`
  - `requestSummary` → `tasksSummary`
  - `fetchRequestSummary` → `fetchTasksSummary`
  - `createRequest` → `createTask`
  - `updateRequest` → `updateTask`
  - `deleteRequest` → `deleteTask`
  - `reorderRequest` → `reorderTask`
  - `patchRequest` → `patchTask`
- [ ] 제거:
  - `requests` (전수 배열) 필드
  - `hasLoadedRequests`
  - `fetchRequests` (`?full=1` 호출)
  - `fetchAll`
- [ ] `reorderTask`의 HTTP 메서드 통일 — 현재 store는 PUT인데 route는 POST만 지원.
  POST로 통일하거나 route에 PUT 추가 (POST가 단순)
- [ ] `stopTask` 내부에서 `updateRequest` 호출하는 부분 → `updateTask`

### Phase 4. 훅 / 페이지 / 뷰 정리

- [ ] `hooks/useRequests.ts` 삭제
- [ ] `app/requests/page.tsx` 삭제
- [ ] `views/requests/` 디렉터리 통째로 삭제 (`RequestsPageView`, `components/`, `types/`)
- [ ] `hooks/useTasks.ts`: graph 응답을 `{ groups, tasks (flat), isLoading, error, refetch }`로
  노출하도록 보강. 또는 별도 셀렉터 추가
- [ ] `views/tasks/TasksPageView.tsx`:
  - `useTasksStore.requests` → `useTasks().tasks`
  - mutation 호출 이름 변경 (`updateRequest` → `updateTask` 등)
  - `RequestItem` import → `TaskGraphItem` 또는 store의 `TaskListItem`
- [ ] `views/tasks/components/RequestCard.tsx`, `ChainGroup.tsx`, `DAGCanvas.tsx`,
  `views/tasks/components/types/index.ts`:
  - `RequestItem` 타입 import를 새 타입으로 통일
  - `req.scope` 그대로 (graph 응답 풍부화 후 동일 필드명)
- [ ] `views/tasks/[id]/TaskDetailPageView.tsx`:
  - `storeRequests = useTasksStore((s) => s.requests)` 의존 제거 → WS event-driven refetch 또는
    `tasksSummary` 기반 status 비교
  - `patchRequest` 호출 → `patchTask`
- [ ] `components/GlobalSearch/GlobalSearch.tsx`:
  - `tasksStore.requests` / `fetchRequests` / `hasLoadedRequests` 제거
  - `useTasks().tasks` 사용 (검색 인덱스)
- [ ] `components/Sidebar/Sidebar.tsx`, `AppShell.tsx`, `HomeDashboard.tsx`, `Controls.tsx`:
  - `requestSummary` → `tasksSummary`
  - `fetchRequestSummary` → `fetchTasksSummary`
- [ ] `components/Sidebar/components/types/index.ts`:
  - `RequestSummaryItem` → `TaskSummaryItem`
- [ ] `components/RunningIndicator/types/index.ts`:
  - `RequestItem` import를 `TaskListItem` 또는 `TaskGraphItem`으로

### Phase 5. WebSocket handlers 정리

- [ ] `gateway-ws/handlers.ts`:
  - `store.requests.length`, `store.requests.some(...)`, `store.fetchAll()` 의존 제거
  - `tasksFullHint` 처리도 단순화 — query invalidation + `fetchTasksSummary`로 충분
  - `store.patchRequest` → `store.patchTask`

### Phase 6. 쿼리 키 정리

- [ ] `packages/engine/src/lib/query/query-keys.ts`:
  - `queryKeys.requests.*` 제거 또는 `queryKeys.tasks.summary`/`queryKeys.tasks.detail(id)`로
    이관
  - `queryKeys.tasks` 하위로 통합

### Phase 7. 검증

- [ ] `pnpm -w build` 또는 패키지별 `pnpm build` typecheck 통과
- [ ] dev server 띄우고 (포트 3001 — 게이트웨이 엔트리: 루트 `node cli.js start -p 3001` 또는 `packages/dashboard`에서 `npm run dev:3001` / `PROJECT_ROOT`·`PACKAGE_DIR`을 리포 루트로 둔 `npm run dev`; `npx next dev` 단독 금지):
  - `/tasks` 페이지 로드 시 네트워크 탭에서 `?full=1` 호출 0건 확인
  - List 탭 / Graph 탭 / 검색 모두 동작 확인
  - Sidebar/Home dashboard summary가 정상 갱신되는지 확인
  - Task 생성/수정/삭제/reorder 시 사이드바가 즉시 반영되는지 확인
- [ ] `git grep -n "full=1"`로 잔여 호출 0건 확인
- [ ] `git grep -n "requests"`로 의도한 잔재 외 0건 (i18n, 사용자 노출 텍스트 제외)

## 결정해야 할 항목

1. **List view 데이터 소스**:
   - (A) graph API(`/api/tasks/graph`) 응답을 풍부화하고 list/graph 양쪽에서 재사용 (전수
     조회 1회로 통합) — **권장**, 변경 범위 작음, 태스크 수 ~200개 수준이면 성능 OK
   - (B) `/api/tasks`에 `status/priority/q/sort` 서버 필터 추가, 클라이언트 사이드 필터/페이징
     로직 모두 서버로 이관 — 큰 변경, list 탭이 진정한 "paginated"
   - 사용자가 *"필요하면 page/size 기반으로 더 정리"*라고 했으므로 **A로 시작**하고 B는 후속
     단계로 미룰 수 있음

2. **`affected_files` vs `scope`**:
   - parser/waterfall 모두 `scope`로 통일하는 게 dashboard 일관성에 유리
   - engine 코드 변경 영향 범위 — `parseScope`/`affected_files` grep해서 점검 필요

3. **`tasksStore`를 React Query로 마이그레이션할지**:
   - 현재 store가 가진 `tasksSummary` 상태는 WS event-driven로 갱신됨 (RQ stale 모델과 다름)
   - 일단 store 유지, mutation도 store에 두는 minimal 리팩터로 진행
   - 차후 `useRequests`처럼 RQ mutation으로 통합 검토

## 영향받는 파일 인덱스

```
# 수정
packages/dashboard/src/app/api/tasks/route.ts
packages/dashboard/src/app/api/tasks/graph/route.ts
packages/dashboard/src/store/tasksStore.ts
packages/dashboard/src/hooks/useTasks.ts
packages/dashboard/src/views/tasks/TasksPageView.tsx
packages/dashboard/src/views/tasks/[id]/TaskDetailPageView.tsx
packages/dashboard/src/views/tasks/components/RequestCard.tsx
packages/dashboard/src/views/tasks/components/ChainGroup.tsx
packages/dashboard/src/views/tasks/components/DAGCanvas.tsx
packages/dashboard/src/views/tasks/components/types/index.ts
packages/dashboard/src/components/GlobalSearch/GlobalSearch.tsx
packages/dashboard/src/components/Sidebar/Sidebar.tsx
packages/dashboard/src/components/Sidebar/components/types/index.ts
packages/dashboard/src/components/AppShell/AppShell.tsx
packages/dashboard/src/components/AppShell/components/HomeDashboard.tsx
packages/dashboard/src/components/Controls/Controls.tsx
packages/dashboard/src/components/RunningIndicator/types/index.ts
packages/dashboard/src/gateway-ws/handlers.ts
packages/engine/src/lib/query/query-keys.ts
packages/engine/src/types/waterfall.ts          # affected_files → scope
packages/engine/src/lib/waterfall.ts            # 동
packages/engine/src/parser/parser.ts            # 동
packages/dashboard/src/components/Waterfall/TaskDetailPanel.tsx
packages/dashboard/src/components/TaskLogModal/TaskLogModal.tsx
packages/dashboard/src/views/plan/PlanPageView.tsx

# 신설
packages/dashboard/src/types/task-graph.ts

# 삭제
packages/dashboard/src/app/api/requests/                 # 디렉터리 통째
packages/dashboard/src/app/requests/                     # 페이지
packages/dashboard/src/views/requests/                   # 뷰 디렉터리 통째
packages/dashboard/src/hooks/useRequests.ts
```
