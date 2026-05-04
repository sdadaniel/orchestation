# OrchestrateEngine: async stop 설계 노트

> 목적: `OrchestrateEngine.stop()`을 **비동기(= 실제 작업 종료까지 기다릴 수 있는 형태)**로 전환하고, `OrchestrationManager`/UI 로그가 “요청”이 아니라 **“정지 완료”**를 의미하도록 만들기 위한 설계/체크리스트.

## 배경: 현재 stop의 의미

현재 `OrchestrationManager.stop()`은 아래 순서로 동작한다.

- 엔진이 있으면 `this.engine.stop()` 호출
- 매니저 상태를 `IDLE`로 바꾸고 `finishedAt`를 찍음
- 로그: `"[orchestrate] Orchestration shutdown complete"`를 남김
- `emitStatusSnapshot()`로 `orchestration.status` 이벤트 발행

즉, 현재의 “Orchestration shutdown complete” 완료 로그는 **실제로 모든 작업이 종료되었음을 보장하는 완료**라기보다,
`stop()` 호출 경로가 끝났음을 의미한다.

참조:

- `packages/engine/src/orchestrate/managers/orchestration-manager.ts`의 `start()` / `stop()`
- `packages/engine/src/orchestrate/core/orchestrate-engine.ts`의 `stop()`

## 배경: 현재 start의 의미(매니저 vs 엔진)

`OrchestrationManager.start()`는 “오케스트레이션 세션 시작”을 의미하지만, **태스크/스텝 실행이 즉시 끝났다는 의미는 아니다.** 대신 아래 순서로 **상태 스냅샷을 먼저 발행**하고, 그 다음 엔진을 기동한다.

### 1) 매니저 레벨: `RUNNING`으로 전환 + 스냅샷 발행

`start()`는 먼저 매니저의 coarse 상태를 `RUNNING`으로 바꾸고(`startedAt`/`finishedAt`/`exitCode`/`taskResults` 리셋), 즉시 `emitStatusSnapshot()`를 호출한다.

- 의미: UI/게이트웨이는 이 시점에 **“오케스트레이션이 시작됨(세션 RUNNING)”** 스냅샷을 받는다.
- 주의: 이 시점에는 아직 `OrchestrateEngine`이 없거나(엔진 생성 전), 엔진이 `idle`일 수 있다.

### 2) 엔진 생성 + 훅 연결

`OrchestrateEngine`을 생성하면서 훅을 연결한다.

- `onLog`: 현재는 no-op으로 두어 **엔진 내부 로그를 외부 오케스트레이션 로그로 노출하지 않는다.**
- `onStatusChanged`: 엔진이 `idle`로 돌아오면 매니저 상태를 `IDLE`로 내리고 `finishedAt`/`exitCode`를 세팅한 뒤 `emitStatusSnapshot()`를 호출한다.
- `onTaskResult`: 태스크 결과를 `taskResults`에 누적하고 `publish("task.result", ...)` 후 `emitStatusSnapshot({ log: false })`로 스냅샷만 갱신한다.

### 3) 엔진 레벨: `start()`가 실제 스케줄 루프를 켠다

`this.engine.start()`는 엔진 내부 `_status`를 `running`으로 만들고, `mainLoop()`를 interval로 돌리며 첫 턴을 즉시 실행한다.

- 의미: **워커 디스패치/스텝 실행은 여기서부터** 본격적으로 진행된다.
- `start()`가 실패하면(이미 running 등) 매니저는 즉시 `IDLE`로 되돌리고 실패 로그를 남긴 뒤 `emitStatusSnapshot()`를 호출한다.

### 매니저 `start()`에서 “시작 완료”를 어떻게 정의할지

현재 구조에는 “start 요청 수신”, “매니저 RUNNING 스냅샷”, “엔진 running + mainLoop 시작”, “첫 태스크 디스패치”, “전체 완료(idle)” 같은 **여러 단계**가 섞여 있다.

문서/로그/UI에서 혼동을 줄이려면 다음 중 하나를 명시적으로 도입하는 것이 좋다.

