---
id: TASK-034
title: 오케스트레이션 실행 UI
status: done
priority: high
sprint: SPRINT-007
depends_on:
    - TASK-032
branch: task/TASK-034-orchestrate-ui
worktree: ../repo-wt-TASK-034
role: general
reviewer_role: reviewer-general
---

# TASK-034: 오케스트레이션 실행 UI

## 목표

웹 대시보드에서 오케스트레이션을 실행하고, 실시간으로 진행 상황을 모니터링할 수 있는 UI를 구현한다.

## 완료 조건

- [ ] "Run" 버튼: 홈 대시보드 또는 Sprint 상세에 배치
- [ ] 실행 전 확인 다이얼로그 (실행할 Sprint/Task 목록 표시)
- [ ] 실행 중 상태 표시: 진행률 바, 현재 실행 중인 Task 하이라이트
- [ ] 실시간 로그 패널: SSE 또는 polling으로 orchestrate 로그 스트리밍
- [ ] Task별 완료/실패 상태 실시간 업데이트
- [ ] 실행 중 "Stop" 버튼
- [ ] 실행 완료 시 결과 요약 (성공/실패 Task 수, 총 비용, 소요 시간)
- [ ] 실행 중에는 다른 실행 차단 (버튼 비활성화 + 안내)
