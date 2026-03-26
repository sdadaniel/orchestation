---
id: TASK-165
title: task-log-parser JSON.parse any 타입 제거
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/lib/task-log-parser.ts
---

`src/frontend/src/lib/task-log-parser.ts`에서 `JSON.parse()` 반환값이 `any`로 추론되어 이후 속성 접근 시 타입 안전성이 없는 문제.

### 현황

- **Line 109**: `const entry = JSON.parse(trimmed)` → `any` 타입. 이후 `.timestamp`, `.created_at`, `.role`, `.content` 속성에 타입 검사 없이 접근
- **Line 147**: `const data = JSON.parse(content)` → `any` 타입. 이후 `.timestamp`, `.created_at`, `.result`, `.is_error`, `.num_turns`, `.cost_usd` 속성에 타입 검사 없이 접근

총 10개 이상의 `any` 타입 속성 접근이 발생하며, 이로 인해 오타나 존재하지 않는 속성 접근을 컴파일 타임에 감지할 수 없음.

### 수정 방향

1. `ConversationLogEntry` 인터페이스 정의 (timestamp?, created_at?, role?, content?)
2. `TaskResultData` 인터페이스 정의 (timestamp?, created_at?, result?, is_error?, num_turns?, cost_usd?)
3. Line 109의 `JSON.parse` 결과에 `as unknown`을 거쳐 타입 가드 적용 또는 인터페이스 단언
4. Line 147의 `JSON.parse` 결과에 동일하게 적용
5. 기존 런타임 동작은 변경하지 않음

## Completion Criteria
- `ConversationLogEntry`, `TaskResultData` 인터페이스가 파일 내 정의되어 있을 것
- `JSON.parse` 반환값에 명시적 타입이 지정되어 `any` 전파가 없을 것
- `npx tsc --noEmit --strict` 실행 시 해당 파일에서 새 오류가 발생하지 않을 것
- 기존 동작에 변경 없음 (로직 수정 금지)
