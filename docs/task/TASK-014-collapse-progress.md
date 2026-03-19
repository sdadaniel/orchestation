---
id: TASK-014
title: Sprint 접기/펼치기 + 진행률 바
sprint: SPRINT-002
status: done
priority: high
depends_on:
  - TASK-011
blocks:
  - TASK-016
parallel_with:
  - TASK-012
  - TASK-013
role: frontend-dev
branch: task/TASK-014-collapse-progress
worktree: ../repo-wt-TASK-014
reviewer_role: reviewer-general
affected_files:
  - src/frontend/components/waterfall/SprintProgress.tsx
---

## 목표

Sprint 그룹의 접기/펼치기 기능과 진행률 바를 구현한다.

## 무엇을

- `src/frontend/components/waterfall/SprintProgress.tsx` — 진행률 바 컴포넌트
- SprintHeader에 접기/펼치기 토글 연동

## 어떻게

- **shadcn/ui Collapsible** 컴포넌트 활용
- 진행률 바: shadcn/ui Progress 또는 Tailwind로 직접 구현
- 진행률 텍스트: "3/5 완료" 형태
- 접힌 상태에서는 Sprint 헤더 + 진행률만 표시
- 펼친 상태에서는 Task 바 목록까지 표시
- 기본 상태: 펼침

## 입출력

- 입력: `{ done: number; total: number }`, 접기/펼치기 상태
- 출력: 진행률 바 + 토글 UI

## 완료 조건

- 진행률이 정확히 표시됨 (done/total)
- 접기/펼치기가 정상 동작
- 접힌 상태에서 Task 바가 숨겨짐