- **옵션 1(최소 변경)**: 로그/문구만 분리
  - `start()` 직후: `"[orchestrate] start requested (manager RUNNING)"`
  - `engine.start()` 성공 직후: `"[orchestrate] engine started(mainLoop armed)"`
- **옵션 2(권장)**: 이벤트 타입을 분리(예: `orchestration.phase`)
  - `requested` / `engine-started` / `engine-idle` 등으로 UI가 단계별로 표현 가능

## 현재 엔진 stop이 동기인 이유

`OrchestrateEngine.stop()`은 동기 함수이며, 내부에서 하는 일은 “정리 요청” 중심이다.

- 모든 워커에 `abortController.abort()`를 호출
- 각 태스크 상태를 `stopped`로 세팅
- `loopTimer`/config watch 정리
- 엔진 내부 상태를 `idle`로 세팅

문제는 **abort 신호가 실제 실행(Job)까지 전파되지 않아**,
worker가 즉시 종료되지 않을 수 있다는 점이다.

## 중요한 사실: 엔진에는 이미 await 할 수 있는 `worker.promise`가 있다

`WorkerEntry`에는 `promise: Promise<void>`가 포함된다.

- `packages/engine/src/orchestrate/core/orchestrate-engine.ts`:
  - `interface WorkerEntry { abortController; promise; ... }`
  - `startStep()`에서 `wrapped = promise.then(...).catch(...)`를 만들고 `workers.set(..., { promise: wrapped })`로 저장

따라서 엔진 레벨에서 `stopAsync()`는 다음 형태가 가능하다.

- 모든 `entry.abortController.abort()` 호출
- 모든 `entry.promise`를 수집해서 `await Promise.allSettled(...)`
- 이후 타이머/워치 정리 및 `_status = "idle"`로 전환

단, “await가 의미 있게 끝나려면” 아래의 **abort 전파**가 필요하다.

## 현재 구조의 핵심 한계: AbortSignal이 실제 작업을 멈추지 못한다

`AbortController`는 생성/저장되지만, 실제 작업 실행 경로로 전달되지 않는다.

현재 실행 경로(요약):

1. `OrchestrateEngine.startStep()` → `runStep(...)`
2. `runStep()` → `runJobTask()` / `runJobReview()`
3. `runJobTask()` / `runJobReview()` → `runClaudeStreamJson()` (child process spawn)

하지만 아래 파일들에서 `signal?: AbortSignal` 같은 인자가 존재하지 않는다.

- `packages/engine/src/orchestrate/runner/step-runner.ts` (`runStep`)
- `packages/engine/src/orchestrate/jobs/job-task.ts` (`runJobTask`)
- `packages/engine/src/orchestrate/claude/claude-worker.ts` (`runClaudeStreamJson`)

즉, abort를 호출해도 실제로는:

- 워커 Promise가 계속 진행될 수 있음 (특히 `claude` child process가 계속 실행 중일 때)
- `stopAsync()`가 `Promise.allSettled`를 기다리면 **무한 대기**로 이어질 수 있음

## 설계 목표 (정의)

“stop을 비동기로 전환한다”는 말을 다음 중 무엇으로 정의할지 먼저 명확히 해야 한다.

### A) 표면적 async (호출자가 await 가능)

- `stop(): Promise<{ success: boolean }>`로 바꾸되,
내부는 즉시 resolve.
- 장점: 호출부 API만 async로 정렬 가능
- 단점: “정지 완료” 의미는 여전히 약함

### B) 진짜 async stop (정지 완료까지 await)

- `stop(): Promise<{ success: boolean }>`가 **워커 종료까지 기다림**
- 이 문서가 다루는 목표는 기본적으로 B

## 권장 구현: B(진짜 async stop) — 단계별

### 1) 엔드투엔드 abort 전파(필수)

다음과 같이 `AbortSignal`을 아래 방향으로 내려야 한다.

- `OrchestrateEngine.startStep()` → `runStep({ ..., signal })`
- `runStep()` → `runJobTask(..., signal)` / `runJobReview(..., signal)`
- `runJobTask`/`runJobReview` → `runClaudeStreamJson({ ..., signal })`

