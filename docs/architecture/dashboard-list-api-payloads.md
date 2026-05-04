# 대시보드 목록 API 페이로드 정리 (Tasks / Requests / Notices)

**상태**: 설계 메모 (구현 없음)  
**목적**: `GET` 한 번에 전체 배열을 내려주는 패턴을, UI 요구에 맞게 줄일 때 **무엇이 깨지는지**와 **어떤 형태로 나누면 되는지**를 한곳에 정리한다.

---

## 1. 요약

| API | 현재 GET 동작 (요지) | 사이드바에서 쓰는 양 | “최근 N + 총개수만”으로 부족한 이유 |
|-----|----------------------|----------------------|-------------------------------------|
| `GET /api/requests` | DB `tasks` **전 행** (본문 `content` 등 포함) | 태스크 목록 **표시 10개** (`slice(0, 10)`), 배지는 **전체 개수** | 목록/배지는 맞출 수 있으나, Tasks 페이지·DAG는 **전체 행** 또는 최소 **id + depends_on** 등이 필요 |
| `GET /api/tasks` | `getAllTasks()` **전량** → `TaskFrontmatter[]` | 사이드바는 **직접 사용 안 함** (`requests` 사용) | DAG·의존 체인·플랜·새 태스크 의존성 UI는 전역 그래프/전체 인덱스 가정 |
| `GET /api/notices` | `getAllNotices()` **전량** (또는 파일 파싱 전량) | 미읽음 중 **5개**만 링크, 배지는 **미읽음 개수** 또는 전체 개수 | 미읽음 개수·필터는 **전체 순회**와 동치; `/notices` 페이지는 **전체 + content** 필요 |

**한 줄**: 사이드바가 “10개만 보여준다”고 해서 **네트워크가 10개만** 가는 구조는 아니다. 대부분 **전체 목록을 받은 뒤 클라이언트에서 자른다**.

---

## 2. 엔드포인트별 현황

### 2.1 `GET /api/tasks`

- **구현**: [`packages/dashboard/src/app/api/tasks/route.ts`](../../packages/dashboard/src/app/api/tasks/route.ts) — `getAllTasks()` 후 `TaskFrontmatter` 배열 **단독** JSON.
- **주요 소비처** (대시보드):
  - [`useTasks.ts`](../../packages/dashboard/src/hooks/useTasks.ts), [`tasksStore.ts`](../../packages/dashboard/src/store/tasksStore.ts) `fetchTasks`
  - [`usePlanTree.ts`](../../packages/dashboard/src/hooks/usePlanTree.ts) (플랜 트리 + `allTasks`)
  - [`useNewTaskPageModel.ts`](../../packages/dashboard/src/views/tasks/new/hooks/useNewTaskPageModel.ts) (`existingTasks` / 의존성 후보)
- **추가**: [`AppShell.tsx`](../../packages/dashboard/src/components/AppShell/AppShell.tsx)에서 `useTasks()`와 `fetchAll()`이 각각 `/api/tasks`를 호출할 수 있어 **이중 요청** 여지가 있다 (정리 시 문서화/개선 대상).

**단순히 “최근 20개만”으로 줄이면 깨지는 기능**

- Stack 탭 [`DAGCanvas`](../../packages/dashboard/src/views/tasks/components/DAGCanvas.tsx): 각 `request.id`에 대해 `taskMap`에서 `depends_on` 필요 → **전 id에 대한 의존성** 필요.
- [`TasksPageView`](../../packages/dashboard/src/views/tasks/TasksPageView.tsx) `depChainGroups`: 동일하게 `allWaterfallTasks` 기반 `taskMap`.
- 플랜: [`buildPlanTree`](../../packages/engine/src/parser/plan-tree.ts)는 모든 태스크의 `id/title/status/priority`를 가정.
- 새 태스크: `TaskOption` 후보가 **전체**일 수 있음.

**권장 응답 방향 (구현 시 참고)**

- `total`, `tasks`(최근 N 풀 필드), `index`(전 태스크 경량: id, display_id, title, status, priority), `depEdges`(전 태스크: id + `depends_on[]`) 등으로 **한 번의 GET에서** “얇은 전역 + 두꺼운 최근”을 같이 내리는 패턴.
- “최근” 정렬 기준(`updated` vs 보드 `sort_order`)은 제품 결정.

---

### 2.2 `GET /api/requests`

- **구현**: [`packages/dashboard/src/app/api/requests/route.ts`](../../packages/dashboard/src/app/api/requests/route.ts) — DB에서 **전 행** SELECT 후 JSON (본문 `content` 포함).
- **사이드바**: [`TaskListSection.tsx`](../../packages/dashboard/src/components/Sidebar/components/TaskListSection.tsx) — `requestItems` 전체를 받아 정렬 후 **`slice(0, 10)`**, 헤더 배지는 **`requestItems.length` (전체)**.

