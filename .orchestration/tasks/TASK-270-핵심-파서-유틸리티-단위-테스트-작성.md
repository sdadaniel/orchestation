---
id: TASK-270
title: 핵심 파서 유틸리티 단위 테스트 작성
status: done
branch: task/task-270
worktree: ../repo-wt-task-270
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/lib/parser.ts
  - src/frontend/src/lib/frontmatter-utils.ts
  - src/frontend/src/lib/task-log-parser.ts
  - src/frontend/src/lib/cost-parser.ts
  - src/frontend/src/lib/notice-parser.ts
---
Vitest 설정은 존재하나 단위 테스트가 0건. 순수 함수 중심의 파서 유틸리티 5개 파일에 대해 단위 테스트를 작성한다.

대상 모듈:
- `parser.ts` — 태스크 마크다운 파싱
- `frontmatter-utils.ts` — frontmatter 읽기/쓰기
- `task-log-parser.ts` — 태스크 로그 파싱
- `cost-parser.ts` — 비용 데이터 파싱
- `notice-parser.ts` — 공지 파싱

## Completion Criteria
- 각 파서 모듈별 `.test.ts` 파일 생성 (5개)
- 정상 입력, 빈 입력, 잘못된 형식 케이스 포함
- `npx vitest run` 전체 통과
