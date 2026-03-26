---
id: TASK-202
title: 엔티티 프론트매터 템플릿 중앙화 — 5종 통합 관리
status: done
branch: task/task-202
worktree: ../repo-wt-task-202
priority: high
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - .orchestration/templates/
  - scripts/night-worker.sh
  - scripts/auto-improve.sh
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/app/api/notices/route.ts
  - src/frontend/src/app/api/sprints/route.ts
  - src/frontend/src/lib/doc-tree.ts
---

## 목표
TASK, REQUEST, NOTICE, SPRINT, PRD 5종의 프론트매터 템플릿을 `.orchestration/templates/`에 공통 관리하고, 각 생성자가 이를 참조하도록 변경한다.

## 현재 문제
- 같은 엔티티의 템플릿이 여러 파일에 하드코딩되어 있어 필드가 조금씩 다름
- 필드 추가/변경 시 모든 생성자를 찾아서 수동 수정해야 함
- night-worker의 TASK 템플릿은 `mode,created,updated`가 있지만 API는 `sprint,role`이 있는 등 불일치

## 변경 사항

### 1. `.orchestration/templates/` 디렉토리에 템플릿 파일 생성
- `task.md` — TASK 프론트매터 기본 구조
- `request.md` — REQUEST 프론트매터 기본 구조
- `notice.md` — NOTICE 프론트매터 기본 구조
- `sprint.md` — SPRINT 프론트매터 기본 구조
- `prd.md` — PRD 프론트매터 기본 구조

각 템플릿은 모든 가능한 필드를 포함하되, 선택 필드는 주석이나 빈 값으로 표시.
변수는 `{{id}}`, `{{title}}`, `{{today}}` 등 mustache 스타일 플레이스홀더 사용.

### 2. 쉘 스크립트용 유틸 함수 추가 (`scripts/lib/template.sh`)
- `render_template(template_file, key=value ...)` — 템플릿 파일을 읽어 플레이스홀더를 치환하여 출력
- night-worker.sh, auto-improve.sh에서 이 함수를 사용하도록 변경

### 3. TypeScript용 유틸 함수 추가
- `src/frontend/src/lib/template.ts` — 템플릿 파일을 읽어 플레이스홀더를 치환하는 함수
- tasks/route.ts, requests/route.ts, notices/route.ts, sprints/route.ts, doc-tree.ts에서 이 함수를 사용하도록 변경

### 4. 각 생성자의 하드코딩된 템플릿을 제거하고 공통 템플릿 참조로 교체

## 현재 템플릿 위치 (제거/교체 대상)
| 엔티티 | 파일 | 라인 |
|---|---|---|
| TASK | scripts/night-worker.sh | 159-190 (프롬프트), 271-284 (heredoc) |
| TASK | src/frontend/src/app/api/tasks/route.ts | 65-84 |
| REQUEST | src/frontend/src/app/api/requests/route.ts | 44-53 |
| REQUEST | scripts/auto-improve.sh | 165-174 (enrichment) |
| NOTICE | src/frontend/src/app/api/notices/route.ts | 49-58 |
| SPRINT | src/frontend/src/app/api/sprints/route.ts | 56-69 |
| PRD | src/frontend/src/lib/doc-tree.ts | 277-278 |

## Completion Criteria
- `.orchestration/templates/`에 5종 템플릿 파일 존재
- 쉘/TS 유틸 함수가 템플릿을 읽어 렌더링
- 기존 7개 생성자가 모두 공통 템플릿을 참조
- 하드코딩된 템플릿이 제거됨
- 기존과 동일한 파일이 생성되는지 검증 (기능 변화 없음)