**의미**

- 사이드바 UX만 보면 “최근 10 + 총개수”로 충분해 보이나, **Tasks 목록 페이지**는 같은 `requests`로 필터·페이지네이션·전체 탭을 쓰므로 API를 줄이려면 **페이징/요약 엔드포인트 분리** 등이 필요하다.
- 페이로드 관점에서는 **`content`가 큰 경우** `/api/tasks`보다 `/api/requests` 쪽이 병목일 수 있다.

---

### 2.3 `GET /api/notices`

- **구현**: [`packages/dashboard/src/app/api/notices/route.ts`](../../packages/dashboard/src/app/api/notices/route.ts) — DB 사용 시 `getAllNotices()` **전량** JSON; 아니면 파일 기반 `parseAllNotices()` 전량.
- **훅**: [`useNotices.ts`](../../packages/dashboard/src/hooks/useNotices.ts) — `GET /api/notices` 전체를 `NoticeItem[]`로 캐시 (`content` 필드 포함).
- **사이드바**: [`NoticesSection.tsx`](../../packages/dashboard/src/components/Sidebar/components/NoticesSection.tsx)
  - `unreadNotices = noticeItems.filter(!read)` → **전체 스캔**
  - 목록: `unreadNotices.slice(0, 5)` — **표시 5개**
  - 배지: 미읽음 있으면 **미읽음 개수**, 없으면 **전체 개수**

**단순히 “최근 5개만”으로 줄이면 부족한 이유**

- **미읽음 개수**는 전체에 대해 `read === false` 개수가 필요하다. 서버에서 `unreadTotal`을 주지 않으면 클라이언트는 결국 전체를 알아야 한다.
- **전체 읽음** 표시(`All read`)는 `noticeItems.length > 0`와 조합 → 최소한 **개수** 또는 **읽지 않은 이 있는지**는 알아야 한다.
- [`NoticesPageView`](../../packages/dashboard/src/views/notices/NoticesPageView.tsx): 검색·타입 필터·펼침 상세에 **전체 목록 + `content`** 사용 → 목록 API만 잘라서는 페이지가 망가진다 (상세는 `GET /api/notices/[id]`로 분리하는 식이 별도 설계).

**권장 응답 방향 (구현 시 참고)**

- 사이드바 전용: `total`, `unreadCount`, `recent: NoticeSummary[]` (id, title, type, read, created, **content 제외**).
- 목록 페이지: 페이징된 `GET /api/notices?...` 또는 요약 + “더 보기 시 상세 fetch”.
- 상세 본문: id별 `GET`으로 지연 로딩.

---

## 3. 사이드바 vs API (참고 표)

| 영역 | 데이터 소스 | 사이드바 표시 | 전체 fetch 여부 |
|------|-------------|---------------|-----------------|
| Tasks | `GET /api/requests` → store | 최근 10 (클라 slice) | 예 (현재) |
| Notices | `GET /api/notices` → `useNotices` | 미읽음 5 (클라 slice) | 예 (현재) |
| Tasks (워터폴/토스트 등) | `GET /api/tasks` 등 | 직접 사이드바 아님 | 예 (현재) |

---

## 4. 구현 시 체크리스트 (코드 변경 없이 참고용)

1. **응답 형태 변경** 시: 배열 단독 → 객체 (`total` + slices)는 **모든 `fetch` 소비처·e2e mock** 영향.
2. **Tasks**: DAG/체인/플랜/위저드용 **전역 경량 데이터**를 같은 응답에 포함할지, **별도 엔드포인트**로 나눌지 결정.
3. **Requests**: 사이드바만 줄일지, **Tasks 페이지**까지 같은 API인지 범위 결정 (`content` 제거 요약 vs 페이징).
4. **Notices**: `unreadCount`를 서버에서 줄지, **요약 행에 content 제외**할지, 상세는 **`[id]` GET**으로 통일할지 결정.
5. **중복 요청**: AppShell 등에서 동일 리소스 **이중 fetch** 여부 점검.

---

## 5. 관련 파일 (빠른 점프)

- Tasks API: `packages/dashboard/src/app/api/tasks/route.ts`
- Requests API: `packages/dashboard/src/app/api/requests/route.ts`
- Notices API: `packages/dashboard/src/app/api/notices/route.ts`
- 사이드바 태스크: `packages/dashboard/src/components/Sidebar/components/TaskListSection.tsx`
- 사이드바 알림: `packages/dashboard/src/components/Sidebar/components/NoticesSection.tsx`

---

## 6. 문서 유지보수

API나 사이드바 slice 수가 바뀌면 이 문서의 **표와 파일 경로**를 같이 갱신한다.
