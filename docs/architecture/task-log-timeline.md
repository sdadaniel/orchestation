# Task 로그 타임라인 설계

> 태스크 상세 페이지에서 task/review 전체 이력을 시간순으로 보여주는 기능

## 현재 상태 (2026-03-31)

태스크 상세 페이지에는 6개 탭이 존재한다: Content, Scope, Cost, 로그, Terminal, AI Result.

### 구현 완료된 것

| 항목 | 설명 |
|------|------|
| **LiveTerminalPanel** (Terminal 탭) | WebSocket(`/ws/task-terminal/{taskId}`)으로 JSONL conversation을 실시간 스트리밍. tool_use, thinking, text, system 이벤트를 파싱하여 터미널 스타일로 표시 |
| **LiveLogPanel** (로그 탭 — 실행 중) | WebSocket(`/ws/task-logs/{taskId}`)으로 .log 파일 변경을 실시간 스트리밍. TaskRunnerManager 이벤트 또는 파일 watch 기반 |
| **CompletedLogPanel** (로그 탭 — 완료) | `/api/tasks/{id}/logs` API로 완료된 태스크의 로그 표시. SQLite 우선 조회, 파일 fallback |
| **SQLite tables** | `task_events` (status_change, review_approved, review_rejected 등), `token_usage` (phase별 비용/토큰), `conversations` (JSONL 라인 저장) |
| **CostTab** | `costEntries` (phase별 비용/duration/tokens) 표시 |
| **AI Result 탭** | 워커 결과, 리뷰 피드백, rejected/review failed 상태 표시 |

### 미구현

| 항목 | 설명 |
|------|------|
| **타임라인 뷰** | task → review → retry → review → done 전체 시퀀스를 한눈에 보는 UI 없음 |
| **순번 기반 파일 네이밍** | 로그 파일에 실행 순번이 없어 retry 시 덮어쓰기됨 |
| **review 로그 UI 표시** | review conversation JSONL은 SQLite에 저장되지만, 별도 탭/뷰로 표시하지 않음 |

## 문제

태스크는 아래와 같이 여러 단계를 **왔다갔다** 할 수 있다:

```
task 실행 → review → 수정요청 → task 재실행 → review → 수정요청 → task 재실행 → review → 승인 → done
```

### 해결된 문제

- **review 데이터 저장**: `task_events` 테이블에 `review_approved`, `review_rejected`, `retry_limit_exceeded` 이벤트 기록됨
- **실시간 스트리밍**: Terminal 탭(LiveTerminalPanel)과 로그 탭(LiveLogPanel)에서 WebSocket 기반 실시간 로그 제공
- **비용/토큰 추적**: `token_usage` 테이블에 phase별(task, review) 비용/토큰/duration 저장

### 남은 문제

- **타임라인 시퀀스 뷰 부재**: 사용자가 "이 태스크가 몇 번 retry 되었는지, 각 단계에서 무슨 일이 있었는지"를 한눈에 볼 수 없음
- **파일 덮어쓰기**: `TASK-XXX-task-conversation.jsonl`이 retry마다 새로 작성되어 이전 실행의 conversation이 유실됨 (단, SQLite `conversations` 테이블에는 누적 저장)
- **review conversation 미표시**: review phase의 conversation을 UI에서 열어볼 방법이 없음
- **단계별 구분 불가**: 로그 탭에서 task 1차/review 1차/task 2차/review 2차가 구분 없이 시간순으로 섞여 나옴

## 데이터 소스

### SQLite (주 데이터 소스)

```sql
-- task_events: 상태 변경 이력 (타임라인의 뼈대)
-- event_type: status_change, dispatch, review_start, review_result,
--             review_approved, review_rejected, retry_limit_exceeded, merge, signal
SELECT * FROM task_events WHERE task_id = ? ORDER BY timestamp;

-- token_usage: 단계별 비용 (타임라인 각 항목의 비용 정보)
-- phase: task, review, model_selection
SELECT * FROM token_usage WHERE task_id = ? ORDER BY timestamp;

-- conversations: JSONL 라인 (타임라인 항목 클릭 시 상세 보기)
-- phase: task, review
SELECT * FROM conversations WHERE task_id = ? ORDER BY line_number;
```

### 파일 (레거시 fallback)

```
output/ (또는 .orchestration/output/)
├── TASK-XXX-task-conversation.jsonl  # task claude stream-json (retry 시 덮어쓰기)
├── TASK-XXX-review-conversation.jsonl # review claude 전체 기록
└── TASK-XXX-review-feedback.txt      # review 수정요청 피드백 텍스트

output/logs/
└── TASK-XXX.log                      # task 실행 stdout/stderr
```

