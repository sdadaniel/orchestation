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
│   ├── auto-improve-manager.ts   #   자동 개선 루프
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
│   ├── run-engine.ts             #   orchestrate run
│   ├── run-night-worker.ts       #   orchestrate night
│   ├── run-task.ts               #   단일 태스크 (iTerm용)
│   └── run-review.ts             #   코드 리뷰 (iTerm용)
│
├── components/                   # React 컴포넌트
│   ├── ui/                       #   디자인 시스템 (Button, Input, Select 등)
│   ├── cost/                     #   비용 분석 (CostTable, RunHistory 등)
│   ├── sidebar/                  #   사이드바 (DocTree, TaskList 등)
│   ├── task-detail/              #   태스크 상세 (로그, 터미널)
│   ├── monitor/                  #   시스템 모니터링
│   ├── plan/                     #   계획 트리
│   ├── terminal/                 #   터미널 뷰
│   ├── waterfall/                #   워터폴 차트
│   ├── AppShell.tsx              #   레이아웃 쉘
│   ├── GlobalSearch.tsx          #   전역 검색
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
│   └── SseProvider.tsx           #   SSE 실시간 업데이트
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

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/tasks` | GET, POST | 태스크 목록/생성 |
| `/api/tasks/[id]` | GET, PUT, DELETE | 태스크 상세/수정/삭제 |
| `/api/tasks/[id]/run` | POST, DELETE | 태스크 실행/중지 |
| `/api/tasks/[id]/logs` | GET | 태스크 로그 |
| `/api/orchestrate/run` | POST | 파이프라인 시작 |
| `/api/orchestrate/stop` | POST | 파이프라인 중지 |
| `/api/orchestrate/status` | GET | 파이프라인 상태 |
| `/api/orchestrate/logs` | GET | 파이프라인 로그 (SSE) |
| `/api/run-history` | GET | 실행 이력 |
| `/api/costs` | GET | 비용 데이터 |
| `/api/night-worker` | GET, POST, DELETE | 야간 작업자 |
| `/api/notices` | GET, POST | 알림 |
| `/api/docs` | GET, POST | 문서 |
| `/api/settings` | GET, PUT | 설정 |
