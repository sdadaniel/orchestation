---
id: TASK-134
title: Playwright E2E 테스트 세팅 및 핵심 시나리오 작성
status: done
branch: task/task-134
worktree: ../repo-wt-task-134
priority: high
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/playwright.config.ts
  - src/frontend/e2e/**
  - src/frontend/package.json
---

## 목표
Playwright를 설치하고 프론트엔드 핵심 플로우를 E2E 테스트로 검증한다.

## 구현

### 1. 세팅
- `npm init playwright@latest` 또는 수동 설치
- `playwright.config.ts` 설정 (baseURL: localhost:3000, webServer 연동)
- CI에서도 돌릴 수 있도록 headless 기본

### 2. 핵심 시나리오

#### 태스크 목록 (`/tasks`)
- 탭 클릭 시 active 스타일 변경 확인
- Priority 필터 클릭 시 active 상태 + 필터링 동작
- 빈 탭 진입 시 "해당 상태의 태스크가 없습니다" 표시
- 의존 체인 아코디언 펼침/접힘

#### 태스크 상세 (`/tasks/[id]`)
- 상태 드롭다운으로 상태 변경 → UI 반영
- 실행 버튼 클릭 → 로그 탭 전환 + 실시간 로그 표시
- Stop 버튼 → 실행 중지
- done 상태에서 실행 버튼 비활성화

#### 그래프 탭 (`/tasks?tab=stack`)
- DAG 노드 렌더링 확인
- 의존 화살표 존재 확인

#### Notice (`/notices`)
- Notice 목록 표시
- 필터 탭 active 상태

#### AutoImproveControl
- idle → Run 버튼 표시
- running → Stop 버튼 표시
- stopping → "Stopping..." 표시

## Completion Criteria
- Playwright 설치 + config 완료
- 위 시나리오 테스트 파일 작성
- `npx playwright test` 통과
