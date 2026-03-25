---
id: TASK-145
title: "Settings 페이지에 Base Branch 설정 기능 추가"
status: done
branch: task/task-145
worktree: ../repo-wt-task-145
priority: high
created: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/settings.ts
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/app/api/settings/route.ts
  - config.json
  - scripts/orchestrate.sh
  - scripts/run-pipeline.sh
  - scripts/run-worker.sh
  - scripts/cleanup-stuck.sh
  - scripts/lib/merge-resolver.sh
  - scripts/lib/context-builder.sh
---

## TASK-145: Settings 페이지에 Base Branch 설정 기능 추가

### 배경
현재 모든 태스크 완료 시 하드코딩된 `main` 브랜치로 머지하고 있다.
사용자가 원하는 base branch를 설정할 수 있어야 한다.

### 요구사항
1. `Settings` 인터페이스에 `baseBranch: string` 필드 추가 (기본값: "main")
2. Settings 페이지에 branch 입력 UI 추가
   - 텍스트 입력 + 현재 로컬 브랜치 목록 표시 (선택 가능)
3. 스크립트에서 하드코딩된 `main` 참조를 `config.json`의 `baseBranch`로 대체
   - `scripts/orchestrate.sh`: `main..$branch` → `$BASE_BRANCH..$branch`
   - `scripts/run-pipeline.sh`: 동일
   - `scripts/cleanup-stuck.sh`: 동일
   - `scripts/lib/context-builder.sh`: `git diff main` → `git diff $BASE_BRANCH`
   - `scripts/lib/merge-resolver.sh`: 머지 대상 브랜치
4. `orchestration-manager.ts`에서 settings 로드 시 `BASE_BRANCH` 환경변수로 스크립트에 전달
