---
id: TASK-030
title: 비용 모니터링 페이지
status: in_progress
priority: high
sprint: SPRINT-006
depends_on:
    - TASK-029
branch: task/TASK-030-cost-dashboard
worktree: ../repo-wt-TASK-030
role: general
reviewer_role: reviewer-general
---

# TASK-030: 비용 모니터링 페이지

## 목표

/cost 페이지에서 오케스트레이션 실행 비용을 시각적으로 확인할 수 있게 한다.

## 완료 조건

- [ ] `/cost` 라우트 구현
- [ ] 사이드바에 "Cost" 탭 추가 (DollarSign 아이콘)
- [ ] 상단 요약 카드: 총 비용, 총 태스크 수, 평균 비용/태스크, 총 토큰 수
- [ ] 태스크별 비용 테이블: taskId, phase(task/review), 비용, 시간, 턴 수, 토큰 수
- [ ] 비용 높은 순으로 정렬, 가장 비싼 태스크 하이라이트
- [ ] 데이터 없을 시 "실행 기록이 없습니다" 안내 메시지
- [ ] `/api/costs` 에서 데이터 fetch
