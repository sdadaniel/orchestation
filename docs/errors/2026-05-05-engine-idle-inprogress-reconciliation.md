# 엔진 미가동인데 태스크가 실행 중으로 남는 상태 불일치 (2026-05-05)

## 요약

오케스트레이션 **엔진(런)이 실제로 돌고 있지 않은데** 저장소/DB 상 태스크가 `in_progress`로 남아 있으면, **“누가 이 태스크를 실행 중인가?”**에 대한 답이 없어지므로 **잘못된 케이스**다.  
이때 **실행 주체(워커)가 없음**이 확실할 경우, 해당 태스크는 `stopped` 등 비활성 종료 상태로 **정리(reconcile)** 할 수 있는 규칙이 필요하다.

`pending`만 있는 상황은 “아직 디스패치되지 않은 큐”에 가깝기 때문에, 엔진이 꺼져 있어도 **모순이 덜하지만**, UI/운영 관점에서 “실행 가능한 런이 없는데 대기만 쌓인다”는 혼동은 별도로 다룰 수 있다.

## 배경: 두 가지를 구분해야 함

### 1) Graceful stop (의도된 동작)

런/엔진을 종료해도 **이미 붙잡힌(in-flight) 작업**은 끝까지 실행되도록 두는 경우가 있다.  
이 구간에서는 태스크가 잠시 `in_progress`로 남는 것이 **정상**일 수 있다.

### 2) 실행 주체 부재 (버그/복구 대상)

엔진 프로세스·스케줄 루프·워커가 **실제로는 없는데** 태스크만 `in_progress`인 경우다.  
이때 상태는 **현실과 어긋난 좀비(stuck) `in_progress`**에 해당한다.

레거시 셸 오케스트레이터에서 유사 증상(시그널/PID 미검증으로 영구 `in_progress`)은 별도 인시던트 문서에 정리되어 있다.

- 참고: [orchestrate.sh 좀비 in_progress](./2026-03-30-orchestrate-zombie-inprogress.md)

Node 엔진 쪽 stop/비동기 종료 의미 혼동은 아래에 정리되어 있다.

- 참고: [OrchestrateEngine async stop](../architecture/engine-async-stop.md)

## 문제 정의

| 조건 | 태스크 상태 | 판단 |
|------|-------------|------|
| 활성 런/워커 없음, in-flight도 없음 | `in_progress` | **불일치** → reconcile 후보 |
| Graceful stop 직후, 워커가 실제로 아직 실행 중 | `in_progress` | **정상** → reconcile 대상 아님 |
| 엔진 미가동 | `pending` | 큐잉만 된 상태로 해석 가능 (별도 UX/정책) |

핵심은 **`in_progress`는 “어떤 실행 주체가 이 태스크를 맡고 있다”는 암시**이므로, 실행 주체가 없으면 상태를 내려야 한다는 것이다.

## 기대하는 동작 (요구사항 수준)

1. **실행 주체 부재**를 감지할 수 있어야 한다.  
   (예: 활성 오케스트레이션 세션 없음 + 해당 태스크를 담당하는 워커 핸들 없음, 또는 하트비트/리더 잠금 기준의 liveness.)
2. Graceful in-flight와 구분할 수 있어야 한다.  
   **조기에 `stopped`로 내리면** 실제로 돌고 있던 작업과 충돌할 수 있으므로, false positive를 막는 조건이 필수다.
3. 조건이 충족되면 `in_progress` → **`stopped`**(또는 제품 정책에 맞는 종료 상태)로 일괄 또는 개별 정리한다.  
   (`CLAUDE.md` 기준 유효 상태: `pending`, `stopped`, `in_progress`, `reviewing`, `done`, `failed`, `rejected`)

구체적 트리거(타임아웃, 하트비트 주기, “매니저 IDLE + 워커 맵 비어 있음” 등)는 구현 단계에서 엔진/게이트웨이 경계에 맞춰 확정한다.

## 구현 시점 분석

현재 코드 기준으로 이 로직을 넣을 후보 지점은 크게 세 군데다.

### 1) `OrchestrateEngine.stop()` 완료 직후 — **1차 권장 지점**

- 파일: `packages/engine/src/orchestrate/core/orchestrate-engine.ts`
- 근거:
  - 이 함수는 이미 stop 시점에 각 워커에 `abortController.abort()`를 보내고,
    워커 `promise`들을 `await Promise.allSettled(...)`로 기다린 뒤 엔진을 `idle`로 내린다.
  - 즉, **“이 엔진 인스턴스가 알고 있는 in-flight 작업이 모두 끝났는가?”**를 가장 정확히 판단할 수 있는 시점이다.
  - 이 시점 이후에도 DB에 `in_progress`가 남아 있다면, 적어도 **현재 엔진이 붙잡고 있는 작업은 아니다**.

여기에 reconcile을 넣으면 false positive가 가장 적다.  
권장 순서는 다음과 같다.

1. stop 요청으로 새 디스패치를 중단한다.  
2. 현재 워커들 abort 및 settle 대기.  
3. **워커 맵이 완전히 비었는지 확인한다.**  
4. 그 뒤에도 남아 있는 `in_progress`를 `stopped`로 내린다.  
5. 마지막에 엔진/매니저 상태를 `idle`로 publish 한다.

이 순서가 중요한 이유는, **Graceful stop 직후 잠깐 남아 있는 진짜 in-flight**를 잘못 내리지 않기 위해서다.

### 2) `OrchestrateEngine.start()` 초입의 부팅 정리 — **2차 권장 지점**

