---
id: TASK-363
title: GlobalSearch 컴포넌트의 비효율적 인덱싱 및 반복 패턴 제거
status: pending
priority: medium
role: general
depends_on: []
scope: 
  - src/frontend/src/components/GlobalSearch.tsx
created: 2026-04-10 16:06:03
updated: 2026-04-10 16:06:03
---
## 문제
검색 결과 렌더링 시 `slice(0, 20)` 배열에서 반복적으로 `indexOf`를 호출하여 O(n²) 복잡도 발생. 또한 task/doc 섹션 렌더링 로직이 거의 동일하게 반복됨.

### 구체적 이슈
- line 236, 264: 각 item마다 `sliced.indexOf(item)` 호출 (O(n) × 반복 렌더링)
- lines 232-258, 260-281: task와 doc 렌더링 구조가 거의 동일
- line 237: `globalIdx++` 증가되지만 미사용

## Completion Criteria
- `indexOf` 제거: 초기 인덱싱 후 map 사용으로 변경
- 반복 패턴 추출: task/doc 렌더링을 재사용 가능한 헬퍼 함수로 추출
- 미사용 변수 제거: `globalIdx` 삭제
- 기능 보존: 검색, 키보드 네비게이션, 상태 표시 모두 동일하게 동작
