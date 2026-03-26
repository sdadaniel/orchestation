---
id: TASK-166
title: store/index.ts 데드 모듈 및 zustand 미사용 의존성 제거
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/store/index.ts
  - src/frontend/package.json
---

`src/frontend/src/store/index.ts`에 정의된 `useAppStore` (Zustand 스토어)가 프로젝트 전체에서 단 한 곳도 import되지 않는 데드 모듈이다.

TASK-133(Zustand 설치)과 TASK-135(전역 상태 마이그레이션)가 완료 상태이나, 실제로 어떤 컴포넌트·훅에서도 `useAppStore`를 사용하지 않으며 `from "store"` 또는 `from "@/store"` import가 0건이다.

### 조치 사항
1. `src/frontend/src/store/index.ts` 파일 삭제
2. `src/frontend/src/store/` 디렉토리 삭제
3. `zustand` 패키지가 다른 곳에서도 미사용이면 `package.json`에서 `zustand` 의존성 제거 (`npm uninstall zustand`)

### 근거
- `grep -r "useAppStore\|from.*store" src/frontend/src/` → `store/index.ts` 자체 정의 1건만 매칭
- `grep -r "zustand" src/frontend/src/` → `store/index.ts` 내 import 2건만 매칭

## Completion Criteria
- `store/index.ts` 파일이 존재하지 않음
- `zustand` 패키지가 `package.json`에서 제거됨 (다른 사용처가 없는 경우)
- 빌드(`npm run build`) 정상 통과
- 기존 동작에 변화 없음
