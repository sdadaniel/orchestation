# Orchestration Dashboard (Frontend)

Next.js 기반 오케스트레이션 대시보드. 태스크 관리, 파이프라인 실행, 비용 모니터링을 제공한다.

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run storybook  # http://localhost:6006
```

## 디렉토리 구조

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 메인 (태스크 목록)
│   ├── tasks/                    # 태스크 목록 + 상세 + 생성
│   ├── plan/                     # 실행 계획 (DAG)
│   ├── cost/                     # 비용/토큰 분석
│   ├── docs/                     # 문서 뷰어
│   ├── monitor/                  # 시스템 모니터링
│   ├── night-worker/             # 야간 작업자
│   ├── notices/                  # 알림
│   ├── requests/                 # 요청 관리
│   ├── settings/                 # 설정
│   ├── terminal/                 # 터미널
│   └── api/                      # API Routes (아래 참조)
│
├── service/                      # DB 접근 + 데이터 저장
│   ├── db.ts                     #   SQLite 연결 (better-sqlite3)
│   ├── task-store.ts             #   태스크 CRUD
│   ├── token-logger.ts           #   토큰 사용량 기록
│   ├── run-history.ts            #   파이프라인 실행 이력
│   └── schema.sql                #   DB 스키마 정의
│
├── engine/                       # 오케스트레이션 핵심 엔진
│   ├── orchestrate-engine.ts     #   메인 파이프라인 (워커, 시그널, 루프)
│   ├── orchestration-manager.ts  #   엔진 래퍼 (UI 상태/이벤트)
│   ├── job-task.ts               #   단일 태스크 실행
│   ├── job-review.ts             #   코드 리뷰 실행
│   ├── merge-utils.ts            #   Git 머지 + 충돌 해결
│   ├── claude-worker.ts          #   Claude CLI 호출
│   ├── context-builder.ts        #   태스크 프롬프트 빌드
│   ├── model-selector.ts         #   복잡도 → 모델 선택
│   ├── signal.ts                 #   시그널 파일 관리
│   ├── night-worker.ts           #   야간 코드 스캔/태스크 생성
│   └── runner/                   #   태스크 러너
│       ├── task-runner-manager.ts  # 병렬 태스크 실행 관리
│       ├── task-runner-iterm.ts    # iTerm2 탭 통합
│       ├── task-runner-utils.ts    # 러너 공용 유틸
│       └── task-runner-types.ts    # 러너 타입 정의
│
├── parser/                       # 파일 파싱 / 데이터 추출
│   ├── parser.ts                 #   태스크 프론트매터 파싱
│   ├── cost-parser.ts            #   토큰/비용 로그 파싱
│   ├── notice-parser.ts          #   알림 파싱 + 생성
│   ├── task-log-parser.ts        #   태스크 출력 로그 파싱
│   ├── plan-parser.ts            #   계획 파일 파싱
│   ├── plan-tree.ts              #   계획 트리 구조 빌드
│   ├── prd-parser.ts             #   PRD 파싱
│   └── doc-tree.ts               #   문서 트리 빌드
│
├── lib/                          # 순수 유틸리티 (외부 의존 없음)
│   ├── paths.ts                  #   경로 상수 (PROJECT_ROOT 등)
│   ├── settings.ts               #   설정 로드/검증
│   ├── utils.ts                  #   Tailwind cn()
│   ├── date-utils.ts             #   날짜 포맷팅
│   ├── error-utils.ts            #   에러 메시지 추출
│   ├── format-utils.ts           #   시간 포맷팅
│   ├── slug-utils.ts             #   URL 슬러그 생성
│   ├── frontmatter-utils.ts      #   gray-matter 유틸
│   ├── process-utils.ts          #   자식 프로세스 스트림
│   ├── template.ts               #   템플릿 렌더링
│   ├── request-parser.ts         #   요청 메타데이터 파싱
│   ├── cost-aggregation.ts       #   비용 집계 (모델별)
│   ├── cost-phase.ts             #   비용 집계 (페이즈별)
│   ├── waterfall.ts              #   워터폴 시각화 변환
│   ├── query-client.ts           #   TanStack Query 설정
│   └── query-keys.ts             #   쿼리 키 팩토리
│
├── cli/                          # CLI 진입점 (tsx로 실행)
│   ├── run-night-worker.ts       #   orchestrate night
│   ├── run-task.ts               #   단일 태스크 (iTerm용)
│   └── run-review.ts             #   코드 리뷰 (iTerm용)
│
├── views/                        # 페이지별 View (app/page wrapper가 import)
│   ├── tasks/
│   │   ├── TasksPageView.tsx
│   │   ├── index.ts
│   │   └── components/
│   │       ├── RequestCard.tsx
│   │       ├── DAGCanvas.tsx
│   │       └── index.ts
│   ├── tasks/[id]/
│   ├── tasks/new/
│   ├── docs/
│   └── ...
│
├── components/                   # 전역 공유 컴포넌트(2개 이상 화면에서 재사용)
│   ├── AppShell/
│   │   ├── AppShell.tsx
│   │   └── index.ts
│   ├── Sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── index.ts
│   │   └── components/
│   │       ├── DocTreeNode.tsx
│   │       └── index.ts
│   ├── ui/                       # 디자인 시스템 (Button, Input, Select 등)
│   ├── TaskDetail/
│   └── ...
│
├── hooks/                        # React Query 커스텀 훅
│   ├── useTasks.ts
│   ├── useCosts.ts
│   ├── useRunHistory.ts
│   └── ...
│
├── store/                        # Zustand 클라이언트 상태
│   ├── tasksStore.ts
│   ├── orchestrationStore.ts
│   └── suggestStore.ts
│
├── providers/                    # React Context Providers
│   ├── QueryProvider.tsx         #   TanStack Query
│   └── GatewayWsProvider.tsx     #   WS 실시간 업데이트
│
├── constants/                    # 상수 정의
│   ├── status.ts                 #   태스크 상태/우선순위
│   └── theme.ts                  #   테마 상수
│
└── types/                        # 타입 정의
    ├── monitor-types.ts
    ├── plan.ts
    └── waterfall.ts
```

