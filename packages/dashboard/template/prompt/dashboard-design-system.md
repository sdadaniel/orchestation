# Design System — packages/dashboard

`packages/dashboard` 화면·컴포넌트 작업 시 따른다. (**OrchestrationTaskWorker**에서 scope에 dashboard가 포함되면 엔진이 본문을 주입할 수 있음. **OrchestrationReviewWorker**는 diff에 dashboard 변경이 있을 때만 참조.)

## 원칙

- OpenAI Assistants Playground 스타일: 단일 컬럼, 넉넉한 패딩, 간격으로 그룹핑
- **raw HTML 금지**: `<input>`, `<select>`, `<textarea>` 직접 사용 금지. 반드시 `@/components/ui/` 사용

## UI 컴포넌트 (`packages/dashboard/src/components/ui/`)

| 컴포넌트 | 용도 | 주요 props |
|----------|------|-----------|
| `Input` | 텍스트/패스워드/숫자/시간 | `size="default"\|"sm"` |
| `Select` | 드롭다운 | `size="default"\|"sm"\|"inline"` |
| `Textarea` | 여러 줄 | `size="default"\|"sm"` |
| `Label` | 필드/섹션 라벨 | `size="default"\|"sm"\|"section"` |
| `Toggle` | on/off | `checked`, `onChange` |
| `Slider` | 범위 | `min`, `max`, `value`, `onChange`, `showRange` |
| `Button` | 버튼 | `variant="default"\|"ghost"\|"sidebar"`, `size` |
| `Checkbox` | 체크박스 | 표준 input props |
| `Badge` / `StatusBadge` / `PriorityBadge` | 상태/우선순위 | `size` |
| `Dialog` | 모달 | Radix 기반 |
| `Sheet` | 사이드 패널 | `side` |

## 레이아웃

- **모든 페이지**: `<PageLayout>` + `<PageHeader title="...">` (max-w-3xl, space-y-4, pb-16)
- **페이지 헤더**: 좌 `text-lg font-semibold` + 우 액션 (`filter-pill active`)
- **섹션**: `space-y-4`. 카드(border) 래퍼로 감싸지 않음
- **이중 보더 금지**: Input/Select 등이 이미 보더 → 바깥 카드(border) 금지
- **구분**: `<Label size="section">` + 간격. 불필요한 디바이더·카드 래퍼 금지

## 반복 패턴

같은 구조가 3회 이상이면 컴포넌트로 추출. 복붙 전파 금지.

## 스타일

- 입력: `bg-muted`, `border border-border`, `rounded-md`, `focus:border-primary`
- 섹션 라벨: `<Label size="section">`
- 필드 라벨: `<Label>` (text-muted-foreground)
- 슬라이더: `globals.css`의 `.ds-slider`

## Storybook

- UI 컴포넌트는 `.stories.tsx` 필수
- `npx storybook dev -p 6006`
- 새 컴포넌트 추가 시 스토리 동반