- 파일: `packages/engine/src/orchestrate/core/orchestrate-engine.ts`
- 현재도 `start()` 초입에서 `cleanupZombies()`를 호출하고 있다.
- 이 지점은 **이전 엔진 프로세스가 비정상 종료되었을 때** 남은 고아 `in_progress`를 회수하는 safety net 역할에 적합하다.

이 지점이 필요한 이유:

- `orchestrate stop` CLI는 `OrchestrationManager.stop()`을 호출하지 않고 **PID에 직접 `SIGTERM`/`SIGKILL`**을 보낸다.
- 따라서 graceful stop 경로를 타지 못하면, 종료 시점 reconcile만으로는 고아 `in_progress`를 모두 정리할 수 없다.
- 결국 **다음 기동 시점의 bootstrap reconcile**이 반드시 필요하다.

다만 이 bootstrap reconcile은 **1차 정리 수단이 아니라 crash-recovery용 2차 안전망**으로 보는 것이 맞다.  
이유는 시작 시점에는 “방금 전 graceful stop의 잔여 in-flight”인지, “진짜 고아 상태”인지에 대한 문맥이 stop 완료 시점보다 약하기 때문이다.

### 3) `OrchestrationManager`의 `idle` 전환 훅 — 보조 관측 지점

- 파일: `packages/engine/src/orchestrate/managers/orchestration-manager.ts`
- `onStatusChanged("idle")` 또는 `stop()` 직후는 **로그/이벤트 발행 시점**으로는 적합하다.
- 하지만 여기서는 엔진 내부 `workers` 맵을 직접 알 수 없어서, **정교한 reconcile 판단을 수행하는 1차 위치로는 부족하다.**

따라서 매니저 계층은:

- reconcile 수행 위치라기보다
- **“reconcile이 끝난 뒤 idle 스냅샷을 외부에 공개하는 지점”**

으로 두는 편이 구조상 맞다.

## 권장 배치

가장 안전한 배치는 아래 두 단계다.

### A. 정상 stop 경로의 즉시 reconcile

- 위치: `OrchestrateEngine.stop()` 내부
- 조건:
  - 새 디스패치 중단 완료
  - 워커 abort 전파 완료
  - 워커 `promise` settle 완료
  - 내부 worker registry 비어 있음
- 액션:
  - 남아 있는 `in_progress`를 `stopped`로 전환
  - 필요하면 reason/event를 남긴다. 예: `engine_stop_reconcile`

이 경로는 **Graceful stop와 충돌하지 않으면서** 가장 빠르게 상태를 현실과 맞출 수 있다.

### B. 다음 start 시의 bootstrap reconcile

- 위치: `OrchestrateEngine.start()` 초입의 `cleanupZombies()` 계열 로직
- 조건:
  - 엔진이 이제 막 기동됨
  - 이전 세션의 active worker 정보가 없음
  - DB에는 `in_progress`가 남아 있음
- 액션:
  - 해당 태스크를 `stopped` 또는 정책상 별도 복구 상태로 전환

이 경로는 **강제 종료, 프로세스 크래시, kill -9, CLI 강제 stop** 이후의 복구를 담당한다.

## 넣지 말아야 할 시점

### 메인 루프 중간 (`mainLoop()`)의 “현재 worker 없음”만 보고 정리

권장하지 않는다.

- 한 턴에서 디스패치 전/후 순간적으로 worker가 0일 수 있다.
- graceful stop, retry 전이, 다음 step 시작 직전 같은 짧은 공백을 고아 상태로 오판할 수 있다.

즉, **“지금 worker가 없다”**는 사실만으로는 reconcile 조건이 충분하지 않다.

### 단순히 매니저 상태가 `idle`이라는 이유만으로 정리

이것도 단독 조건으로는 약하다.

- 현재 구조상 `idle`은 세션 coarse 상태일 뿐이고,
- 실제 워커 정리 완료 여부는 엔진 내부 문맥을 함께 봐야 한다.

## 현재 구현과의 연결점

이미 유사한 훅은 존재한다.

- `OrchestrateEngine.start()`의 `cleanupZombies()`
  - 현재는 시작 시점에 남은 `in_progress`를 `failed`로 내린다.
  - 본 이슈의 요구사항에 맞추려면, 이 로직은 **“고아 `in_progress` 복구”**라는 의미를 더 명시적으로 가져가야 한다.
- `OrchestrateEngine.stop()`
  - 현재는 active worker에 대해서만 `stopped`를 세팅한다.
  - 여기에 **“worker settle 이후 남은 `in_progress` 재검사”**를 추가하는 것이 본 이슈의 주 삽입 지점이다.

정리하면, 이 로직은 **매니저의 coarse 상태 전이 지점이 아니라 엔진의 worker lifecycle 경계**에 넣는 것이 맞다.  
구체적으로는 **`stop()` 완료 직후가 주 지점, `start()` 초입이 보조 안전망**이다.

## 영향

- 대시보드/목록에서 “실행 중”으로 보이나 실제 진행이 없어 **운영 판단이 틀어짐**
- 스케줄러가 `in_progress`를 건너뛰면 **큐 정체** 가능
- 수동 상태 수정 없이는 **자동 복구가 안 됨**

## 관련 문서

- [doc-task-workflow.md](../prd/doc-task-workflow.md) — 상태 전이 개요
- [agent-team-pattern.md](../architecture/agent-team-pattern.md) — 좀비 in_progress 사례 언급

## 상태

- **문제 정의·요구사항 문서화** (본 문서)
- **구현**: 미연결 — reconcile 트리거 및 이중화 방지 전략은 별도 작업으로 추적할 것
