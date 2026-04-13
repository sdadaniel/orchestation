---
id: TASK-362
title: Prettier 포맷팅 위반 수정
status: pending
priority: medium
role: general
depends_on: []
scope: 
  - src/frontend/src
created: 2026-04-10 16:05:22
updated: 2026-04-10 16:05:22
---
Prettier 포맷팅 검사에서 152개 파일이 위반사항을 가지고 있습니다. 주요 문제: trailing comma 누락, 멀티라인 포맷팅 불일치 등.

## Completion Criteria
- `npm run format` 실행으로 모든 포맷팅 위반 수정
- `npm run format:check` 통과 (0개 파일 위반)