## 폴더 규칙 (필수)

### 1) `app/`는 라우팅 진입점만 담당

- `app/**/page.tsx`는 View를 import해서 그대로 렌더만 한다.
- 페이지 로직/상태/화면 구성은 `views/**`에 둔다.

```tsx
import TasksPageView from "@/views/tasks";

export default function TasksPage() {
  return <TasksPageView />;
}
```

### 2) `views/` 구조 규칙

- 각 페이지 폴더는 `XxxPageView.tsx` + `index.ts`를 기본으로 한다.
- `index.tsx`는 사용하지 않는다.
- 엔트리 export는 `index.ts`만 사용한다.

```ts
export { default } from "./TasksPageView";
```

- 페이지 전용 하위 조각 컴포넌트는 같은 폴더의 `components/`로 분리한다.
- `components/index.ts`를 만들어 배럴 export로만 소비한다.

### 3) `components/`는 전역 공유만 허용

- `src/components`에는 **2개 이상 화면에서 재사용되는 컴포넌트만** 둔다.
- 한 페이지에서만 쓰이면 `views/<page>/components`로 이동한다.
- 전역 컴포넌트도 폴더 단위로 관리한다.
  - `components/Foo/Foo.tsx`
  - `components/Foo/index.ts`
- 컴포넌트 폴더명은 **반드시 PascalCase**를 사용한다.
  - `components/sidebar` (X)
  - `components/Sidebar` (O)
- 대표 컴포넌트가 있는 폴더는 **폴더명과 대표 컴포넌트명이 반드시 동일**해야 한다.
  - `components/Sidebar/Sidebar.tsx`에서 `export function Sidebar()` (O)
  - `components/Sidebar/Sidebar.tsx`에서 `export function TaskSidebar()` (X)

### 4) 모든 엔트리 파일은 `index.ts`

- `index.tsx` 금지 (`views`, `components` 모두 동일).
- `index.ts`는 export만 담당하고 UI 로직을 넣지 않는다.

### 5) 하위 컴포넌트 폴더 규칙

- 메인 컴포넌트 옆에 보조 컴포넌트가 2개 이상이면 `components/`로 분리한다.
- 보조 컴포넌트도 직접 파일 경로 import 대신 `./components`를 우선 사용한다.

### 6) 타입 분리 규칙 (`types/`)

