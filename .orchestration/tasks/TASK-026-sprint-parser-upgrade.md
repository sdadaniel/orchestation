---
id: TASK-026
title: Sprint 파서 개선
status: done
priority: high
sprint: SPRINT-005
depends_on: []
branch: task/TASK-026-sprint-parser-upgrade
worktree: ../repo-wt-TASK-026
role: fe-developer
reviewer_role: reviewer-general
---

# TASK-026: Sprint 파서 개선

## 목표

sprint-parser.ts를 개선하여 archive 디렉토리 지원, status 파싱, Task 배치 구조 파싱을 추가한다.

## 현재 상태

- `src/frontend/src/lib/sprint-parser.ts` 존재
- `docs/sprint/` 직접 파일만 읽음 (archive/ 미지원)
- `SprintData` 타입에 status 필드 없음
- 배치(batch) 구조 파싱 없음

## 완료 조건

- [ ] `parseAllSprints()`가 `docs/sprint/` + `docs/sprint/archive/` 모두 읽음
- [ ] `SprintData`에 `status` 필드 추가 (frontmatter에서 파싱)
- [ ] `SprintData`에 `batches` 필드 추가 — `{ name: string, tasks: string[] }[]` 구조로 배치별 Task ID 파싱
- [ ] 기존 `tasks: string[]` 필드는 전체 Task 목록 (하위호환 유지)
- [ ] `/api/sprints` 응답에 새 필드가 포함됨
