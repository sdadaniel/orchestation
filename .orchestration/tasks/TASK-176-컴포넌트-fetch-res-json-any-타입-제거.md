---
id: TASK-176
title: 컴포넌트 fetch res.json() any 타입 제거
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/DAGCanvas.tsx
  - src/frontend/src/components/TaskLogModal.tsx
  - src/frontend/src/components/TaskCreateDialog.tsx
  - src/frontend/src/components/TaskDeleteDialog.tsx
  - src/frontend/src/components/TaskEditSheet.tsx
  - src/frontend/src/components/SprintCreateDialog.tsx
---

여러 컴포넌트에서 `fetch().then(r => r.json())` 또는 `await res.json()` 호출 결과가 `any` 타입으로 사용되고 있다.
프로퍼티 접근 시 타입 안전성이 보장되지 않아, 오타나 API 응답 구조 변경 시 런타임 오류가 발생할 수 있다.

### 현황

| 파일 | 패턴 | 비고 |
|------|------|------|
| `DAGCanvas.tsx` | `fetch("/api/settings").then(...).then((d) => d.maxParallel)` | `d`가 `any` |
| `TaskLogModal.tsx` | `const data = await res.json(); data.logs` | `data`가 `any` |
| `TaskCreateDialog.tsx` | `const data = await res.json(); data.error` | `data`가 `any` |
| `TaskDeleteDialog.tsx` | `const data = await res.json(); data.error` | `data`가 `any` |
| `TaskEditSheet.tsx` | `const data = await res.json(); data.error` | `data`가 `any` |
| `SprintCreateDialog.tsx` | `const data = await res.json(); data.error` | `data`가 `any` |

### 수정 방법

- 에러 응답용 `{ error?: string }` 인터페이스 적용 (또는 기존 공통 타입이 있으면 재사용)
- 각 엔드포인트별 성공 응답 타입을 인라인 또는 공유 타입으로 지정
- 로직 변경 없이 타입 어노테이션만 추가

### 기존 태스크와의 관계

- TASK-150: `RequestCard`의 executionLog/reviewResult any 제거 → 별개 파일
- TASK-170: `AutoImproveControl` fetch 응답 any 제거 → 별개 파일

## Completion Criteria

- scope 내 6개 파일의 `res.json()` 반환값에 명시적 타입이 지정되어 있을 것
- `any` 타입이 fetch 응답 경로에서 전파되지 않을 것
- `tsc --noEmit --strict` 통과 (기존 e2e 순환참조 제외)
- 로직 변경 없음
