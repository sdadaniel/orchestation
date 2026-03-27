---
id: TASK-268
title: 미사용 변수 및 중복 import 정리
status: pending
priority: medium
mode: night
created: 2026-03-27
updated: 2026-03-27
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
  - src/frontend/src/components/GlobalSearch.tsx
---
프론트엔드 코드에서 발견된 미사용 변수 및 중복 import를 정리한다.

1. **AppShell.tsx**: React import가 line 3과 line 21에 분리되어 있음. `useState`를 line 3의 import에 병합하고 line 21 제거.
2. **GlobalSearch.tsx (line 236-237)**: `iidx` 변수가 선언 후 `void iidx`로 suppress만 하고 사용되지 않음. `globalIdx++`는 유지하되 불필요한 변수 할당과 void 문 제거.

## Completion Criteria
- AppShell.tsx의 React import가 단일 문으로 병합됨
- GlobalSearch.tsx의 미사용 `iidx` 변수 및 `void iidx` 문이 제거됨
- 빌드(`npm run build`) 정상 통과
