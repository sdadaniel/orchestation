---
id: TASK-032
title: 오케스트레이션 실행 API
status: in_progress
priority: high
sprint: SPRINT-007
depends_on: []
branch: task/TASK-032-orchestrate-api
worktree: ../repo-wt-TASK-032
role: general
reviewer_role: reviewer-general
---

# TASK-032: 오케스트레이션 실행 API

## 목표

웹 UI에서 orchestrate.sh를 트리거하고, 실행 상태를 실시간으로 조회할 수 있는 API를 구현한다.

## 완료 조건

- [ ] `POST /api/orchestrate/run` — orchestrate.sh를 백그라운드로 실행
- [ ] `GET /api/orchestrate/status` — 현재 실행 상태 반환 (idle / running / completed / failed)
- [ ] `GET /api/orchestrate/logs` — 실행 로그를 스트리밍 (SSE 또는 polling)
- [ ] `POST /api/orchestrate/stop` — 실행 중인 오케스트레이션 중지
- [ ] 동시 실행 방지 (이미 실행 중이면 409 반환)
- [ ] 실행 시작/종료 시각 기록
- [ ] 실행 결과 (성공/실패 Task 목록) 반환
- [ ] 포트 번호는 환경변수(PORT)로 받아야 한다
