---
id: TASK-066
title: Monitor API ps 파싱 NaN PID 방어 코드 추가
status: done
priority: medium
sprint:
depends_on: []
branch: task/TASK-066-monitor-api-ps--nan-pid---
worktree: ../repo-wt-TASK-066
role: general
reviewer_role: reviewer-general
---

# TASK-066: Monitor API ps 파싱 NaN PID 방어 코드 추가

## 원본 요청

- Request: REQ-027
- 제목: Monitor API ps 파싱 안정화
- 내용: monitor API에서 ps aux 출력 파싱 시 parts[1]이 숫자가 아닐 경우 NaN PID 발생.

## 문제
- `api/monitor/route.ts:30-46`
- ps 출력 포맷이 예상과 다를 경우 parseInt 결과가 NaN
- NaN PID로 후속 로직 오동작 가능

## Completion Criteria
- parseInt 결과 NaN 체크 후 해당 라인 스킵
- 예상 외 포맷에 대한 방어 코드 추가

## 완료 조건

- `api/monitor/route.ts:30-46` 에서 `parseInt` 결과가 NaN인 경우 해당 라인 스킵
- ps aux 출력 포맷이 예상과 다를 때(parts 배열 길이 부족, 숫자 아닌 값 등) 방어 처리 추가
- NaN PID로 인한 후속 로직 오동작 차단
