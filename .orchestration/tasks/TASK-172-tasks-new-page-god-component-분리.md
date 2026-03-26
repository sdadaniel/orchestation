---
id: TASK-172
title: tasks/new/page.tsx 840줄 god component 분리
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/tasks/new/page.tsx
---

## 현재 문제

`src/frontend/src/app/tasks/new/page.tsx`가 840줄의 god component로, 단일 함수 내에 다음 책임이 모두 혼재:

1. **직접 작성 탭** (write) — 폼 입력, AI 분석 요청, 프리뷰
2. **추천 탭** (suggest) — 프로젝트 스캔, 추천 목록 렌더링, 선택/생성
3. **프리뷰 단계** (preview) — 분석 결과 카드 렌더링, 개별 편집, 일괄 생성
4. **상태 관리** — 15개 이상의 useState가 한 컴포넌트에 산재

### 구체적 징후

- `pageTab` × `step` 조합에 따른 4-depth 조건부 렌더링 (L266~L377, L379~L578, L580~L840)
- 인라인 핸들러에 fetch + JSON 파싱 + 상태 업데이트 로직 직접 포함 (L85~L170)
- `AnalyzedTask` 편집 로직(제목/설명/우선순위/criteria/scope/depends_on)이 프리뷰 JSX 안에 인라인으로 존재

## 변경 방향

로직 변경 없이 **컴포넌트 추출**만 수행:

1. `SuggestTab` — 추천 요청/목록/선택 UI (L280~L377)
2. `WriteInputForm` — 직접 작성 폼 (L379~L578)
3. `AnalysisPreview` — AI 분석 결과 카드 목록 + 편집 (L580~L840)
4. 공통 상태는 부모 `NewTaskPage`에서 props로 전달

## Completion Criteria

- `tasks/new/page.tsx`의 줄 수가 300줄 이하로 감소
- 추출된 하위 컴포넌트 3개가 동일 디렉토리 또는 `components/task-create/`에 위치
- 기존 동작(직접 작성, 추천, 프리뷰, 생성)이 모두 동일하게 작동
- TypeScript 컴파일 에러 없음
