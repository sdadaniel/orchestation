---
id: TASK-177
title: lib/constants 상대경로 import를 @/ alias로 통일
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/RightPanel.tsx
  - src/frontend/src/components/plan/PlanTreeContainer.tsx
  - src/frontend/src/app/sprint/page.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/sidebar.tsx
  - src/frontend/src/app/sprint/[id]/page.tsx
  - src/frontend/src/components/BatchEditor.tsx
  - src/frontend/src/components/waterfall/TaskBar.tsx
  - src/frontend/src/components/waterfall/TaskDetailPanel.tsx
  - src/frontend/src/components/TaskRow.tsx
  - src/frontend/src/components/ui/badge.tsx
---

## 현재 문제

`lib/constants` 모듈을 import하는 11개 파일이 `../../lib/constants`, `../../../lib/constants`, `../../../../lib/constants` 등 상대경로를 사용하고 있다.

코드베이스 전반에서 `@/lib/utils`, `@/hooks/useRequests`, `@/components/AppShell` 등 `@/` alias를 표준으로 사용하고 있으며, `tsconfig.json`에 `"@/*": ["./src/*"]` 설정이 되어 있다. `lib/constants`만 상대경로로 되어 있어 일관성이 깨져 있다.

## 수정 방법

각 파일에서 상대경로 import를 `@/lib/constants`로 교체한다.

예시:
```diff
- } from "../../lib/constants";
+ } from "@/lib/constants";
```

로직 변경 없음. import 경로만 교체.

## Completion Criteria

- [ ] 11개 파일의 `lib/constants` 상대경로 import가 모두 `@/lib/constants`로 교체됨
- [ ] 프로젝트 빌드(`npm run build`) 정상 통과
- [ ] 상대경로 `../lib/constants` 패턴이 코드베이스에 0건
