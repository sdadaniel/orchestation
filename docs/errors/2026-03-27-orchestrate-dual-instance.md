# 오케스트레이트 이중 실행 + UI 상태 불일치 (2026-03-27 14:03)

## 요약
오케스트레이트 파이프라인 실행 중 2가지 문제 발견:
1. TASK-252가 done인데 UI에서 in_progress로 표시
2. TASK-257이 pending인데 실행되지 않음

조사 결과 **orchestrate.sh가 2개 인스턴스로 중복 실행**되고 있었고, 추가로 여러 문제가 겹침.

## 발견된 문제

### 1. orchestrate.sh 이중 실행
- PID 91249 (14:02 시작) + PID 45861 (14:07 시작)
- orchestrate.sh에 lock 메커니즘이 있지만(`LOCK_DIR`), 두 번째 인스턴스가 뚫고 들어온 것으로 보임
- 이중 실행 시 같은 태스크를 두 번 dispatch하거나, signal을 두 번 consume하는 경합 발생

### 2. UI 상태 불일치 (TASK-252 done인데 in_progress 표시)
- 태스크 파일: `status: done` ✅
- worktree: 삭제됨 ✅
- 사이드바 UI: `in_progress`로 표시 ❌
- 원인: SSE task-changed 이벤트가 발생했지만 zustand store의 `fetchRequests()`가 debounce에 걸려 갱신이 지연되었거나, 이중 실행 인스턴스가 상태를 덮어씀

### 3. TASK-257 실행 안 됨
- 파일 status: `pending`
- 원인 추정:
  - orchestrate.sh의 RUNNING 배열에 이미 완료된 태스크가 남아있어 슬롯이 꽉 찬 것으로 인식
  - 또는 이중 실행 인스턴스 간 RUNNING 배열이 다르게 관리되어 dispatch 판단이 꼬임
  - MAX_PARALLEL_TASK=2인데 TASK-256이 1슬롯 차지 + 이전 태스크가 정리 안 됨

### 4. TASK-256에 stop-request signal 존재
- `.orchestration/signals/TASK-256-stop-request` 파일이 있음
- 누군가(UI 또는 다른 인스턴스) 중지 요청을 보냈지만, job-task.sh가 아직 실행 중
- stop-request가 처리되지 않은 채 방치 — job-task.sh의 EXIT trap에서만 체크하므로, 실행 중에는 감지 못함

### 5. config.json maxParallel 변경의 하위 호환 문제
- 이전: `"maxParallel": 2` (숫자)
- 현재: `"maxParallel": { "task": 2, "review": 2 }` (객체)
- orchestrate.sh 시작 시점의 config 파싱은 수정했지만, **다른 스크립트나 프론트엔드 코드에서 `maxParallel`을 숫자로 읽는 곳**이 있을 수 있음
- 프론트엔드의 Settings 페이지, orchestrationManager 등에서 이전 형식(`숫자`)을 기대하면 파싱 에러

## 근본 원인

1. **orchestrate.sh lock이 불안정** — LOCK_DIR 기반 lock이 있지만 이중 실행을 못 막음. dev 환경에서 서버 재시작 시 lock이 stale 상태로 남아서 두 번째 인스턴스가 lock을 무시하거나, lock 자체를 획득하지 않는 경로가 있을 수 있음.

2. **UI 갱신 경로의 신뢰성 부족** — SSE debounce + zustand store 비동기 갱신으로 인해 파이프라인의 빠른 상태 전이(pending→in_progress→done)를 UI가 따라가지 못함.

3. **RUNNING 배열 정리 미흡** — signal 처리 후 RUNNING 배열에서 제거하는 타이밍과 다음 dispatch 타이밍 사이에 갭이 있어, 완료된 태스크가 슬롯을 계속 차지.

## 개선안

### 즉시
1. orchestrate.sh 이중 실행 방지 강화 — lock 획득 실패 시 기존 PID 생존 체크 + stale lock 자동 해제
2. maxParallel 하위 호환 — 프론트엔드에서 숫자/객체 모두 처리하도록 방어 코드

### 다음
3. UI 갱신 debounce 축소 (별도 문서 참고: sse-debounce-delay.md)
4. RUNNING 배열 정리를 signal 처리 직후 즉시 수행
5. stop-request를 실행 중에도 주기적으로 체크하는 로직 (현재는 EXIT trap에서만)
