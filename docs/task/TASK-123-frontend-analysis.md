# TASK-123: 프론트엔드 코드 구조 및 네이밍 분석

> 분석 일자: 2026-03-25
> 대상 경로: `src/frontend/src/`

---

## 1. 폴더 구조 전체 파악

```
src/frontend/src/
├── app/                              # Next.js App Router 라우트
│   ├── api/                          # API Route Handlers
│   │   ├── auto-improve/
│   │   ├── chat/
│   │   ├── costs/
│   │   ├── docs/
│   │   ├── monitor/
│   │   ├── notices/
│   │   ├── orchestrate/
│   │   ├── plans/
│   │   ├── prds/
│   │   ├── requests/
│   │   ├── run-history/
│   │   ├── settings/
│   │   ├── sprints/
│   │   └── tasks/
│   ├── cost/                         # 비용 분석 페이지
│   ├── docs/                         # 문서 페이지
│   │   └── [id]/
│   ├── monitor/                      # 시스템 모니터링 페이지
│   ├── notices/                      # 알림 페이지
│   ├── plan/                         # 플랜 페이지
│   ├── requests/                     # 요청 관리 페이지 (레거시)
│   ├── settings/                     # 설정 페이지
│   ├── sprint/                       # 스프린트 페이지
│   │   └── [id]/
│   ├── tasks/                        # 태스크 관리 페이지
│   │   ├── constants.ts
│   │   ├── new/
│   │   └── [id]/
│   ├── terminal/                     # 터미널 페이지
│   ├── globals.css                   # 글로벌 스타일 (770줄)
│   └── layout.tsx                    # 루트 레이아웃
├── components/
│   ├── cost/                         # 비용 관련 컴포넌트
│   │   ├── SummaryCards.tsx
│   │   ├── CumulativeCostChart.tsx
│   │   ├── CostTable.tsx
│   │   ├── RunHistory.tsx
│   │   └── useSortableTable.ts       # ⚠️ Hook이 components/ 내부에 위치
│   ├── monitor/                      # 모니터링 컴포넌트
│   │   ├── MonitorDashboard.tsx
│   │   ├── CpuChart.tsx
│   │   ├── CpuMetrics.tsx
│   │   ├── MetricCard.tsx
│   │   ├── ProcessMetrics.tsx
│   │   └── SystemInfo.tsx
│   ├── plan/
│   │   └── PlanTreeContainer.tsx
│   ├── terminal/
│   │   └── TerminalView.tsx
│   ├── ui/                           # shadcn/ui 기반 공통 UI
│   │   ├── badge.tsx + stories.tsx
│   │   ├── button.tsx + stories.tsx
│   │   ├── checkbox.tsx + stories.tsx
│   │   ├── collapsible.tsx + stories.tsx
│   │   ├── dialog.tsx + stories.tsx
│   │   ├── input.tsx + stories.tsx
│   │   ├── label.tsx + stories.tsx
│   │   ├── progress.tsx + stories.tsx
│   │   ├── select.tsx + stories.tsx
│   │   ├── sheet.tsx + stories.tsx
│   │   ├── skeleton.tsx + stories.tsx
│   │   ├── textarea.tsx + stories.tsx
│   │   └── toast.tsx + stories.tsx
│   ├── waterfall/                    # 워터폴 뷰 컴포넌트
│   │   ├── WaterfallContainer.tsx
│   │   ├── SprintHeader.tsx
│   │   ├── SprintProgress.tsx
│   │   ├── TaskBar.tsx
│   │   └── TaskDetailPanel.tsx
│   ├── AppShell.tsx                  # 앱 최상위 레이아웃
│   ├── AutoImproveControl.tsx
│   ├── BatchEditor.tsx
│   ├── ChatBot.tsx
│   ├── DAGCanvas.tsx
│   ├── GlobalSearch.tsx
│   ├── HorseRunningIndicator.tsx
│   ├── MarkdownContent.tsx
│   ├── RequestCard.tsx
│   ├── RightPanel.tsx
│   ├── RunningIndicator.tsx
│   ├── sidebar.tsx                   # ⚠️ PascalCase 미준수
│   ├── SprintCreateDialog.tsx
│   ├── TaskCreateDialog.tsx
│   ├── TaskDeleteDialog.tsx
│   ├── TaskEditSheet.tsx
│   ├── TaskLogModal.tsx
│   ├── TaskLogTab.tsx
│   └── TaskRow.tsx
├── hooks/
│   ├── useCosts.ts
│   ├── useDocTree.ts
│   ├── useMonitor.ts
│   ├── useNotices.ts
│   ├── useOrchestrationStatus.ts
│   ├── usePlanTree.ts
│   ├── usePrds.ts
│   ├── useRequests.ts
│   ├── useRunHistory.ts
│   ├── useSprintDetail.ts
│   ├── useSprints.ts
│   └── useTasks.ts
├── lib/
│   ├── auto-improve-manager.ts
│   ├── cost-aggregation.ts
│   ├── cost-parser.ts
│   ├── cost-phase.ts
│   ├── doc-tree.ts
│   ├── notice-parser.ts
│   ├── orchestration-manager.ts
│   ├── parser.ts
│   ├── plan-parser.ts
│   ├── plan-tree.ts
│   ├── prd-parser.ts
│   ├── request-parser.ts
│   ├── run-history.ts
│   ├── settings.ts
│   ├── sprint-parser.ts
│   ├── task-log-parser.ts
│   ├── task-runner-manager.ts
│   ├── utils.ts
│   └── waterfall.ts
└── types/
    ├── plan.ts
    └── waterfall.ts
```

