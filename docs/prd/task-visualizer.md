# PRD: 오케스트레이션 대시보드

## 목표

`docs/` 하위 문서(task, sprint, plan)를 파싱하여 프로젝트 현황을 웹 대시보드로 시각화한다.

## 핵심 기능

### 1단계: 프로젝트 셋업 + 데이터 API (완료)

- Next.js 프로젝트 초기화, 대시보드 레이아웃
- `docs/task/*.md` YAML frontmatter 파싱 API

### 2단계: 워터폴 뷰 (현재 스코프)

- Sprint > Task 계층 구조의 워터폴(타임라인) 시각화
- Task 상태(`backlog`, `in_progress`, `in_review`, `done`)를 바 색상으로 구분
- Sprint별 Task 그룹핑 및 접기/펼치기
- Task 클릭 시 사이드 패널에 상세 정보 표시
- Sprint 진행률 표시

### 3단계: Plan 뷰 (향후)

- Plan → Sprint → Task 전체 흐름 조감도

### 4단계: 오케스트레이션 실행 (향후)

- **Task/Sprint CRUD**: 웹 UI에서 md 파일 생성·수정·삭제, 상태 변경 (backlog → in_progress → in_review → done)
- **작업자 에이전트 실행**: Claude API / Agent SDK를 통해 작업자 에이전트를 spawn하고 Task를 배정
- **실행 상태 실시간 모니터링**: 에이전트 실행 로그, 진행률, 결과를 대시보드에서 실시간 확인
- **감독 역할의 웹 UI화**: TBD 해소, 작업자 배정, PR 승인 등 감독 워크플로를 웹에서 수행

## 기술 스택

- **프레임워크**: Next.js (App Router, TypeScript)
- **UI**: shadcn/ui + Tailwind CSS (워터폴 컴포넌트 직접 구현)
- **데이터 소스**: `docs/task/*.md`, `docs/sprint/*.md` frontmatter 직접 파싱 (별도 DB 없음)
- **패키지 매니저**: yarn
- **배포**: 로컬 실행

## 데이터 흐름

```
docs/task/*.md + docs/sprint/*.md → Next.js API Route (파싱) → 프론트엔드 (워터폴 렌더링)
```

## UI 구조

- **대시보드 레이아웃**: 사이드바(네비게이션) + 메인 영역
- **네비게이션**: Task / Plan(향후) 탭 전환
- **메인 영역**: 워터폴 뷰 — Sprint 헤더 아래 Task 바가 계층적으로 표시
- **사이드 패널**: Task 클릭 시 상세 정보 (id, title, status, priority, role, depends_on 등)

## 워터폴 시각화 요구사항

- Sprint = 그룹 헤더 (접기/펼치기 가능)
- Task = 수평 바 (상태별 색상)
- 상태별 색상 구분 (backlog: 회색, in_progress: 파랑, in_review: 주황, done: 초록)
- Sprint 진행률 표시 (완료 Task / 전체 Task)

## 완료 조건

- 로컬에서 워터폴 뷰가 Sprint > Task 계층으로 정상 렌더링된다
- Task 클릭 시 사이드 패널에 상세 정보가 표시된다
- `docs/task/`, `docs/sprint/`에 파일을 추가/수정하면 새로고침 시 반영된다
- 상태별 색상이 구분된다
