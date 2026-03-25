---
id: TASK-137
title: 태스크 생성 시 의존 관계 설정 UI 추가
status: in_progress
branch: task/task-137
worktree: ../repo-wt-task-137
priority: medium
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/tasks/new/page.tsx
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
---

## 목표
`/tasks/new` 페이지에서 태스크 생성 시 기존 태스크를 선택하여 depends_on을 설정할 수 있도록 UI 추가. 생성 API에서도 depends_on을 frontmatter에 반영.

## 현재 문제
- `/tasks/new`에 의존 관계 입력 필드가 없음
- `POST /api/requests`의 frontmatter 템플릿에 depends_on이 빠져있음
- 수동 생성 태스크는 항상 `depends_on: []`로 생성됨

## 구현

### 1. `/tasks/new` UI
- 기존 태스크 목록을 드롭다운/검색으로 선택
- 복수 선택 가능 (multi-select)
- 선택된 태스크는 칩(tag) 형태로 표시, X로 제거
- AI 분석 시 자동 의존 관계도 표시 + 수동 수정 가능

### 2. `POST /api/requests` 수정
- body에서 `depends_on: string[]` 수신
- frontmatter 템플릿에 depends_on 필드 추가

### 3. AI 분석 (`/api/tasks/analyze`)
- 분석 결과에 depends_on 인덱스 포함 (현재 구현됨)
- 프리뷰에서 의존 관계 시각적 표시

## Completion Criteria
- 단일 태스크 생성 시 depends_on 설정 가능
- AI 분석 다중 태스크 생성 시 의존 관계 자동 + 수동 편집 가능
- 생성된 태스크 frontmatter에 depends_on 정상 반영
- 그래프 탭에서 화살표 표시 확인
