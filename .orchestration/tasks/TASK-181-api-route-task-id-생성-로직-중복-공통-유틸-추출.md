---
id: TASK-181
title: api route task-id 생성 로직 중복 공통 유틸 추출
status: done
branch: task/task-181
worktree: ../repo-wt-task-181
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/tasks/route.ts
  - src/frontend/src/app/api/requests/route.ts
  - src/frontend/src/lib/task-id.ts
---

## 문제

`api/tasks/route.ts` (37-51행)와 `api/requests/route.ts` (29-44행)에 동일한 TASK-XXX ID 생성 로직이 복사-붙여넣기로 존재한다.

```typescript
// 두 파일에서 완전히 동일한 코드
const existingFiles = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("TASK-") && f.endsWith(".md"));

let maxNum = 0;
for (const f of existingFiles) {
  const m = f.match(/TASK-(\d+)/);
  if (m) {
    const num = parseInt(m[1], 10);
    if (num > maxNum) maxNum = num;
  }
}

const nextNum = maxNum + 1;
const taskId = `TASK-${String(nextNum).padStart(3, "0")}`;
```

## 해결 방안

`src/frontend/src/lib/task-id.ts`에 공통 유틸 함수 `generateNextTaskId(dir: string): string`를 만들고, 두 route에서 import하여 사용한다.

## Completion Criteria

- [ ] `generateNextTaskId(dir: string)` 유틸 함수가 `lib/task-id.ts`에 존재
- [ ] `api/tasks/route.ts`와 `api/requests/route.ts` 모두 해당 유틸을 import하여 사용
- [ ] 중복 코드 제거 완료
- [ ] 기존 동작(ID 자동 증가) 변경 없음
