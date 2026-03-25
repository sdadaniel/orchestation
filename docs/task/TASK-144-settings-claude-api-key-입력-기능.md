---
id: TASK-144
title: "Settings 페이지에 Claude API Key 입력 기능 추가"
status: done
branch: task/task-144
worktree: ../repo-wt-task-144
priority: high
created: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/settings.ts
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/app/api/settings/route.ts
  - config.json
---

## TASK-144: Settings 페이지에 Claude API Key 입력 기능 추가

### 배경
현재 Settings 페이지에는 maxParallel, workerMode만 설정 가능하다.
Claude API Key를 UI에서 입력/관리할 수 있어야 한다.

### 요구사항
1. `Settings` 인터페이스에 `claudeApiKey: string` 필드 추가
2. `config.json`에 저장/로드 로직 추가
3. Settings 페이지에 API Key 입력 UI 추가
   - 비밀번호 형태(마스킹) 입력 필드
   - 저장 후에는 앞 4자리만 표시 (sk-an...xxxx 형태)
4. API Key가 설정되면 orchestration 실행 시 `ANTHROPIC_API_KEY` 환경변수로 전달