### retry 카운터 (orchestrate.sh)

- `$TMP_PREFIX/retry/$TASK_ID` 파일에 숫자로 관리
- `get_retry_count()` / `increment_retry()` 함수
- `MAX_REVIEW_RETRY` (기본값 3) 초과 시 failed 처리
- retry 시 `_db_insert_event "$task_id" "review_rejected" "in_progress"` 호출

## 제안: 타임라인 뷰

### 핵심 아이디어

SQLite `task_events` + `token_usage` 테이블을 조합하면 **파일 파싱 없이** 타임라인을 구성할 수 있다.

```
task_events에서 추출 가능한 시퀀스 예시:

#1  status_change  pending → in_progress    14:15
#2  (token_usage)  phase=task               14:15  cost=$0.42  duration=202s
#3  status_change  in_progress → reviewing  14:18
#4  review_rejected                         14:19  detail="타입 정의 누락"
#5  status_change  reviewing → in_progress  14:19
#6  (token_usage)  phase=review             14:19  cost=$0.08  duration=45s
#7  (token_usage)  phase=task               14:20  cost=$0.31  duration=135s
#8  status_change  in_progress → reviewing  14:22
#9  review_approved                         14:23
#10 status_change  reviewing → done         14:23
#11 (token_usage)  phase=review             14:23  cost=$0.06  duration=38s
```

### UI 타임라인 뷰

```
┌─────────────────────────────────────────────────┐
│ TASK-001 프로젝트 기반 설정 및 DB/API 레이어 구축    │
│                                                   │
│ Timeline                                          │
│ ─────────────────────────────────────────────     │
│                                                   │
│ ● #1 Task 실행        14:15  3분 22초  $0.42     │
│   └─ 도구: Read 12, Edit 8, Bash 3               │
│                                                   │
│ ● #2 Review           14:19  45초     $0.08      │
│   └─ ❌ 수정요청: "타입 정의 누락, 에러 핸들링 부족"  │
│                                                   │
│ ● #3 Task 재실행       14:20  2분 15초  $0.31    │
│   └─ 도구: Edit 4                                 │
│                                                   │
│ ● #4 Review           14:23  38초     $0.06      │
│   └─ ✅ 승인                                      │
│                                                   │
│ Total: 6분 50초  $0.87  retry 1회                 │
│                                                   │
│ [각 항목 클릭 시 해당 단계의 conversation 펼침]      │
└─────────────────────────────────────────────────┘
```

### 각 단계에서 표시할 정보

| 단계 | 데이터 소스 | 표시 정보 |
|------|------------|----------|
| Task 실행 | `task_events` (status_change → in_progress) + `token_usage` (phase=task) | 소요시간, 비용, 도구 호출 요약 |
| Review | `task_events` (review_approved/review_rejected) + `token_usage` (phase=review) | 승인/수정요청, 피드백, 비용 |
| Retry | `task_events` (review_rejected → in_progress) | retry 횟수, 이전 피드백 |
| 완료/실패 | `task_events` (→ done/failed) | 최종 상태, 총 비용 |

### 실시간 vs 완료

| 상태 | 동작 |
|------|------|
| 진행 중 (in_progress/reviewing) | WebSocket으로 현재 단계 로그 스트리밍 + 이전 단계는 SQLite에서 타임라인 표시 |
| 완료 (done/failed) | SQLite 기반으로 전체 타임라인 렌더링 |

## 구현 범위

### Phase 1: SQLite 기반 타임라인 API (백엔드)
- `task_events` + `token_usage` 조인하여 타임라인 시퀀스 구성
- `/api/tasks/:id/timeline` 엔드포인트 추가
- 각 단계의 conversation 접근 API (conversations 테이블에서 phase + timestamp 범위로 조회)

### Phase 2: 타임라인 UI 컴포넌트
- `TimelinePanel.tsx` — 타임라인 뷰 컴포넌트
- 각 단계 펼치기/접기 (conversation 상세)
- 비용/토큰 단계별 집계 + 합계
- 태스크 상세 페이지에 Timeline 탭 추가

### Phase 3: conversation 보존 개선
- retry 시 conversation.jsonl 덮어쓰기 방지 (순번 기반 또는 SQLite 전용)
- review conversation도 UI에서 열람 가능하게

## 변경 필요 파일

