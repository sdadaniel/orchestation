---
id: TASK-008
title: Task frontmatter 파싱 API Route 구현
sprint: SPRINT-001
status: done
priority: critical
depends_on:
  - TASK-007
blocks:
  - TASK-009
role: frontend-dev
branch: task/TASK-008-task-parser-api
worktree: ../repo-wt-TASK-008
reviewer_role: reviewer-general
affected_files:
  - src/frontend/app/api/
  - src/frontend/lib/
---

## 목표

`docs/task/*.md` 파일의 YAML frontmatter를 파싱하여 JSON으로 반환하는 API Route를 구현한다.

## 무엇을

- `src/frontend/app/api/tasks/route.ts` — Task 목록 API
- `src/frontend/lib/parser.ts` — frontmatter 파싱 유틸

## 어떻게

- **파싱 라이브러리**: gray-matter (YAML frontmatter 파싱에 가장 널리 쓰임)
- `fs.readdir`로 `docs/task/` 디렉토리 스캔
- gray-matter로 각 파일의 frontmatter 파싱
- 관계 필드(`depends_on`, `blocks`, `parallel_with`)를 포함한 JSON 배열 반환
- React Flow 노드/엣지 구조로 변환 가능한 형태로 설계

## 입출력

- 입력: `GET /api/tasks`
- 출력:
```json
[
  {
    "id": "TASK-001",
    "title": "인사말 파일 생성",
    "status": "done",
    "priority": "high",
    "depends_on": [],
    "blocks": ["TASK-002"],
    "parallel_with": [],
    "role": "general",
    "affected_files": ["output/hello.txt"]
  }
]
```

## 완료 조건

- `GET /api/tasks` 호출 시 `docs/task/` 내 모든 Task의 frontmatter가 JSON으로 반환됨
- 파일 추가/수정 후 재요청 시 반영됨
- frontmatter가 없거나 잘못된 파일은 에러 없이 스킵
