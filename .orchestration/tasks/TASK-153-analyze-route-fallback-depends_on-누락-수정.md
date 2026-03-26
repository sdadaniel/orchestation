---
id: TASK-153
title: analyze/route.ts fallback 객체 depends_on 필드 누락 수정
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/analyze/route.ts
---

`POST /api/tasks/analyze`의 AI 응답 파싱 실패 시 생성되는 fallback 태스크 객체(line 155~162)에 `depends_on` 필드가 빠져 있다.

`AnalyzedTask` 인터페이스(line 9~16)는 `depends_on: number[]`를 필수 필드로 정의하고 있으므로, fallback 객체에 `depends_on: []`를 추가하여 인터페이스와 일치시켜야 한다.

## Completion Criteria
- fallback 태스크 객체에 `depends_on: []` 필드가 추가되어 `AnalyzedTask` 인터페이스를 완전히 충족
- TypeScript 컴파일 오류 없음
