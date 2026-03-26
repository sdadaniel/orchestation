---
id: TASK-178
title: Claude CLI spawn 보일러플레이트 공통 유틸 추출
status: pending
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/app/api/chat/route.ts
  - src/frontend/src/app/api/tasks/analyze/route.ts
  - src/frontend/src/app/api/tasks/suggest/route.ts
---

## 문제

Claude CLI를 호출하는 API 라우트 3곳에 동일한 보일러플레이트가 중복되어 있다.

### 중복 패턴 1: spawn 설정 (chat/route.ts, analyze/route.ts)

두 파일 모두 동일한 spawn 인자와 환경변수 설정을 사용한다:

```typescript
const child = spawn(
  "claude",
  ["--print", "--model", "claude-sonnet-4-6", "--output-format", "text"],
  {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  },
);
```

- `chat/route.ts` L49-60
- `analyze/route.ts` L54-65

### 중복 패턴 2: 90초 타임아웃 + child.kill (chat/route.ts, analyze/route.ts)

두 파일 모두 동일한 타임아웃 로직과 SIGTERM kill을 사용한다:

- `chat/route.ts` L105-117
- `analyze/route.ts` L182-192

### 중복 패턴 3: PROJECT_ROOT 정의 (3곳)

`path.resolve(process.cwd(), "../..")` 가 chat, analyze, suggest 라우트 및 lib 파일들에 걸쳐 7곳에서 반복 정의된다.

### suggest/route.ts의 추가 문제

`suggest/route.ts`는 `execSync`로 claude를 호출하면서 셸 이스케이프 없이 `echo ${JSON.stringify(prompt)}`를 사용한다. prompt에 특수문자가 포함되면 셸 해석으로 인한 오류가 발생할 수 있다.

## 제안

공통 유틸 모듈(예: `src/frontend/src/lib/claude-cli.ts`)에 다음을 추출한다:

1. **`PROJECT_ROOT` 상수** — 한 곳에서 정의
2. **`spawnClaude(prompt: string, options?: { model?: string; timeout?: number }): ChildProcess`**
   - spawn 설정, env/PATH, stdio를 캡슐화
   - stdin에 prompt 기록 후 end 호출
3. **`runClaudeSync(prompt: string, options?: { timeout?: number }): string`**
   - suggest/route.ts용 동기 실행 래퍼
   - stdin pipe 방식으로 변경하여 셸 인젝션 위험 제거

각 라우트는 공통 유틸을 호출하도록 수정한다. 모델명·타임아웃 등 매직 문자열도 상수로 통합한다.

## Completion Criteria

- [ ] `claude-cli.ts`(또는 유사 이름) 파일에 공통 유틸 함수가 존재한다
- [ ] chat/route.ts, analyze/route.ts, suggest/route.ts가 공통 유틸을 사용하도록 리팩터링되었다
- [ ] 모델명(`claude-sonnet-4-6`), 타임아웃(90s) 등 매직 문자열이 상수로 정의되었다
- [ ] suggest/route.ts의 셸 이스케이프 문제가 해소되었다 (stdin pipe 방식)
- [ ] 기존 API 동작(스트리밍 응답, JSON 응답)이 변경 없이 유지된다
- [ ] TypeScript 컴파일 에러가 없다
