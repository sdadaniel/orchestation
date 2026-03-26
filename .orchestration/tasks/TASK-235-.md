---
id: TASK-235
title: frontmatter 파싱 로직 중복 제거 — 공통 유틸리티 추출
status: failed
branch: task/task-235
worktree: ../repo-wt-task-235
priority: medium
mode: night
created: 2026-03-26
updated: 2026-03-26
depends_on: []
scope:
  - src/frontend/src/lib/notice-parser.ts
  - src/frontend/src/lib/request-parser.ts
  - src/frontend/src/lib/prd-parser.ts
  - src/frontend/src/lib/parser.ts
---
notice-parser.ts, request-parser.ts, prd-parser.ts 세 파일이 동일한 regex 기반 frontmatter 파싱 패턴을 반복하고 있음. 반면 parser.ts는 gray-matter 라이브러리를 사용 중. 수동 regex 파싱을 gray-matter 기반 공통 유틸리티 함수로 통합하여 중복을 제거해야 함.

중복 패턴:
- `raw.match(/^---\n([\s\S]*?)\n---/)` — 3개 파일에서 동일
- `fm.match(/^id:\s*(.+)$/m)?.[1]?.trim()` — 3개 파일에서 동일
- `fm.match(/^title:\s*(.+)$/m)?.[1]?.trim()` — 3개 파일에서 동일

## Completion Criteria
- 공통 frontmatter 파싱 유틸리티 함수 추출 (gray-matter 활용)
- notice-parser.ts, request-parser.ts, prd-parser.ts가 공통 유틸리티를 사용하도록 리팩터링
- 기존 동작(반환 타입, 기본값)이 변경되지 않음을 확인
- 로직 변경 없이 중복 코드만 제거
