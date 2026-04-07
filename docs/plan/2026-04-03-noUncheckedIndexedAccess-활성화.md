# 신규 기능 제안: tsconfig `noUncheckedIndexedAccess` 활성화

## 배경

현재 `tsconfig.json`에 `strict: true`가 설정되어 있으나, `noUncheckedIndexedAccess`는 `strict`에 포함되지 않아 별도 활성화가 필요하다. 이 옵션이 없으면 배열 인덱스 접근(`arr[i]`)이나 `Record` 키 접근(`obj[key]`)이 항상 non-undefined로 타입 추론되어, 범위 초과 접근 시 런타임 에러가 발생할 수 있다.

## 현재 상태

`npx tsc --noEmit --noUncheckedIndexedAccess` 실행 시 다수의 에러 발견:

| 파일 | 에러 수 | 패턴 |
|------|---------|------|
| `requests/[id]/reorder/route.ts` | 6 | `siblings[idx]` 배열 인덱스 접근 |
| `requests/[id]/route.ts` | 5 | `fmMatch[1]` regex 캡처 그룹 접근 |
| `notices/page.tsx` | 3 | `TYPE_CONFIG[key]` Record 접근 |
| `requests/page.tsx` | 3 | `grouped[status]` Record 접근 |
| `tasks/new/page.tsx` | 3 | `suggestions[idx]` 배열 인덱스 접근 |

## 제안

### Phase 1: 위험 코드 선행 수정 (TASK-342)
- 런타임 에러 가능성이 있는 배열 인덱스 접근에 가드 추가
- 로직 변경 없이 `if (!item)` 가드만 삽입

### Phase 2: tsconfig 옵션 활성화
- `tsconfig.json`에 `"noUncheckedIndexedAccess": true` 추가
- 컴파일 에러가 발생하는 나머지 코드 일괄 수정
- 주요 수정 패턴:
  - `arr[i].prop` → `arr[i]?.prop` 또는 non-null assertion(`!`) with bounds check
  - `record[key].prop` → `record[key]?.prop`
  - regex match `m[1]` → `m[1]!` (null check 이후이므로 안전)

### Phase 3: CI 파이프라인 연동
- tsc strict check를 CI에서 실행하여 향후 regression 방지

## 기대 효과
- 배열/Record 인덱스 접근의 undefined 가능성을 컴파일 타임에 탐지
- 런타임 `Cannot read properties of undefined` 에러 사전 방지
- TypeScript 타입 안전성 수준 향상

## 리스크
- 기존 코드에 다수의 `?.` 또는 가드 추가 필요 (일시적 diff 증가)
- `.filter(Boolean) as T[]` 같은 패턴이 증가할 수 있음
