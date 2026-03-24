---
id: TASK-112
title: 토스트 메시지 표시 시 화면 깜박임 버그 수정
status: in_progress
branch: task/task-112
worktree: ../repo-wt-task-112
priority: medium
sort_order: 7
sprint:
depends_on: []
role: general
scope:
  - src/frontend/src/components/ui/toast.tsx
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/app/globals.css
  - src/frontend/src/app/layout.tsx
---

# TASK-112: 토스트 메시지 표시 시 화면 깜박임 버그 수정

## 배경

작업 완료 후 토스트 메시지가 표시될 때마다 화면 전체가 깜박이는 현상이 발생한다.

## 목표

토스트 메시지가 나타나거나 사라질 때 화면 깜박임 없이 부드럽게 동작하도록 수정한다.

## 완료 조건

- [ ] 토스트 메시지 표시/소멸 시 화면 깜박임 현상 제거
- [ ] 기존 토스트 메시지 기능(표시, 자동 소멸 등) 정상 동작 확인
