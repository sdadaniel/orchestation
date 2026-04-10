# Full Project Refactoring Design

**Date:** 2026-04-10  
**Approach:** Big Bang (single branch, merge all at once)  
**Execution order:** Bottom-up — Data Layer → Engine → Frontend

---

## Overview

This refactoring eliminates all legacy artifacts and brings the codebase to a clean, consistent state. No new features. Three independent sub-projects executed sequentially on a single branch.

---

## Sub-project 1: Data Layer 완전 전환

### Goal
SQLite를 유일한 진실의 원천으로 확립. 파일 기반 폴백 완전 제거.

### Current State
- `service/task-store.ts` — SQLite 구현 완료, 일부 파일 폴백 코드 잔존 가능
- `lib/paths.ts` — `.orchestration/tasks/` 경로 상수 존재
- `parser/parser.ts` — .md 파일 파싱 로직 일부 잔존
- `.orchestration/tasks/` — 290개 .md 파일 (DB에 이미 동기화됨)

### Changes
| 파일 | 변경 내용 |
|------|----------|
| `service/task-store.ts` | 파일 폴백 코드 제거, SQLite only |
| `lib/paths.ts` | `.orchestration/tasks/` 경로 상수 제거 |
| `parser/parser.ts` | .md 태스크 파싱 로직 제거 |
| `app/api/tasks/` | 파일 읽기 경로 잔재 제거 |
| `.orchestration/tasks/` | 290개 .md 파일 삭제 |

### Constraints
- 마이그레이션 스크립트 불필요 (DB에 이미 290개 태스크 존재)
- `getTask()`, `getAllTasks()`, `createTask()`, `updateTask()` — DB 전용
- 삭제 전 DB row count 검증 필수

---

## Sub-project 2: Engine 분리 + Shell 제거 + IPC 현대화

### Goal
모놀리식 엔진을 단일 책임 모듈로 분리. 레거시 Shell 완전 제거. 파일시그널 IPC를 EventEmitter로 교체.

### Current State
- `engine/orchestrate-engine.ts` (220 LOC) — 스케줄링, 실행, 재시도, 시그널 감시 모두 담당
- `engine/signal.ts` — `fs.watch` 기반 파일시그널 IPC
- `scripts-legacy/` — orchestrate.sh (51KB), job-task.sh, job-review.sh 등 (미사용)

### Target Structure

```
engine/
  scheduler.ts           # 태스크 우선순위 결정, 병렬도 관리
  task-executor.ts       # 단일 태스크 실행 (job-task.ts 내용 흡수)
  review-executor.ts     # 리뷰 실행 (job-review.ts 내용 흡수)
  retry-manager.ts       # 재시도 로직 (현재 orchestrate-engine 내 인라인)
  engine-bus.ts          # EventEmitter 기반 IPC (signal.ts 대체)
  orchestrate-engine.ts  # 얇은 조율자 — scheduler + executor 연결만
```

### IPC Migration
- **Before:** `fs.watch` + `.orchestration/signals/` 파일 쓰기/감시
- **After:** `engine-bus.ts` (Node.js `EventEmitter`)
- Events: `task:done`, `task:failed`, `review:approved`, `review:rejected`, `task:retry`
- 외부 프로세스 통신은 그대로 유지, 내부 모듈 간 통신만 EventEmitter로 전환

### Shell Removal
- `scripts-legacy/` 디렉토리 전체 삭제
- `cli.js` shell 경로 참조 정리
- `package.json` scripts에서 shell 직접 호출 제거

### Constraints
- 기존 공개 API (`orchestrate-engine.ts` export) 시그니처 유지
- child process 스폰 로직(`runner/`) 은 변경하지 않음

---

## Sub-project 3: Frontend 컴포넌트 정리

### Goal
CLAUDE.md 디자인 시스템 완전 준수. Dense 페이지 서브컴포넌트 분리. 중복 패턴 컴포넌트화. 기능 변경 없음.

### Raw HTML 제거 (CLAUDE.md 규칙)
- `<input>`, `<select>`, `<textarea>` 직접 사용 → `@/components/ui/` 교체
- 이중 보더 패턴 제거 (border 카드 안에 Input/Select)

### 컴포넌트 추출 (3회 이상 반복 패턴)
| 새 컴포넌트 | 추출 기준 |
|------------|----------|
| `<FieldRow>` | 라벨 + 입력 필드 조합 패턴 |
| `<SettingSection>` | `<Label size="section">` + 필드 그룹 패턴 |

### Dense 페이지 분리
| 페이지 | 분리 내용 |
|--------|----------|
| `tasks/new/page.tsx` | AI 제안 섹션 / 수동 생성 섹션 서브컴포넌트 분리 |
| `settings/page.tsx` | API 설정 / 모델 설정 / 실행 설정 각 섹션 분리 |
| `cost/page.tsx` | 차트 / 테이블 서브컴포넌트 분리 |

### PageLayout 통일
- `<PageLayout>` + `<PageHeader>` 미적용 페이지 모두 적용

### Constraints
- Storybook stories — 새 컴포넌트에 `.stories.tsx` 필수
- 기능/동작 변경 없음 (구조/스타일만)
- `cn()` utility 사용 통일

---

## Execution Order Summary

```
[Branch: refactor/big-bang]
  │
  ├─ Phase 1: Data Layer
  │   └─ SQLite only, .md 파일 삭제
  │
  ├─ Phase 2: Engine
  │   └─ 모듈 분리, Shell 삭제, EventEmitter IPC
  │
  └─ Phase 3: Frontend
      └─ 컴포넌트 정리, raw HTML 제거, PageLayout 통일
```

각 Phase 완료 후 `typecheck` + `build` 통과 확인 후 다음 Phase 진행.

---

## Success Criteria

- [ ] `.orchestration/tasks/` 디렉토리 존재하지 않음
- [ ] `scripts-legacy/` 디렉토리 존재하지 않음
- [ ] `signal.ts` 제거, `engine-bus.ts` 존재
- [ ] `orchestrate-engine.ts` < 100 LOC
- [ ] raw `<input>/<select>/<textarea>` 0개
- [ ] 이중 보더 패턴 0개
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과
