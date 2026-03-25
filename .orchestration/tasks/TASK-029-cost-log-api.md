---
id: TASK-029
title: 비용 로그 API
status: done
priority: high
sprint: SPRINT-006
depends_on: []
branch: task/TASK-029-cost-log-api
worktree: ../repo-wt-TASK-029
role: general
reviewer_role: reviewer-general
---

# TASK-029: 비용 로그 API

## 목표

output/token-usage.log 파일을 파싱하여 태스크별 비용 데이터를 JSON으로 반환하는 API를 구현한다.

## 배경

현재 run-task.sh, run-review.sh에서 실행 결과를 token-usage.log에 기록하고 있다.
형식: `[날짜] TASK-ID | phase=task/review | input=N cache_create=N cache_read=N output=N | turns=N | duration=Nms | cost=$N`

이 데이터를 대시보드에서 조회할 수 있어야 한다.

## 완료 조건

- [ ] `GET /api/costs` 엔드포인트 구현
- [ ] output/token-usage.log 파일을 파싱하여 JSON 배열 반환
- [ ] 각 항목에 taskId, phase, inputTokens, outputTokens, cacheCreate, cacheRead, turns, durationMs, costUsd, timestamp 필드 포함
- [ ] 로그 파일이 없을 경우 빈 배열 반환 (에러 아님)
- [ ] 태스크별 합산 데이터도 반환 (같은 TASK-ID의 task + review 비용 합산)
