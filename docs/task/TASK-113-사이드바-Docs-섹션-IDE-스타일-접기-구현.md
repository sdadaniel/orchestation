---
id: TASK-113
title: 사이드바 Docs 섹션 IDE 스타일 접기/펼치기 구현
status: in_progress
branch: task/task-113
worktree: ../repo-wt-task-113
priority: medium
sort_order: 8
sprint:
depends_on: []
role: general
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/globals.css
---

# TASK-113: 사이드바 Docs 섹션 IDE 스타일 접기/펼치기 구현

## 배경

사이드바에서 Docs 항목이 많아지면 하위 콘텐츠가 너무 길어져 다른 섹션들이 밀려 내려가는 문제가 있다.

## 목표

IDE(VSCode 등)의 탐색기처럼 Docs 섹션을 트리 구조로 접기/펼치기(collapse/expand) 가능하게 변경하여, 필요한 항목만 펼쳐볼 수 있도록 한다.

## 완료 조건

- [ ] Docs 섹션에 접기/펼치기 토글 적용 (클릭 시 하위 항목 숨김/표시)
- [ ] 기본 상태는 접힌 상태(collapsed)
- [ ] 펼침/접힘 시 부드러운 애니메이션 적용
- [ ] 다른 사이드바 섹션(Tasks 등)이 밀리지 않도록 레이아웃 유지