- 컴포넌트/뷰 파일 내부 타입 선언(`interface`, `type`)은 `types/`로 분리한다.
- 폴더마다 타입 엔트리는 `types/index.ts`를 기본으로 사용한다.
- 컴포넌트 파일에서는 `import type`으로만 타입을 가져온다.
- 배럴 파일에서도 타입을 재-export해서 타입 import 경로를 일관되게 유지한다.

### 7) Import 경로 기준

- 페이지 레벨: `@/views/<route>`
- 전역 공유: `@/components/<ComponentFolder>` (`ComponentFolder`는 PascalCase)
- 같은 페이지 전용 조각: `./components`

### 8) 컴포넌트 작성 규칙 (강제)

- **1파일 1컴포넌트**를 원칙으로 한다. 한 파일에 여러 컴포넌트를 함께 선언하지 않는다.
- 컴포넌트 export는 **무조건 `export default`**를 사용한다.
- 컴포넌트 선언은 `function` 선언식 대신 **함수형 컴포넌트 상수**를 사용한다.
  - `const ComponentName = (...) => { ... }`

### 9) 엔트리 컴포넌트 역할 분리 규칙 (강제)

- 각 컴포넌트 폴더의 대표 파일(예: `Sidebar/Sidebar.tsx`, `AppShell/AppShell.tsx`)은 **엔트리 조합 역할만** 담당한다.
- 엔트리 파일에는 페이지/섹션 구조를 한눈에 보여주는 수준의 코드만 남기고, 상세 UI/상태/이벤트 로직은 `components/` 하위로 분리한다.
- 상세 컴포넌트는 상대적으로 무거워져도 허용한다. 복잡도는 엔트리가 아니라 하위 컴포넌트로 이동시킨다.
- 엔트리 파일에서 직접 긴 JSX 블록, 다수의 `useState/useEffect/useMemo/useCallback` 로직이 필요해지면 분리 대상으로 간주한다.

### 10) 상태 소스 단일화 규칙 (강제)

- 훅/스토어(`useXxx`, Zustand store 등)에서 **직접 조회 가능한 값은 props로 다시 전달하지 않는다.**
- 같은 데이터를 상위에서 props로 내려주고 하위에서 다시 훅/스토어로 읽는 **이중 소스 패턴을 금지**한다.
- 데이터 소스는 컴포넌트 경계마다 하나만 선택한다.
  - 상위 소유가 필요하면 props만 사용
  - 전역/공유 상태면 하위에서 훅/스토어 직접 사용
- 예외는 테스트/스토리북 등 명확한 목적이 있을 때만 허용하며, 주석으로 의도를 명시한다.

## 의존성 방향

```
lib/ (순수 유틸)  <--  parser/  <--  service/  <--  engine/
       ^                                ^              ^
    constants/                        types/         cli/
```

- `lib/` 은 다른 레이어를 import하지 않음
- `parser/` 는 `lib/` 만 import
- `service/` 는 `lib/`, `parser/` import 가능
- `engine/` 은 모든 레이어 import 가능
- **역방향 의존 금지**: `lib/` 가 `service/` 를 import하면 안 됨

## API Routes


| 경로                        | 메서드               | 설명               |
| ------------------------- | ----------------- | ---------------- |
| `/api/tasks`              | GET, POST         | 태스크 목록/생성        |
| `/api/tasks/[id]`         | GET, PUT, DELETE  | 태스크 상세/수정/삭제     |
| `/api/tasks/[id]/run`     | POST, DELETE      | 태스크 실행/중지        |
| `/api/tasks/[id]/logs`    | GET               | 태스크 로그           |
| `/api/orchestrate/run`    | POST              | 파이프라인 시작         |
| `/api/orchestrate/stop`   | POST              | 파이프라인 중지         |
| `/api/orchestrate/status` | GET               | 파이프라인 상태         |
| `/ws/gateway`             | WS                | 파이프라인 상태/이벤트 스트림 |
| `/api/run-history`        | GET               | 실행 이력            |
| `/api/costs`              | GET               | 비용 데이터           |
| `/api/night-worker`       | GET, POST, DELETE | 야간 작업자           |
| `/api/notices`            | GET, POST         | 알림               |
| `/api/docs`               | GET, POST         | 문서               |
| `/api/settings`           | GET, PUT          | 설정               |


