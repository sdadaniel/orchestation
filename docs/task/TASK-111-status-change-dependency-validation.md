---
id: TASK-111
title: 상태 변경 시 의존성 검증 추가
status: in_progress
priority: high
sprint:
depends_on: []
role: general
scope:
  - src/frontend/src/app/api/requests/[id]/route.ts
  - src/frontend/src/app/api/tasks/[id]/route.ts
  - scripts/orchestrate.sh
---

# TASK-111: 상태 변경 시 의존성 검증 추가

## 배경

현재 태스크 상태를 `in_progress`로 변경할 때 `depends_on` 의존성 충족 여부를 검증하지 않는다.
이로 인해 TASK-093 → TASK-094 → TASK-095 같은 직렬 의존성 체인에서 셋 다 동시에 `in_progress`가 되는 오류가 발생했다.

## 목표

`in_progress`로 상태 변경 시 선행 태스크(`depends_on`)가 모두 `done`인지 검증하여, 미충족 시 변경을 차단한다.

## 완료 조건

- [ ] `PUT /api/requests/[id]` — status를 `in_progress`로 변경 요청 시, `depends_on` 태스크가 모두 `done`이 아니면 400 에러 반환
- [ ] `PUT /api/tasks/[id]` — 동일 검증 적용
- [ ] `orchestrate.sh` — 상태 변경 로직에서 `deps_satisfied()` 외 경로가 없는지 점검
- [ ] 의존성 미충족 시 사용자에게 어떤 태스크가 미완료인지 에러 메시지에 포함
