---
id: TASK-152
title: e2e tasks-list 순환참조 타입 오류 수정
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/e2e/tasks-list.spec.ts
---

`e2e/tasks-list.spec.ts` 9행의 `main` 헬퍼 함수에서 `page` 변수를 자기 자신의 타입 주석 내에서 참조하여 TS2502 순환참조 오류가 발생한다.

```
const main = (page: Parameters<typeof page.locator>[0] extends never ? never : any) =>
```

해당 `main` 함수는 파일 내 어디에서도 호출되지 않는 dead code이므로, 주석과 함께 삭제하면 된다.

## Completion Criteria
- `npx tsc --noEmit --strict` 실행 시 TS2502 오류가 0건일 것
- 기존 테스트 로직에 영향 없음 (미사용 코드 삭제만)