### 백엔드 (API)
| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `src/frontend/src/app/api/tasks/[id]/timeline/route.ts` | 타임라인 API (신규) | 미구현 |
| `src/frontend/src/app/api/tasks/[id]/logs/route.ts` | SQLite 기반 로그 조회 | **구현 완료** |
| `src/frontend/src/lib/db.ts` | SQLite 연결/쿼리 유틸 | **구현 완료** |

### 프론트엔드
| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `src/frontend/src/components/task-detail/LiveTerminalPanel.tsx` | JSONL 실시간 스트리밍 | **구현 완료** |
| `src/frontend/src/components/task-detail/LiveLogPanel.tsx` | .log 실시간 스트리밍 | **구현 완료** |
| `src/frontend/src/components/task-detail/CompletedLogPanel.tsx` | 완료 로그 표시 | **구현 완료** |
| `src/frontend/src/components/task-detail/TimelinePanel.tsx` | 타임라인 뷰 (신규) | 미구현 |
| `src/frontend/src/app/tasks/[id]/page.tsx` | Timeline 탭 추가 | 미구현 |

### 서버
| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `src/frontend/server.ts` | WebSocket: task-logs, task-terminal | **구현 완료** |

### 스크립트
| 파일 | 변경 내용 | 상태 |
|------|----------|------|
| `scripts/orchestrate.sh` | retry 카운터, task_events/token_usage DB 기록 | **구현 완료** |
| `scripts/job-task.sh` | conversation.jsonl 작성 | **구현 완료** (순번 미적용) |
| `scripts/job-review.sh` | review-conversation.jsonl, feedback.txt 작성 | **구현 완료** (순번 미적용) |
| `scripts/lib/schema.sql` | task_events, token_usage, conversations 테이블 | **구현 완료** |

### API 응답 (제안)

```typescript
// GET /api/tasks/:id/timeline
{
  timeline: [
    {
      step: 1,
      phase: "task",
      startedAt: "2026-03-31 14:15:00",
      duration_ms: 202000,
      cost_usd: 0.42,
      status: "done",
      toolSummary: { Read: 12, Edit: 8, Bash: 3 }
    },
    {
      step: 2,
      phase: "review",
      startedAt: "2026-03-31 14:18:30",
      duration_ms: 45000,
      cost_usd: 0.08,
      status: "rejected",
      feedback: "타입 정의 누락, 에러 핸들링 부족"
    },
    {
      step: 3,
      phase: "task",
      startedAt: "2026-03-31 14:20:00",
      duration_ms: 135000,
      cost_usd: 0.31,
      status: "done",
      toolSummary: { Edit: 4 }
    },
    {
      step: 4,
      phase: "review",
      startedAt: "2026-03-31 14:22:30",
      duration_ms: 38000,
      cost_usd: 0.06,
      status: "approved"
    }
  ],
  summary: {
    totalCost: 0.87,
    totalDuration_ms: 420000,
    retryCount: 1,
    finalStatus: "done"
  },
  currentStep: null  // 또는 진행 중인 step 번호
}
```

## 구현 현황 (2026-03-31)

### 완료

- [x] SQLite 스키마: `task_events`, `token_usage`, `conversations` 테이블
- [x] orchestrate.sh: retry 카운터, review_approved/review_rejected/retry_limit_exceeded 이벤트 DB 기록
- [x] job-task.sh / job-review.sh: conversation JSONL 파일 생성, token_usage DB 기록
- [x] WebSocket `/ws/task-terminal/{taskId}`: JSONL conversation 실시간 스트리밍
- [x] WebSocket `/ws/task-logs/{taskId}`: .log 파일 변경 실시간 스트리밍
- [x] LiveTerminalPanel: JSONL 파싱 + 터미널 스타일 실시간 뷰
- [x] LiveLogPanel: .log 파일 실시간 스트리밍 뷰
- [x] CompletedLogPanel: 완료된 태스크 로그 표시 (SQLite 우선, 파일 fallback)
- [x] CostTab: phase별 비용/duration/tokens 표시
- [x] AI Result 탭: 워커 결과 + 리뷰 피드백 표시
- [x] `/api/tasks/:id/logs`: SQLite 기반 로그 조회 (task_events + token_usage)

### 미완료

- [ ] `/api/tasks/:id/timeline` API: task_events + token_usage 조합하여 타임라인 시퀀스 구성
- [ ] TimelinePanel.tsx: 타임라인 뷰 컴포넌트
- [ ] 태스크 상세 페이지에 Timeline 탭 추가
- [ ] 각 타임라인 단계 클릭 시 해당 conversation 펼치기
- [ ] conversation.jsonl 순번 기반 네이밍 (retry 시 덮어쓰기 방지)
- [ ] review conversation UI 열람 기능
