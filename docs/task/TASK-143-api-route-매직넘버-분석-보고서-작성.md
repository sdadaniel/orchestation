---
id: TASK-143
title: "API route 및 hooks 매직 넘버 분석 보고서 작성"
status: done
branch: task/task-143
worktree: ../repo-wt-task-143
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/tasks/watch/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/app/api/monitor/route.ts
  - src/frontend/src/app/api/night-worker/route.ts
  - src/frontend/src/hooks/useTasks.ts
  - src/frontend/src/hooks/useRequests.ts
  - src/frontend/src/app/night-worker/page.tsx
  - src/frontend/src/components/TaskLogModal.tsx
  - src/frontend/src/components/AutoImproveControl.tsx
  - docs/todo/magic-number-audit.md
---

API route와 커스텀 hooks 전반에 하드코딩된 timeout, interval, limit 값이 15건 이상 산재해 있다.
값의 의미가 코드만으로는 파악하기 어렵고, 동일 목적의 값이 파일마다 다른 숫자로 설정된 경우도 있어 유지보수 리스크가 존재한다.

### 발견된 주요 매직 넘버

| 파일 | 값 | 용도 |
|------|-----|------|
| `api/chat/route.ts` | `90000` | Claude CLI 타임아웃 |
| `api/tasks/watch/route.ts` | `30000`, `5*60*1000`, `100` | keep-alive, SSE 타임아웃, debounce |
| `api/monitor/route.ts` | `3000` (3건) | execSync 타임아웃 |
| `api/night-worker/route.ts` | `200` | 로그 slice 한도 |
| `api/tasks/analyze/route.ts` | `120` | maxDuration |
| `api/chat/route.ts` | `120` | maxDuration |
| `hooks/useTasks.ts` | `1000`, `2000` | debounce, reconnect |
| `hooks/useRequests.ts` | `2000` | reconnect |
| `night-worker/page.tsx` | `3000`, `80` | 폴링 간격, 문자열 slice |
| `TaskLogModal.tsx` | `3000` | 로그 폴링 간격 |
| `AutoImproveControl.tsx` | `2000` | 상태 폴링 간격 |

### 태스크 내용

`docs/todo/magic-number-audit.md` 분석 보고서를 작성한다. 보고서에 포함할 내용:

1. scope 파일별 매직 넘버 전수 목록 (파일, 라인, 값, 용도)
2. 동일 목적인데 값이 다른 불일치 사례
3. 상수 추출 시 권장 구조 (예: `src/frontend/src/config/timeouts.ts`)
4. 우선순위별 개선 권고

## Completion Criteria
- `docs/todo/magic-number-audit.md` 파일이 생성됨
- scope에 명시된 모든 파일의 매직 넘버가 보고서에 기록됨
- 각 매직 넘버의 파일 경로, 라인 번호, 현재 값, 용도가 표로 정리됨
- 불일치 사례(동일 목적 다른 값)가 식별되어 기재됨
- 소스 코드 변경 없음 (보고서만 작성)
