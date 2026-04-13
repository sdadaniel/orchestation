# CLAUDE.md

## Behavior Rules

### Prompt Improvement Feedback
작업 완료 후, 해당 작업에서 발견된 문제를 **사전에 일괄 탐지할 수 있었을 상위 프롬프트**를 피드백한다.

예시 형식:
```
## Prompt Feedback
이번 작업에서 [N]건의 문제를 개별 수정했습니다.
아래 프롬프트로 사전에 일괄 탐지 가능했습니다:

> "프론트엔드 전체를 점검해줘: 1) 실제로 동작하지 않는 연결(가짜 SSE, 끊어진 import 등) 2) 같은 데이터를 중복 요청하는 곳 3) 삭제된 기능의 레거시 참조 4) 페이지 이동 시 날아가는 상태"
```

왜 이렇게 하는가: 사용자가 개별 버그를 하나씩 발견하며 수정 요청하는 패턴이 반복됨. 상위 프롬프트를 축적하면 다음에 비슷한 상황에서 한 번에 전체 점검을 요청할 수 있음.

### When to Plan vs Implement
사용자가 토론/계획/리뷰를 요청하면 절대 구현하지 않는다. 계획과 구현은 별도 단계.

### Minimize Questions
사용자의 의도가 80% 이상 명확하면 바로 실행한다. 질문은 한 번에 최대 1개.

## Environment
- macOS bash 3.x — `declare -A`, `mapfile`, `readarray` 사용 금지
- Shell 스크립트에서 `claude` CLI 호출 시 full PATH 사용 또는 사전 resolve

## Task Management
- 유효한 태스크 상태: `pending`, `stopped`, `in_progress`, `reviewing`, `done`, `failed`, `rejected`
- 새 태스크 생성 시 status는 반드시 `pending`
- `failed`/`rejected`/`done`은 터미널 상태로, 큐가 재픽업하지 않는다 (수동 복구 필요)
- `failed`는 엔진 크래시·리뷰 retry 상한 초과·비용 상한 초과·머지 실패 등 비의도적 종료에 사용
- Sprint 개념은 삭제됨 — 사용하지 않는다

## Design System (Frontend)

### 원칙
- OpenAI Assistants Playground 스타일 기반: 단일 컬럼, 넉넉한 패딩, 간격으로 그룹핑
- **raw HTML 금지**: `<input>`, `<select>`, `<textarea>` 직접 사용 금지. 반드시 `@/components/ui/` 컴포넌트 사용

### UI 컴포넌트 (`src/frontend/src/components/ui/`)
| 컴포넌트 | 용도 | 주요 props |
|----------|------|-----------|
| `Input` | 텍스트/패스워드/숫자/시간 입력 | `size="default"\|"sm"` |
| `Select` | 드롭다운 선택 (커스텀 chevron 포함) | `size="default"\|"sm"\|"inline"` |
| `Textarea` | 여러 줄 텍스트 입력 | `size="default"\|"sm"` |
| `Label` | 필드 라벨 / 섹션 라벨 | `size="default"\|"sm"\|"section"` |
| `Toggle` | on/off 토글 스위치 | `checked`, `onChange` |
| `Slider` | 범위 슬라이더 | `min`, `max`, `value`, `onChange`, `showRange` |
| `Button` | 버튼 | `variant="default"\|"ghost"\|"sidebar"`, `size` |
| `Checkbox` | 체크박스 | 표준 input props |
| `Badge` / `StatusBadge` / `PriorityBadge` | 상태/우선순위 뱃지 | `size` |
| `Dialog` | 모달 다이얼로그 | Radix 기반 |
| `Sheet` | 사이드 패널 | `side` |

### 레이아웃 규칙
- **모든 페이지**: `<PageLayout>` + `<PageHeader title="...">` 사용 (max-w-3xl, space-y-4, pb-16)
- **페이지 헤더**: 좌측 `text-lg font-semibold` 제목 + 우측 액션 버튼 (`filter-pill active`)
- **섹션 그룹핑**: 간격(space-y-4)으로 분리. 카드(border) 래퍼 사용 금지
- **이중 보더 금지**: 폼 요소(Input/Select 등)가 이미 보더를 가지므로, 바깥을 카드(border)로 감싸면 이중 테두리가 됨. 절대 금지
- **구분**: 섹션 라벨(`<Label size="section">`)과 간격으로 구분. 디바이더나 카드 래퍼 불필요

### 반복 패턴은 컴포넌트로 추출
- 같은 구조가 3회 이상 반복되면 반드시 컴포넌트로 추출한다
- 클래스명, props 등이 복붙으로 전파되는 구조는 실수의 원인이므로 허용하지 않는다
- 예: 사이드바 항목, 필터 버튼 그룹, 폼 필드+라벨 조합 등

### 스타일 규칙
- **입력 필드**: `bg-muted`, `border border-border`, `rounded-md`, `focus:border-primary`
- **섹션 라벨**: `<Label size="section">` (11px, uppercase, tracking)
- **필드 라벨**: `<Label>` (14px, text-muted-foreground)
- **슬라이더**: globals.css의 `.ds-slider` 클래스 사용

### Storybook
- 모든 UI 컴포넌트는 `.stories.tsx` 파일 필수
- `npx storybook dev -p 6006`으로 확인
- 새 컴포넌트 추가 시 반드시 스토리도 함께 작성
