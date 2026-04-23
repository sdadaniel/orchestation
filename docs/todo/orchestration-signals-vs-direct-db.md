# 오케스트레이션: 시그널 파일 vs DB 직접 갱신

> 작성일: 2026-04-19  
> 관련 코드: `src/frontend/src/lib/paths.ts` (`SIGNALS_DIR`), `src/frontend/src/engine/core/signal-handler.ts`, `src/frontend/src/engine/core/orchestrate-engine.ts` (`mainLoop` → `processSignals`), `src/frontend/src/engine/ops/signal.ts`, `src/frontend/src/engine/jobs/job-task.ts`, `src/frontend/src/engine/jobs/job-review.ts`

---

## 1. 현재 동작 요약

| 구분 | 설명 |
|------|------|
| 태스크 생성 | **처음부터 SQLite(`task-store`)**에 기록됨. 시그널 파일이 먼저 생기는 구조가 아님. |
| 시그널 파일 | 워커(잡)가 **완료·실패·리뷰 결과** 등을 알릴 때 `${taskId}-${suffix}` 형태로 `.orchestration/signals/`에 생성. |
| DB 반영 | **`OrchestrateEngine.mainLoop`**가 주기적으로 **`processSignals`**를 호출하고, **`signal-handler.ts`의 `handleSignal`** 등에서 `updateTaskStatus` 등으로 SQLite 갱신 후 파일 삭제. |

즉, 시그널은 **“잡 종료 이벤트”를 엔진에 넘기는 채널**이고, **스케줄링·목록 조회는 여전히 DB**를 본다.

---

## 2. 파일 기반을 쓰는 이유(설계상 장점)

- 워커와 엔진이 **프로세스로 분리**돼도 구현이 단순하고, **추가 인프라(큐·Redis 등) 없음**.
- **쉘/레거시 스크립트**와 동일한 계약(`signal.sh` 포팅 등)을 맞추기 쉬움.
- `rename` 등으로 **원자적 이벤트** 표현 가능.

---

## 3. 한계·비용

- **폴링 지연**: `mainLoop` 간격(기본 3초)만큼 DB 반영이 늦을 수 있음.
- **복잡도**: 시그널 디렉터리 생명주기(`start`에서 생성, `stop`에서 삭제, 처리 후 `unlink` 등) 유지 필요.
- **동일 Node 프로세스**에서 잡이 돌아가는 현재 구조라면, 이론상 **시그널 없이 잡 완료 시점에 DB만 갱신**하는 것도 가능.

---

## 4. 후보 리팩터(시그널 제거 또는 축소)

**아이디어:** `job-task` / `job-review` 완료 시 `signalCreate` 대신(또는 추가로) **`handleSignal`과 동일한 규칙으로 `task-store`를 직접 호출**하거나, 공통 모듈 `completeTaskFromJobResult(...)` 한 곳으로 모은다.

**주의:**

- 머지·리뷰 재시도·비용 한도 등 **`handleSignal`에 모인 분기**를 중복 없이 옮겨야 함.
- 나중에 잡을 **별도 프로세스**로 뺀다면 다시 **HTTP·큐·파일** 같은 채널이 필요할 수 있음.

---

## 5. TODO

- [ ] “시그널 유지 vs DB 직접 갱신” 중 **팀 결정** (성능·운영·멀티프로세스 로드맵).
- [ ] 직접 갱신으로 갈 경우: **`signal-handler`의 상태 전환 로직**을 잡 완료 경로 또는 공유 함수로 **이전**하고, `processSignals`는 제거 또는 축소.
- [ ] 유지할 경우: `mainLoop` 주기·`fs.watch` 역할을 주석/문서로 **의도 명시** (이미 `orchestrate-engine.ts`에 일부 주석 있음).

---

## 6. 참고 한 줄

시그널 파일은 **아키텍처상 필수는 아니나**, 현재 코드베이스에서는 **잡 완료 → DB 반영**의 핵심 연결 고리로 쓰이고 있음.