---

## 2. 네이밍 컨벤션 불일치 항목 목록

### 2-1. 파일명 케이스 불일치

| 파일 | 현재 | 기준 | 심각도 |
|------|------|------|--------|
| `components/sidebar.tsx` | camelCase (소문자 시작) | PascalCase (대문자 시작) | 🔴 High |

**컴포넌트 파일 기준**: `AppShell.tsx`, `RightPanel.tsx`, `TaskRow.tsx` 등 전부 PascalCase
**예외**: `sidebar.tsx` 만 소문자 시작 → `Sidebar.tsx` 로 변경 필요

---

### 2-2. Hook 위치 불일치

| 파일 | 현재 위치 | 권장 위치 | 심각도 |
|------|-----------|-----------|--------|
| `components/cost/useSortableTable.ts` | `components/` 내부 | `hooks/useSortableTable.ts` | 🟡 Medium |

**기준**: 모든 커스텀 훅은 `hooks/` 디렉토리에 집중
**예외**: `useSortableTable.ts` 만 `components/cost/` 내부에 위치

---

### 2-3. lib/ 파일명 네이밍 혼용

| 파일 | 패턴 |
|------|------|
| `auto-improve-manager.ts` | kebab-case |
| `cost-aggregation.ts` | kebab-case |
| `cost-parser.ts` | kebab-case |
| `orchestration-manager.ts` | kebab-case |
| `task-runner-manager.ts` | kebab-case |
| `utils.ts` | 단어 (일치) |
| `waterfall.ts` | 단어 (일치) |
| `settings.ts` | 단어 (일치) |
| `run-history.ts` | kebab-case |

`lib/` 내부는 대체로 kebab-case로 일관성 있으나, `utils.ts` / `waterfall.ts` / `settings.ts` 는 단일 단어라 구분 불필요. **큰 문제 없음.**

---

### 2-4. 상수 파일 위치 분산

| 상수 | 현재 위치 | 문제 |
|------|-----------|------|
| `STATUS_DOT`, `STATUS_LABEL`, `STATUS_ORDER` | `app/tasks/constants.ts` | 태스크 페이지에만 종속 |
| `PRIORITY_COLORS` | `app/tasks/constants.ts` | 전역 사용 필요 |
| DAG 레이아웃 상수 (`NODE_W`, `NODE_H` 등) | `app/tasks/constants.ts` | DAGCanvas에서 공유 필요 |
| `STATUS_STYLES`, `PRIORITY_STYLES` | 참조되나 선언 위치 불명확 | 🔴 누락 가능성 |

**문제**: 상수가 `app/tasks/` 페이지 디렉토리에 위치해 다른 컴포넌트에서 접근 시 경로 coupling 발생

---

### 2-5. types/ 파일 커버리지 부족

| 타입 | 현재 상태 |
|------|-----------|
| `types/waterfall.ts` | 정의됨 |
| `types/plan.ts` | 정의됨 |
| Task, Sprint, Notice, PRD 등 핵심 도메인 타입 | `types/` 에 없음 - 각 hook/lib에 인라인 정의 추정 |

**문제**: 도메인 타입이 중앙화되지 않아 재사용/수정 시 누락 위험

---

## 3. 컴포넌트 책임 분리 문제점

### 3-1. `sidebar.tsx` - 과도한 책임 집중 🔴

**현황**: 700줄 이상 단일 파일
**현재 책임**:
- 좌측 내비게이션 레이아웃
- 스프린트/상태별 태스크 그룹 렌더링
- 문서 트리 렌더링 (생성/이름변경/순서변경)
- PRD 목록 렌더링
- 필터 컨트롤

