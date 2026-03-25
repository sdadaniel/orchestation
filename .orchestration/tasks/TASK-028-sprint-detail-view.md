---
id: TASK-028
title: Sprint 상세 뷰
status: done
priority: high
sprint: SPRINT-005
depends_on:
    - TASK-027
branch: task/TASK-028-sprint-detail-view
worktree: ../repo-wt-TASK-028
role: fe-developer
reviewer_role: reviewer-general
---

# TASK-028: Sprint 상세 뷰

## 목표

/sprint/[id] 페이지에서 Sprint에 포함된 Task를 배치별로 표시한다.

## 완료 조건

- [ ] `/sprint/[id]` 동적 라우트 구현
- [ ] Sprint 제목, 상태, 전체 진행률 헤더 표시
- [ ] Task를 배치(batch)별로 그룹화하여 표시 (배치 이름 + Task 목록)
- [ ] 각 Task에 상태 뱃지 (done/in_progress/ready 등) 표시
- [ ] Task 클릭 시 Task 워터폴 뷰(/) 로 이동하거나 사이드 패널 표시
- [ ] 존재하지 않는 Sprint ID 접근 시 404 또는 안내 메시지
