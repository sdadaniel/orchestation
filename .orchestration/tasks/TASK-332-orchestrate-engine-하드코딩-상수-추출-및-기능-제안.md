---
id: TASK-332
title: orchestrate-engine-하드코딩-상수-추출-및-신규-기능-제안-문서화
status: failed
priority: medium
mode: night
created: 2026-04-03
updated: 2026-04-03 02:01
depends_on: []
scope:
  - src/frontend/src/lib/orchestrate-engine.ts
  - src/frontend/server.ts
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - docs/plan/
---
## 이슈: 하드코딩된 매직 값 상수 추출 + 신규 기능 제안 문서화

### 1. 코드 스타일 수정 (매직 값 → 상수 추출)

`orchestrate-engine.ts:764`에 `hostname: "localhost", port: 3000`이 하드코딩되어 있다.
`server.ts`에도 `"localhost"`, `"3000"`, `"xterm-256color"`, `cols: 80`, `rows: 24` 등 매직 값이 산재.

**수정 방향:**
- `orchestrate-engine.ts` 상단에 `NOTICE_API_HOST`, `NOTICE_API_PORT` 상수 추출
- `server.ts` 상단에 `DEFAULT_HOSTNAME`, `DEFAULT_PORT`, `TERM_NAME`, `TERM_COLS`, `TERM_ROWS` 상수 추출
- `process.env.PORT` 참조를 상수와 통일

### 2. API route console문 → 구조화 로깅 전환 (신규 기능 제안)

현재 `chat/route.ts`, `tasks/suggest/route.ts`, `tasks/analyze/route.ts`에 `console.error`가 총 8건 존재.
프로덕션 환경에서 디버깅 추적이 어렵다.

**신규 기능 제안:**
- `src/lib/logger.ts` 유틸리티 생성: 환경별(dev/prod) 로그 레벨 제어
- API route의 `console.error` → `logger.error`로 전환
- `server.ts`의 17건 `console.*` → `logger.*`로 전환
- 이 제안을 `docs/plan/` 아래 문서로 작성

### 3. 문서화

- `docs/plan/2026-04-03-structured-logging-proposal.md` 작성
- 현재 console 사용 현황, 제안 아키텍처, 마이그레이션 단계 포함

## Completion Criteria
- orchestrate-engine.ts의 하드코딩 `localhost:3000`이 상수로 추출됨
- server.ts의 매직 넘버가 파일 상단 상수로 추출됨
- 구조화 로깅 기능 제안이 `docs/plan/` 아래 문서화됨
- 기존 로직 변경 없음 (상수 추출 + 문서 작성만)
