---
id: TASK-163
title: className 템플릿 리터럴을 cn() 유틸로 통일
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/GlobalSearch.tsx
  - src/frontend/src/app/settings/page.tsx
  - src/frontend/src/components/cost/SortIcon.tsx
  - src/frontend/src/components/cost/CostTable.tsx
  - src/frontend/src/components/cost/RunHistory.tsx
---

프로젝트 전체에서 `cn()` 유틸(`@/lib/utils`)을 사용하여 조건부 className을 조합하는 것이 표준 패턴이다(37개 파일, 137회 사용). 그러나 5개 파일에서 template literal(`className={\`...\`}`)을 사용하여 className을 조합하고 있어 코드 스타일이 일관되지 않는다.

### 수정 대상

| 파일 | template literal 사용 횟수 |
|---|---|
| `GlobalSearch.tsx` | 3곳 |
| `settings/page.tsx` | 4곳 |
| `cost/SortIcon.tsx` | 1곳 |
| `cost/CostTable.tsx` | 3곳 |
| `cost/RunHistory.tsx` | 1곳 |

### 수정 방법

1. 각 파일 상단에 `import { cn } from "@/lib/utils"` 추가
2. `className={\`${base} ${condition ? "a" : "b"}\`}` → `className={cn(base, condition ? "a" : "b")}` 형태로 변환

### 제약

- className 변환만 수행, 컴포넌트 로직 변경 금지
- 기존 CSS 클래스 이름 변경 금지

## Completion Criteria

- scope 내 5개 파일에서 template literal className 조합이 모두 `cn()` 호출로 변환됨
- `import { cn } from "@/lib/utils"` 가 해당 파일에 추가됨
- 빌드(`npm run build`) 성공
- UI 렌더링에 변경 없음 (시각적 변화 없음)
