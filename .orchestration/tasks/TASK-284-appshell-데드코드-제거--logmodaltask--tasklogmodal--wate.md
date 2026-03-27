---
id: TASK-284
title: AppShell 데드코드 제거 (logModalTask, TaskLogModal, WaterfallTask)
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:  []
---

TASK-284는 이미 reserved 파일이 있으므로 TASK-285를 사용하겠습니다.

---
id: TASK-285
title: AppShell 데드코드 제거 (logModalTask, TaskLogModal, WaterfallTask)
status: pending
priority: medium
mode: night
created: 2026-03-28
updated: 2026-03-28
depends_on: []
scope:
  - src/frontend/src/components/AppShell.tsx
---
`AppShell.tsx`에서 사용되지 않는 코드를 제거한다.

- `logModalTask` state는 `setLogModalTask(null)`로만 호출되어 항상 `null`이므로 데드코드
- `logModalTask && <TaskLogModal ...>` 블록은 절대 렌더링되지 않음
- `TaskLogModal` import (line 11)과 `WaterfallTask` type import (line 18)도 함께 제거

## Completion Criteria
- `useState<WaterfallTask | null>(null)` 및 `setLogModalTask` 제거
- `import { TaskLogModal }` 제거
- `import type { WaterfallTask }` 제거 (다른 곳에서 미사용 확인 후)
- `logModalTask &&` JSX 블록 제거
- 빌드(`npm run build`) 성공 확인

## Completion Criteria


