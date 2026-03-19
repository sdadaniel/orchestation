---
id: TASK-009
title: Sprint frontmatter 파싱 API Route 구현
sprint: SPRINT-002
status: done
priority: critical
depends_on: []
blocks:
  - TASK-012
  - TASK-016
parallel_with:
  - TASK-010
  - TASK-011
role: frontend-dev
branch: task/TASK-009-sprint-parser-api
worktree: ../repo-wt-TASK-009
reviewer_role: reviewer-general
affected_files:
  - src/frontend/app/api/sprints/
  - src/frontend/lib/
---

## 목표

`docs/sprint/*.md` 파일의 YAML frontmatter 및 본문을 파싱하여 JSON으로 반환하는 API Route를 구현한다.

## 무엇을

- `src/frontend/app/api/sprints/route.ts` — Sprint 목록 API
- `src/frontend/lib/sprint-parser.ts` — Sprint 파싱 유틸

## 어떻게

- **파싱 라이브러리**: gray-matter (TASK-008과 동일)
- `fs.readdir`로 `docs/sprint/` 디렉토리 스캔
- 본문에서 포함 Task ID 목록 추출
- Sprint 메타 정보 + 포함 Task ID를 JSON으로 반환

## 입출력

- 입력: `GET /api/sprints`
- 출력:
```json
[
  {
    "id": "SPRINT-001",
    "title": "프로젝트 셋업 + 데이터 파싱",
    "tasks": ["TASK-007", "TASK-008"]
  }
]
```

## 완료 조건

- `GET /api/sprints` 호출 시 `docs/sprint/` 내 모든 Sprint 정보가 JSON으로 반환됨
- 각 Sprint에 포함된 Task ID 목록이 정확히 파싱됨
