---
id: TASK-124
title: 상태 관리, 컨텍스트, 데이터 흐름 분석
status: done
branch: task/task-124
worktree: ../repo-wt-task-124
priority: high
sort_order: 1
scope:
  - src/frontend/src/**
  - src/frontend/src/components/**
  - src/frontend/src/app/**
  - src/frontend/src/lib/**
depends_on:
  - TASK-123
created: 2026-03-25
updated: 2026-03-25
---
React 상태 관리 패턴, Context 사용 방식, props drilling, 데이터 fetching 패턴 등을 분석한다. 불필요한 리렌더링, 잘못된 상태 위치, 과도한 prop 전달, context 남용 등의 문제를 식별한다.

## Completion Criteria
- 상태 관리 패턴 분석 완료
- Context 사용 적절성 평가 완료
- 데이터 흐름 문제점 목록화

---

# 분석 결과

> 분석 기준일: 2026-03-25
> 대상 경로: `src/frontend/src/`
> Next.js 16.2.0 / React 19.2.4

---

## 1. 상태 관리 패턴 분석

### 1.1 전체 전략

| 구분 | 사용 여부 | 비고 |
|---|---|---|
| Redux | ❌ | 미사용 |
| Zustand | ❌ | 미사용 |
| Jotai / Recoil | ❌ | 미사용 |
| React Context | ✅ (1개) | Toast 전용 |
| useState + useEffect | ✅ | 전체 데이터 패턴 |
| React Query / SWR | ❌ | 미사용, 직접 fetch |

**결론**: 전역 상태 라이브러리 없이, 커스텀 훅 + useState + useEffect 패턴으로 모든 서버 상태를 관리한다. `AppShell`이 최상위 오케스트레이터 역할을 한다.

---

### 1.2 상태 위치 분포

```
Root (app/layout.tsx)
└── ToastProvider               ← 유일한 전역 Context
    └── AppShell                ← 6개 훅 집중 (주 오케스트레이터)
        ├── useTasks()          → groups, isLoading, error, refetch
        ├── usePrds()           → prds
        ├── useDocTree()        → tree, CRUD functions
        ├── useOrchestrationStatus() → justFinished, clearFinished
        ├── useRequests()       → requests, createRequest, updateRequest
        └── useNotices()        → notices
```

**AppShell 자체 로컬 상태**:
- `logModalTask` — 태스크 로그 모달 열기/닫기
- `filter` — 사이드바 필터 (type: "all" | ...)
- `prevTaskStatusRef` — 태스크 상태 변경 감지용 ref (이전 상태 비교)

---

### 1.3 커스텀 훅 목록 (12개)

| 훅 이름 | 파일 | 역할 | 상태 수 | 폴링 방식 |
|---|---|---|---|---|
| `useTasks` | hooks/useTasks.ts | 태스크+스프린트 fetch | 3 | SSE + debounce 1s |
| `useSprints` | hooks/useSprints.ts | 스프린트 목록 | 3 | 5s 폴링 (실행 중) |
| `useMonitor` | hooks/useMonitor.ts | CPU/메모리 모니터링 | 2 | 1s 폴링 (기본) |
| `useCosts` | hooks/useCosts.ts | 비용 데이터 | 3 | 5s 폴링 (실행 중) |
| `useRunHistory` | hooks/useRunHistory.ts | 실행 기록 | 3 | 없음 (수동 refetch) |
| `useOrchestrationStatus` | hooks/useOrchestrationStatus.ts | 오케스트레이션 상태 | 2 | 2s(실행 중)/5s(대기) |
| `useDocTree` | hooks/useDocTree.ts | 문서 트리 CRUD | 3 | 없음 |
| `usePlanTree` | hooks/usePlanTree.ts | 플랜 계층 트리 | 3 | 없음 |
| `useSprintDetail` | hooks/useSprintDetail.ts | 스프린트 상세 | 4 | 없음 |
| `usePrds` | hooks/usePrds.ts | PRD 목록 | 3 | 없음 |
| `useNotices` | hooks/useNotices.ts | 알림 CRUD | 3 | 없음 |
| `useRequests` | hooks/useRequests.ts | 요청/태스크 CRUD | 3 | 없음 |

---

### 1.4 데이터 패치 공통 패턴

모든 훅이 동일한 패턴을 반복한다:

```typescript
const [data, setData] = useState<T>(initial);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [fetchKey, setFetchKey] = useState(0);  // refetch 트리거

const refetch = useCallback(() => setFetchKey(k => k + 1), []);

useEffect(() => {
  let cancelled = false;
  async function load() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/...");
      if (!res.ok) throw new Error("...");
      const json = await res.json();
      if (!cancelled) { setData(json); setError(null); }
    } catch (e) {
      if (!cancelled) setError(e.message);
    } finally {
      if (!cancelled) setIsLoading(false);
    }
  }
  load();
  return () => { cancelled = true; };
}, [fetchKey]);
```

**패턴의 장점**: 언마운트 안전(cancelled flag), 단순 구조
**패턴의 문제점**: 동일 보일러플레이트가 12개 훅에 중복 (→ 섹션 3 P2-2 참조)

---

## 2. Context 사용 적절성 평가

### 2.1 현재 Context 현황

#### ToastContext (toast.tsx) — ✅ 적절

```typescript
// 렌더링 분리를 위한 2개 컨텍스트 분할
const ToastActionsContext = createContext<ToastActions | null>(null);  // 안정적 함수
const ToastStateContext = createContext<ToastStateValue | null>(null); // 변경되는 배열
```

- `actions`는 `useMemo`로 안정화, `state`는 빈번히 변경되는 배열 분리
- 대부분 컴포넌트가 `useToast()`(actions만) 호출 → 토스트 렌더링 시 actions 소비 컴포넌트 리렌더 없음
- **평가**: 올바른 Context 분할 패턴. 현재 사용 방식 적절

---

### 2.2 Context가 필요하지만 없는 영역

#### 영역 1: Doc Tree 작업 — ❌ 부재 (props drilling)

현재 흐름:
```
AppShell (useDocTree 호출)
  → handleDocCreate, handleDocDelete, handleDocRename, handleDocReorder, handleDocReorderError (5개 콜백 생성)
    → TaskSidebar props (5개 콜백 전달)
      → 내부 DocTree 컴포넌트들 (직접 사용)
```

`TaskSidebar`가 직접 사용하지 않는 콜백 5개를 통과시킨다.

**권장**: `DocTreeContext` 도입으로 props 터널링 제거

---

#### 영역 2: RequestItems 전파 — ❌ 부재 (중복 전달)

```
AppShell
  → TaskSidebar (requestItems + onNewTask + onStopTask)
  → RunningIndicator (requestItems)
  → GlobalSearch (requestItems)
  → HomeDashboard (requestItems)
```

동일 `requestItems` 배열이 4개 자식 컴포넌트에 독립적으로 전달된다.

**권장**: `RequestsContext` 도입으로 중복 전달 제거

---

#### 영역 3: OrchestrationStatus 중복 구독 — ❌ 부재

```
AppShell: useOrchestrationStatus()           ← justFinished 감지 목적
useSprints: /api/orchestrate/status 폴링     ← 오케스트레이션 실행 여부 확인
useCosts: /api/orchestrate/status 폴링      ← 오케스트레이션 실행 여부 확인
```

3개 위치에서 동일 엔드포인트에 독립 폴링 발생.

**권장**: `OrchestrationContext` 또는 단일 훅으로 통합 후 구독

---

## 3. 데이터 흐름 문제점 목록

### 🔴 P1 — 즉시 개선 권장

#### [P1-1] AppShell God Component

- **위치**: `src/frontend/src/components/AppShell.tsx`
- **문제**: 6개 훅, 5개 doc 콜백 핸들러, 2개 useEffect, 로컬 상태 3개가 단일 컴포넌트에 집중
- **영향**: 어느 훅이라도 상태 변경 시 AppShell 전체 리렌더링 트리거 → 모든 자식에 영향
- **해결 방향**: 훅을 DocTreeContext, RequestsContext로 분리하여 책임 분산

---

#### [P1-2] requestItems 다중 소비로 인한 불필요한 리렌더링

- **위치**: `AppShell.tsx` → TaskSidebar, RunningIndicator, GlobalSearch, HomeDashboard
- **문제**: `requestItems` 변경 시 4개 컴포넌트 전부 리렌더링
- **증거**: `RunningIndicator`는 `in_progress` 상태만 필요하지만 전체 배열 수신
- **해결 방향**: 셀렉터 패턴 적용 또는 Context consumer에서 파생 상태만 구독

---

#### [P1-3] 오케스트레이션 상태 중복 폴링

- **위치**: `useSprints.ts`, `useCosts.ts`, `useOrchestrationStatus.ts`
- **문제**: `/api/orchestrate/status` 엔드포인트에 최대 3개 훅이 독립 폴링
  - `useOrchestrationStatus`: 2~5초 (적응형)
  - `useSprints`: 5초 간격 (실행 중)
  - `useCosts`: 5초 간격 (실행 중)
- **영향**: 실행 중 최대 3개 동시 요청, 서버 부하 및 네트워크 낭비
- **해결 방향**: `useOrchestrationStatus`를 단일 진실 소스로 지정, 나머지 훅은 이를 파라미터로 수신

---

### 🟡 P2 — 중기 개선 권장

#### [P2-1] Props Drilling — TaskSidebar (16+ props)

- **위치**: `AppShell.tsx:210` → `TaskSidebar`
- **문제**: 16개 이상의 props 전달
  ```
  groups, prds, docTree, filter, onFilterChange,
  onDocCreate, onDocDelete, onDocRename, onDocReorder, onDocReorderError,
  requestItems, onNewTask, onStopTask,
  noticeItems, currentPath
  ```
- **영향**: 인터페이스 변경 시 체인 전체 수정 필요, 테스트 복잡도 증가
- **해결 방향**: Context 분리 후 TaskSidebar가 직접 컨텍스트 소비

---

#### [P2-2] 보일러플레이트 코드 12회 중복

- **위치**: `hooks/` 디렉토리 전체
- **문제**: 로딩/에러 상태, cancelled flag, fetchKey refetch 패턴이 12개 훅에 동일하게 반복
- **영향**: 패턴 변경 시 12곳 동시 수정, 일관성 유지 어려움
- **해결 방향**: `useAsyncData<T>(fetcher, deps?)` 추상 훅 도입

```typescript
// 도입 예시
function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const refetch = useCallback(() => setFetchKey(k => k + 1), []);
  // ... 공통 로직
  return { data, isLoading, error, refetch };
}
```

---

#### [P2-3] isLoading 초기값으로 인한 복합 로딩 상태 미처리

- **위치**: `AppShell.tsx:194-205`
- **문제**: `if (isLoading) return <Skeleton />` 체크가 `useTasks.isLoading`만 대상
  - `useDocTree`, `useRequests`, `useNotices` 등 다른 훅의 로딩 상태 무시
- **영향**: 사이드바가 데이터 없이 빈 상태로 렌더링될 수 있음
- **해결 방향**: 복합 로딩 상태 체크 또는 Suspense 경계 도입

---

#### [P2-4] JSX 내 인라인 async 함수 (매 렌더 새 참조)

- **위치**: `AppShell.tsx:222-233`
- **문제**: `onNewTask`, `onStopTask`가 useCallback 없이 JSX 내 인라인으로 정의됨
  ```tsx
  onStopTask={async (id) => {
    await fetch(`/api/tasks/${id}/run`, { method: "DELETE" });
    await updateRequest(id, { status: "stopped" });
    await refetchRequests();
  }}
  ```
- **영향**: AppShell 렌더링마다 새 함수 인스턴스 생성 → TaskSidebar `React.memo` 효과 무력화
- **해결 방향**: `useCallback`으로 래핑 (저비용 수정)

---

### 🟢 P3 — 장기 개선 고려

#### [P3-1] React Query / SWR 도입 검토

- **현황**: 12개 훅 모두 수동 캐싱 없음, stale-while-revalidate 없음
- **영향**: 페이지 전환 시 매번 전체 재fetch, 캐시 재사용 없음
- **해결 방향**: React Query 도입 시 자동 캐싱, 중복 요청 dedup, 백그라운드 revalidation 획득

---

#### [P3-2] SSE 연결 중복 위험

- **위치**: `hooks/useTasks.ts:71-99`
- **문제**: SSE 연결이 훅 내부에 있어 useTasks 복수 호출 시 복수 SSE 연결 발생 가능
- **현재 상황**: useTasks는 AppShell에서만 호출되므로 현재는 안전
- **해결 방향**: SSE를 별도 Context나 싱글턴으로 분리하여 중복 방지 보장

---

#### [P3-3] useMonitor 히스토리 관리

- **위치**: `hooks/useMonitor.ts`
- **현황**: 60개 스냅샷을 useRef에 저장, 1초 폴링
- **문제**: 1초 폴링이 메인 스레드에서 실행되어 렌더링 중단 유발 가능
- **해결 방향**: 현재 구현 수용 가능. 필요 시 Web Worker로 이동

---

## 4. 데이터 흐름 다이어그램

```
[ API Server ]
      │
      ├── /api/tasks ──────────────────► useTasks ─────────────────────────┐
      ├── /api/tasks/watch (SSE) ───────► useTasks (debounce 1s)            │
      ├── /api/sprints ────────────────► useTasks (parallel fetch)          │
      ├── /api/sprints ────────────────► useSprints                         │
      ├── /api/orchestrate/status ──────► useSprints  (5s ★중복)            │
      ├── /api/orchestrate/status ──────► useCosts    (5s ★중복)            │
      ├── /api/orchestrate/status ──────► useOrchestrationStatus (2~5s ★중복)│
      ├── /api/docs ──────────────────► useDocTree                          │
      ├── /api/requests ───────────────► useRequests                        │
      ├── /api/notices ────────────────► useNotices                         │
      ├── /api/prds ────────────────── ► usePrds                            │
      └── /api/monitor ─────────────── ► useMonitor (1s poll)               │
                                                                             │
[ AppShell ] ◄───────────────────────────────────────────────────────────── ┘
      │  (6개 훅 + 로컬 상태 3개)
      │
      ├──► TaskSidebar (16+ props ★Props Drilling)
      │       ├── groups, prds, docTree
      │       ├── filter, onFilterChange
      │       ├── onDocCreate/Delete/Rename/Reorder/ReorderError (5개 콜백)
      │       ├── requestItems, onNewTask★inline, onStopTask★inline
      │       └── noticeItems, currentPath
      │
      ├──► RunningIndicator (requestItems ★중복 전달)
      ├──► GlobalSearch (requestItems, docTree ★중복 전달)
      └──► HomeDashboard (requestItems ★중복 전달)
```

---

## 5. 요약 및 우선순위 매트릭스

| 우선순위 | 항목 | 영향 | 난이도 |
|---|---|---|---|
| 🔴 P1 | 오케스트레이션 상태 중복 폴링 제거 | 네트워크 요청 감소 | 낮음 |
| 🔴 P1 | requestItems → RequestsContext | 컴포넌트 결합 감소 | 중간 |
| 🔴 P1 | AppShell God Component 분리 | 렌더링 성능 향상 | 높음 |
| 🟡 P2 | onNewTask/onStopTask useCallback 래핑 | TaskSidebar 리렌더 감소 | 낮음 |
| 🟡 P2 | DocTree 콜백 → DocTreeContext | Props drilling 제거 | 중간 |
| 🟡 P2 | `useAsyncData` 추상 훅 도입 | 코드 중복 제거 | 중간 |
| 🟡 P2 | 복합 로딩 상태 처리 개선 | UX 안정성 향상 | 낮음 |
| 🟢 P3 | React Query 도입 | 캐싱/성능 전반 | 높음 |
| 🟢 P3 | SSE 연결 싱글턴화 | 안전성 강화 | 낮음 |
