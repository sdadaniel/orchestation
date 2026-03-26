---
id: TASK-154
title: status/priority 검증 상수 및 UI 상수 중복 제거 — 공유 모듈로 통합
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/requests/[id]/route.ts
  - src/frontend/src/app/api/sprints/route.ts
  - src/frontend/src/app/tasks/constants.ts
  - src/frontend/src/app/tasks/[id]/page.tsx
  - src/frontend/src/app/requests/page.tsx
---

## 문제

status/priority 관련 상수가 여러 파일에 중복 정의되어 있어 유지보수 위험이 높다.

### API 라우트 검증 상수 중복
- `src/frontend/src/app/api/tasks/route.ts` — `validStatuses`, `validPriorities` 로컬 정의
- `src/frontend/src/app/api/tasks/[id]/route.ts` — 동일한 배열 재정의
- `src/frontend/src/app/api/requests/route.ts` — 유사하지만 다른 `validPriorities` (`critical` 누락)
- `src/frontend/src/app/api/sprints/route.ts` — 또 다른 `validStatuses` 정의

### UI 상수 중복
- `src/frontend/src/app/tasks/constants.ts` — `STATUS_DOT`, `STATUS_LABEL`, `PRIORITY_COLORS` 정의 (정규 위치)
- `src/frontend/src/app/tasks/[id]/page.tsx` (line 41-63) — 동일 상수 로컬 재정의
- `src/frontend/src/app/requests/page.tsx` — 유사 상수 로컬 정의

### 영향
- 상수 변경 시 3~5개 파일을 수동으로 동기화해야 함
- 이미 requests와 tasks 간 `validPriorities` 불일치 존재
- 버그 발생 가능성 높음

## 작업 내용

1. `src/frontend/src/app/tasks/constants.ts`에 API 검증용 상수(`VALID_STATUSES`, `VALID_PRIORITIES`)도 추가
2. 각 API 라우트에서 로컬 정의 제거 → 공유 모듈 import로 교체
3. UI 컴포넌트(`[id]/page.tsx`, `requests/page.tsx`)에서 로컬 상수 제거 → `constants.ts` import로 교체
4. requests의 priority 범위가 의도적 차이인지 확인 후, 의도적이면 별도 상수로 분리

## Completion Criteria

- status/priority 관련 상수가 `constants.ts` 한 곳에서만 정의됨
- 모든 API 라우트와 UI 컴포넌트가 공유 상수를 import하여 사용
- 로컬 중복 정의가 0개
- 기존 동작 변경 없음 (검증 로직 결과 동일)
