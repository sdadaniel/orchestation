---
id: TASK-019
title: 사이드바 라우트 기반 네비게이션 전환 + Terminal 탭 추가
sprint: SPRINT-003
status: done
priority: high
depends_on: []
blocks: []
parallel_with:
  - TASK-017
role: frontend-dev
branch: task/TASK-019-sidebar-routing
worktree: ../repo-wt-TASK-019
reviewer_role: reviewer-general
affected_files:
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/app/layout.tsx
  - src/frontend/src/app/page.tsx
---

## 목표

사이드바를 라우트 기반 네비게이션으로 전환하고, Terminal 탭을 추가한다.

## 무엇을

- `src/frontend/src/components/sidebar.tsx` — 라우트 기반 네비게이션으로 리팩터링 (MODIFY)
- `src/frontend/src/app/layout.tsx` — 필요 시 조정 (MODIFY)
- `src/frontend/src/app/page.tsx` — 필요 시 조정 (MODIFY)

## 어떻게

- **sidebar.tsx 리팩터링**:
  1. 정적 `navItems` 배열에 `href` 필드 추가
  2. `usePathname()` 으로 현재 경로 감지 → `active` 상태 동적 결정
  3. `Button` → Next.js `Link` 기반으로 전환
  4. 기존 탭: Task (`/`), Sprint (disabled), Plan (disabled)
  5. 새 탭 추가: Terminal (`/terminal`), `TerminalSquare` 아이콘
- **layout.tsx**: Sidebar가 클라이언트 컴포넌트가 되므로 필요 시 조정
- **page.tsx**: 기존 동작 유지 확인

## 입출력

- 입력: URL 경로
- 출력: 활성 탭이 현재 경로와 동기화된 사이드바

## 완료 조건

- Task 탭 클릭 시 `/` 로 이동, 워터폴 대시보드 표시
- Terminal 탭 클릭 시 `/terminal` 로 이동
- 현재 경로에 맞는 탭이 활성 스타일로 표시됨
- 직접 URL 입력으로 접근해도 사이드바 활성 상태가 올바름
- Sprint, Plan 탭은 여전히 disabled 상태
