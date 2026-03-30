---
id: TASK-290
title: cost-parser.ts 중복 PROJECT_ROOT 선언을 공용 paths 모듈로 교체
status: in_progress
branch: task/task-290
worktree: ../repo-wt-task-290
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/lib/cost-parser.ts
---

## 분석 보고서

`src/frontend/src/lib/cost-parser.ts:45`에서 `PROJECT_ROOT`를 자체 선언하고 있다:

```typescript
const PROJECT_ROOT = path.join(process.cwd(), "../..");
```

프로젝트에는 이미 `src/frontend/src/lib/paths.ts`에 공용 `PROJECT_ROOT`가 존재한다:

```typescript
export const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");
```

### 문제점
1. **중복 선언**: 동일한 값을 두 곳에서 계산
2. **미세한 불일치**: `path.join`과 `path.resolve`는 상대 경로 처리 시 동작이 다를 수 있음
3. **유지보수 리스크**: 프로젝트 루트 경로 계산 방식 변경 시 cost-parser만 누락될 수 있음

### 권장 수정
- `cost-parser.ts`에서 로컬 `PROJECT_ROOT` 선언을 제거
- `import { PROJECT_ROOT } from "./paths"` 로 교체
- `import path from "path"` 에서 `path`가 더 이상 `PROJECT_ROOT` 계산에 불필요하지만, `LOG_FILE` 조합에 여전히 사용되므로 import 유지

## Completion Criteria
- cost-parser.ts의 로컬 PROJECT_ROOT 선언이 제거되고 @/lib/paths에서 import하도록 변경
- 기존 동작(parseCostLog)에 영향 없음 확인
