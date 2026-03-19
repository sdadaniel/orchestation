---
id: TASK-007
title: Next.js 프로젝트 초기화 + 대시보드 레이아웃
sprint: SPRINT-001
status: done
priority: critical
depends_on: []
blocks:
  - TASK-008
role: frontend-dev
branch: task/TASK-007-nextjs-setup
worktree: ../repo-wt-TASK-007
reviewer_role: reviewer-general
affected_files:
  - src/frontend/
---

## 목표

Next.js 프로젝트를 초기화하고 대시보드 레이아웃을 구성한다.

## 무엇을

- `src/frontend/`에 Next.js 프로젝트 생성
- 대시보드 레이아웃 컴포넌트 (사이드바 + 메인 영역)
- 사이드바에 네비게이션 탭: Task (활성) / Sprint (비활성, 향후) / Plan (비활성, 향후)
- Task 탭 클릭 시 메인 영역에 빈 페이지 렌더링

## 어떻게

- **Next.js 15** (App Router)
- **TypeScript**
- **패키지 매니저**: yarn
- **UI**: shadcn/ui
- **스타일링**: Tailwind CSS
- 레이아웃: `src/frontend/app/layout.tsx`에 사이드바 포함
- 페이지: `src/frontend/app/page.tsx` (Task 뷰 — 빈 상태)

## 입출력

- 입력: 없음
- 출력: `yarn dev` 실행 시 사이드바 + 빈 메인 영역이 표시되는 대시보드

## 완료 조건

- `src/frontend/`에서 `yarn dev` 실행 시 정상 구동
- 사이드바에 Task / Sprint / Plan 탭이 보임
- Task 탭만 활성, 나머지는 비활성(회색) 상태
- shadcn 컴포넌트가 정상 임포트됨