`runClaudeStreamJson`에서는:

- `signal.aborted`면 즉시 `reject` 또는 조기 resolve
- `signal.addEventListener("abort", ...)`에서 child process에 `SIGTERM` 후 일정 시간 후 `SIGKILL`
- 정리: 타이머/리스너 해제, 스트림 close

> 참고: 현재 `claude-worker.ts`에는 timeout watchdog으로 `proc.kill("SIGTERM")` → 5초 후 `SIGKILL` 패턴이 이미 존재한다. abort도 동일한 패턴을 재사용하면 된다.

### 2) `OrchestrateEngine.stop()`을 비동기로 변경

권장 형태(의사코드):

```ts
async stop(): Promise<{ success: boolean }> {
  const entries = [...this.workers.values()];
  for (const entry of entries) {
    entry.abortController.abort();
    this.setStatus(entry.taskId, "stopped");
  }

  // 1) 워커 종료 await (무한 대기 방지 필요)
  await Promise.allSettled(entries.map((e) => e.promise));

  // 2) 정리
  this.workers.clear();
  clearInterval(loopTimer)
  disarmConfigWatch()
  this._status = "idle";
  this.emitStatusSnapshotd(this._status); // start와 대칭
  return { success: true };
}
```

주의:

- `workers` map의 key는 `${taskId}:${stepId}` 형태다. stop 루프에서 `[taskId, entry]`처럼 순회하면 혼동될 수 있으니, 변수명을 `workerKey`로 쓰는 편이 안전하다.
- `Promise.allSettled`는 **abort 전파가 잘 되지 않으면** 오래 걸릴 수 있으므로, 다음 타임아웃 설계가 필요하다.

### 3) stop 타임아웃(강력 권장)

실무적으로는 “stop이 영원히 걸리는 것”이 가장 큰 장애이므로, 엔진 stop에는 타임아웃이 필요하다.

- 예: 5~10초 타임아웃 후 “강제 종료” 정책 선택
  - (a) remaining worker에 `SIGKILL`을 한 번 더 시도
  - (b) 타임아웃 후에도 `idle`로 전환하되, “완전 정지 불확실” 상태를 로그/메트릭에 남김

프로젝트 상황에 따라 (b)는 위험할 수 있으므로, 가능하면 (a)까지 시도하는 것을 권장한다.

### 4) `OrchestrationManager.stop()` 로그 의미 교정

엔진 stop이 진짜 async가 되면, 매니저 로그를 다음처럼 분리할 수 있다.

- stop 호출 직후: `"[orchestrate] stop 요청"` (요청 로그)
- `await engine.stop()` 이후: `"[orchestrate] Orchestration shutdown complete"` (완료 로그)

이렇게 하면 UI에서 “요청/완료”의 의미가 분명해진다.

## 검증 체크리스트

### 기능 검증

- RUNNING 상태에서 stop 버튼을 눌렀을 때:
  - `claude` child process가 실제로 종료되는가? (SIGTERM/SIGKILL)
  - worker promise가 완료되는가?
  - 엔진이 `idle`로 전환되고, 매니저가 `orchestration.status`를 발행하는가?

### 회귀 위험

- stop 도중 `healthCheck()` 또는 `mainLoop()`가 동시에 worker map을 수정할 수 있음
  - stop에서 먼저 `loopTimer`를 끄는 순서를 고려
- `onStepFinished`가 실행되는 경로가 stop 이후에도 발생할 수 있음
  - abort 시 `runJob`*가 reject/resolve 되는 방식에 따라 후처리가 달라짐

## 관련 파일/진입점

- 엔진:
  - `packages/engine/src/orchestrate/core/orchestrate-engine.ts`
  - `packages/engine/src/orchestrate/runner/step-runner.ts`
  - `packages/engine/src/orchestrate/jobs/job-task.ts`
  - `packages/engine/src/orchestrate/jobs/job-review.ts`
  - `packages/engine/src/orchestrate/claude/claude-worker.ts`
- 매니저:
  - `packages/engine/src/orchestrate/managers/orchestration-manager.ts`

