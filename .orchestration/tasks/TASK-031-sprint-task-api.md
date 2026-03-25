---
id: TASK-031
title: Sprint/Task 생성 API
status: done
priority: high
sprint: SPRINT-007
depends_on: []
branch: task/TASK-031-sprint-task-api
worktree: ../repo-wt-TASK-031
role: general
reviewer_role: reviewer-general
---

# TASK-031: Sprint/Task 생성 API

## 목표

웹 UI에서 Sprint와 Task 문서를 생성/수정/삭제할 수 있는 REST API를 구현한다.

## 완료 조건

- [ ] `POST /api/sprints` — 새 Sprint 파일 생성 (docs/sprint/SPRINT-XXX.md)
- [ ] `PUT /api/sprints/[id]` — Sprint 수정 (목표, 배치 구조, 상태)
- [ ] `POST /api/tasks` — 새 Task 파일 생성 (docs/task/TASK-XXX-*.md)
- [ ] `PUT /api/tasks/[id]` — Task 수정 (title, status, priority, depends_on, role 등)
- [ ] `DELETE /api/tasks/[id]` — Task 삭제
- [ ] Task 생성 시 자동으로 다음 TASK-XXX 번호 부여
- [ ] Sprint 생성 시 자동으로 다음 SPRINT-XXX 번호 부여
- [ ] frontmatter 형식 유지 (기존 파서와 호환)
- [ ] 포트 번호는 환경변수(PORT)로 받아야 한다