**문제**: SRP(단일책임원칙) 위반. 3~4개 컴포넌트로 분리 필요:
```
Sidebar.tsx           ← 레이아웃 조합 (thin)
├── TaskGroupList.tsx ← 스프린트/태스크 그룹
├── DocTreeList.tsx   ← 문서 트리
└── PrdList.tsx       ← PRD 목록
```

---

### 3-2. `AppShell.tsx` - 데이터 페칭과 레이아웃 혼합 🟡

**현황**: 220줄, 데이터 페칭 + 레이아웃 + 알림 로직 혼합
**현재 책임**:
- 전역 데이터 페칭 (tasks, PRDs, docs, notices)
- 레이아웃 렌더링 (sidebar, header, content, chat)
- 태스크 상태 변경 감지 및 Toast 알림 트리거
- 홈(/) 경로 분기

**문제**: 데이터 페칭 레이어와 레이아웃 레이어가 동일 컴포넌트에 존재. Context Provider로 데이터를 분리하거나 별도 `AppDataProvider.tsx` 로 추출 필요

---

### 3-3. `DAGCanvas.tsx` - UI와 레이아웃 로직 혼합 🟡

**현황**: 237줄, SVG 렌더링 + DAG 레이아웃 계산 혼합
**현재 책임**:
- DAG 노드/엣지 레이아웃 계산
- SVG 렌더링
- Pan/Zoom 인터랙션
- 태스크 상태별 그룹화

**문제**: 레이아웃 계산 로직(`lib/dag-layout.ts` 같은 별도 파일)과 SVG 렌더링 분리 필요

---

### 3-4. `tasks/page.tsx` - 뷰 로직 과적재 🟡

**현황**: 단일 페이지에 DAG 뷰, 보드 뷰, 상태 뷰, 검색, 필터 모두 포함
**문제**: 탭별 뷰를 별도 컴포넌트로 분리하지 않아 페이지 파일이 비대해질 가능성:
```
tasks/
├── page.tsx              ← 라우트 + 탭 전환만
├── _views/
│   ├── TaskDagView.tsx
│   ├── TaskBoardView.tsx
│   └── TaskStatusView.tsx
```

---

### 3-5. `components/cost/RunHistory.tsx` 네이밍 충돌 🟡

- `components/cost/RunHistory.tsx` - 비용 페이지의 실행 이력 컴포넌트
- `lib/run-history.ts` - 실행 이력 데이터 유틸리티
- `hooks/useRunHistory.ts` - 실행 이력 훅

**문제**: `RunHistory` 이름이 컴포넌트/lib/hook에 동시 사용 → 컴포넌트는 `CostRunHistory.tsx` 등으로 도메인 명시 권장

---

### 3-6. `requests/page.tsx` - 레거시 페이지 잔존 🟡

- `/requests` 라우트가 레거시로 표기되어 있으나 삭제되지 않음
- `hooks/useRequests.ts`, `lib/request-parser.ts`, `components/RequestCard.tsx` 등 관련 코드 전반에 잔존
- Task와 Request 개념의 역할 혼동 야기

---

## 4. 요약 및 우선순위

### 즉시 조치 필요 (High)

| # | 문제 | 파일 |
|---|------|------|
| 1 | `sidebar.tsx` → `Sidebar.tsx` 리네임 | `components/sidebar.tsx` |
| 2 | `sidebar.tsx` 분할 (700줄, SRP 위반) | `components/sidebar.tsx` |
| 3 | `STATUS_STYLES`/`PRIORITY_STYLES` 선언 위치 확인 및 `lib/constants.ts` 중앙화 | `app/tasks/constants.ts` |

### 개선 권장 (Medium)

| # | 문제 | 파일 |
|---|------|------|
| 4 | `useSortableTable.ts` → `hooks/` 이동 | `components/cost/useSortableTable.ts` |
| 5 | 도메인 타입 중앙화 (`types/task.ts`, `types/sprint.ts` 등) | `types/` |
| 6 | `AppShell.tsx` 데이터 레이어 분리 | `components/AppShell.tsx` |
| 7 | `DAGCanvas.tsx` 레이아웃 로직 분리 | `components/DAGCanvas.tsx` |
| 8 | `RunHistory.tsx` → `CostRunHistory.tsx` 리네임 | `components/cost/RunHistory.tsx` |

### 검토 필요 (Low)

| # | 문제 |
|---|------|
| 9 | 레거시 `requests/` 라우트 및 관련 코드 정리 여부 결정 |
| 10 | `tasks/page.tsx` 탭별 뷰 컴포넌트 분리 |
