# Known Issues — Orchestration 운영 중 발견된 문제

> 작성일: 2026-03-26
> 상태: 분석 완료, 수정 대기

---

## 1. orchestrate.sh 중복 실행

**증상**: orchestrate.sh가 여러 개 동시에 뜸 (4개까지 확인됨)

**원인**:
- orchestration-manager가 status를 "completed"로 바꿔서 UI에서 Run을 또 누를 수 있음
- lock 파일의 stale 감지가 이전 프로세스를 죽은 것으로 오판
- orchestration-manager가 spawn한 프로세스와 실제 orchestrate.sh의 생존 여부가 동기화 안 됨

**영향**: 같은 태스크가 중복 실행, 슬롯 초과, 예측 불가 상태

**수정 방향**:
- orchestration-manager가 process 객체로 생존 여부를 직접 추적
- Run 버튼은 `this.process !== null`일 때 비활성화
- lock 파일 stale 감지를 orchestration-manager 레벨에서도 수행

---

## 2. orchestration-manager status와 실제 상태 불일치

**증상**: 프로세스를 kill했는데 UI에 "Running..." 계속 표시

**원인**:
- orchestration-manager의 status는 메모리 내 변수
- 외부에서 프로세스를 kill하면 `proc.on("close")` 콜백이 안 탈 수 있음
- 서버 재시작 전까지 stale 상태 유지

**영향**: UI가 실제 상태를 반영하지 않음, Stop이 안 먹는 것처럼 보임

**수정 방향**:
- status 폴링 API에서 `this.process`의 실제 생존 여부를 매번 확인
- 프로세스가 죽었으면 status를 즉시 갱신
- `getStatus()` 호출 시 `kill -0` 체크 추가

---

## 3. Stop 후 "Stopping..." 무한 대기

**증상**: Stop 누르면 "Stopping..."이 오래 표시되거나 안 풀림

**원인**:
- orchestrate.sh가 여러 개 있으면 하나만 죽고 나머지가 살아있음
- orchestration-manager가 하나의 process 객체만 추적하므로 나머지를 모름
- UI의 isStopping은 status가 "running"이 아닐 때 풀리는데, 다른 인스턴스가 살아있으면 안 풀림

**영향**: UX 불량, 강제 새로고침 필요

**수정 방향**:
- 문제 1 해결(중복 실행 방지)이 선행
- Stop 시 `pgrep -f orchestrate.sh`로 전체 kill
- 타임아웃 추가: 10초 후에도 안 죽으면 SIGKILL + UI 강제 갱신

---

## 4. 좀비 in_progress 태스크 반복 발생

**증상**: 워커가 죽었는데 태스크 status가 in_progress로 남음

**원인**:
- orchestrate.sh의 cleanup_lock이 정상 종료 시에만 원복
- 외부 kill이나 OOM으로 죽으면 trap이 안 탐
- orchestration-manager의 stop()이 orchestrate.sh만 죽이고 워커는 방치 → 워커가 끝나도 signal을 처리할 orchestrate가 없음

**현재 대응**: orchestration-manager constructor에서 서버 시작 시 좀비 정리

**수정 방향**:
- 서버 시작 시 정리 (구현됨 ✅)
- 추가: status API 호출 시에도 좀비 감지 실행 (주기적)
- 워커 완료 signal이 남아있으면 자동 처리

---

## 5. Monitor에서 워커 수와 실제 실행 수 불일치

**증상**: Running 4인데 Monitor에 워커 2개만 표시

**원인**:
- Running N은 in_progress 태스크 수 (좀비 포함)
- Monitor 워커 수는 실제 PID 파일 + 프로세스 생존 기준
- 좀비 태스크가 있으면 숫자가 안 맞음

**수정 방향**:
- 문제 4 해결(좀비 제거)로 자연스럽게 해결
- Running 뱃지도 PID 생존 기반으로 카운트 변경 검토

---

## 6. MAX_PARALLEL 초과 실행

**증상**: MAX_PARALLEL=3인데 claude 프로세스 4개 실행

**원인**:
- task-done → review 시작, review-rejected → retry 시작 시 `can_dispatch()` 체크 없이 바로 실행

**현재 대응**: review/retry 시작 전 hard limit 체크 추가 (수정됨 ✅)

**잔여 리스크**:
- orchestrate.sh 중복 실행 시 각 인스턴스가 독립적으로 슬롯 관리 → 합산 초과 가능
- 문제 1 해결이 선행되어야 완전 해결

---

## Stop 동작 정의 (확정)

### Run 페이지 Stop 버튼

**즉시 전체 종료. graceful 없음.**

```
1. orchestrate.sh kill (SIGTERM → SIGKILL)
2. 모든 워커 kill (job-task.sh, job-review.sh, claude --dangerously-skip-permissions)
3. in_progress 태스크 → stopped 상태 변경
4. signal 파일 / lock 파일 / PID 파일 전부 정리
5. worktree + 브랜치는 유지 (삭제하지 않음)
```

**다음 Run 시 동작**:
- stopped 태스크는 orchestrate.sh가 pending과 동일하게 큐에 넣음 (기존 로직)
- worktree가 남아있으면 `ensure_worktree()`에서 재사용
- 브랜치에 이전 커밋이 있으면 이어서 작업 가능

### Task 상세 Stop 버튼

**해당 워커만 즉시 종료.**

```
1. 해당 태스크의 워커 프로세스만 kill
2. 해당 태스크 → stopped 상태 변경
3. orchestrate.sh는 유지 (다른 태스크 계속 진행)
4. worktree + 브랜치 유지
```

### 비정상 종료 (crash, OOM, SIGKILL)

```
1. trap이 잡으면: 워커 kill + in_progress → stopped + 정리
2. trap이 안 잡히면: 서버 재시작 시 orchestration-manager constructor에서 좀비 정리
```

---

## 수정 구현 계획

### 1단계: orchestration-manager stop() 재구현

```typescript
stop() {
  // 1) orchestrate.sh kill
  killProcessGracefully(this.process);

  // 2) 모든 워커 kill (pgrep 기반)
  execSync('pkill -f "job-task.sh|job-review.sh" 2>/dev/null || true');
  execSync('pkill -f "claude.*--dangerously-skip-permissions" 2>/dev/null || true');

  // 3) in_progress → stopped (파일 시스템 직접 수정)
  // cleanupZombies()와 유사하지만 stopped로 변경

  // 4) lock/signal/PID 정리
  execSync('rm -rf /tmp/orchestrate.lock /tmp/orchestrate-retry /tmp/worker-TASK-*.pid');

  // 5) status 즉시 반영
  this.state.status = "failed";
  this.state.finishedAt = new Date().toISOString();
  this.process = null;
}
```

### 2단계: orchestration-manager run() 중복 방지 강화

```typescript
run() {
  // process 객체 + pgrep 이중 체크
  if (this.process !== null) return error;

  const existing = execSync('pgrep -f orchestrate.sh 2>/dev/null || true');
  if (existing.trim()) return error;

  // ... spawn
}
```

### 3단계: getStatus() 실시간 동기화

```typescript
getStatus() {
  // process 객체가 있는데 실제로 죽어있으면 → 즉시 갱신
  if (this.process && this.process.exitCode !== null) {
    this.state.status = "failed";
    this.process = null;
  }
  return this.state.status;
}
```

---

---

## 7. 서버 재시작 시 cleanupZombies가 실행 중인 워커를 좀비로 오판

**증상**: 서버 재시작하면 실제로 돌고 있는 태스크가 stopped로 바뀜

**원인**:
- cleanupZombies()가 PID 파일로 워커 생존 확인
- 서버 재시작 시 이전 orchestrate.sh가 만든 PID 파일이 남아있을 수도 있고 없을 수도 있음
- PID 파일이 없으면 "워커 없음" → 좀비로 판정 → stopped
- 하지만 실제로는 워커가 살아있을 수 있음 (PID 파일만 정리된 상태)

**수정 방향**:
- cleanupZombies()에서 PID 파일뿐 아니라 `pgrep -f "job-task.sh TASK-XXX"`로 실제 프로세스 확인
- 프로세스가 살아있으면 좀비가 아님 → in_progress 유지

---

## 8. exit code 1로 실행 실패 반복

**증상**: Run 누르면 즉시 "실행 실패 (exit code: 1)"

**가능한 원인**:
- git working tree가 dirty (uncommitted 변경)
- orchestrate.sh의 `git commit --only`가 실패
- `set -euo pipefail`로 인해 스크립트 전체 종료

**수정 방향**:
- `start_task()`의 git commit에 `|| true` 추가하여 dirty tree에서도 진행
- 또는 commit 전에 working tree 상태 체크

---

## 9. Run 후 즉시 종료되는 문제 (exit code 0)

**증상**: Run 누르면 시작했다가 즉시 종료 (exit code 0)

**원인**:
- lock 파일이 남아있으면 "이미 실행 중" → exit 0
- stale lock 감지가 PID 파일 기반인데 PID 파일이 정리된 상태면 오판

**현재 대응**: stale lock 감지 + 서버 시작 시 lock 정리 (구현됨)

---

## 10. 워커(claude)가 orchestrate.sh를 실행하는 문제

**증상**: orchestrate.sh가 죽은 뒤 갑자기 다시 살아남. 4개까지 중복 실행됨.

**원인**:
- 워커(claude)가 태스크 수행 중 worktree 안에 있는 orchestrate.sh를 발견하고 실행
- worktree 경로(`repo-wt-task-190/scripts/orchestrate.sh`)에서 실행되므로 main repo의 lock과 경로가 다름
- 워커를 죽이지 않으면 계속 재실행

**영향**:
- orchestrate.sh 중복 실행 (lock 경로 불일치로 싱글톤 깨짐)
- worktree 기준으로 실행되어 태스크 파일 경로 불일치 가능
- 워커를 죽여야만 멈출 수 있음

**수정 방향**:
- job-task.sh 프롬프트에 "orchestrate.sh, run-pipeline.sh를 실행하지 마라" 제약 추가
- 또는 worktree의 scripts/ 디렉토리를 .claudeignore에 추가
- 또는 orchestrate.sh 첫 줄에서 실행 경로가 main repo인지 체크

---

## 11. 서버 재시작 없이 UI 상태(Running/에러) 리셋 안 됨

**증상**: 비정상 종료 후 UI에 "Running... 4", "실행 실패 (exit code: 128)" 계속 표시. 새로고침해도 유지.

### 아키텍처 배경

```
브라우저 → GET /api/orchestrate/status → orchestration-manager.getState()
                                          ↑
                                     서버 메모리 (singleton)
                                          ↑
                             this.state = { status, exitCode, ... }
                             this.process = ChildProcess | null
```

- `orchestration-manager`는 Node.js 서버 프로세스의 메모리에 싱글톤으로 존재
- `this.state.status`는 메모리 변수 — 파일이나 DB가 아님
- 브라우저 새로고침 = API 재호출일 뿐, 서버 메모리는 안 바뀜

### 상태가 꼬이는 5가지 시나리오

**시나리오 A — 외부 kill로 proc.on("close") 누락**
```
1. run() → this.process = spawn(orchestrate.sh)
2. this.state.status = "running"
3. 외부에서 pkill orchestrate.sh (또는 OOM kill)
4. Node.js의 proc.on("close") 콜백이 호출될 수도 있고 안 될 수도 있음
   - process group kill (-pid)이면 Node.js 자체는 살아있으므로 close 이벤트 발생 가능
   - 하지만 타이밍에 따라 stdout pipe가 먼저 끊기면서 에러 발생 가능
5. close 콜백이 안 타면: this.state.status = "running" 유지, this.process는 여전히 non-null
6. getStatus()의 보정 로직:
   - this.process.exitCode !== null → 체크하지만, kill된 프로세스의 exitCode가
     Node.js에 반영되는 타이밍이 비동기적 → 즉시 null이 아닐 수 있음
   - this.process.killed → SIGTERM/SIGKILL을 Node.js API로 보낸 경우만 true
     외부 pkill은 Node.js가 모르므로 killed = false
7. 결과: status = "running" 무한 유지
```

**시나리오 B — stop()의 killProcessGracefully 타이밍**
```
1. stop() 호출 → killProcessGracefully(this.process)
2. killProcessGracefully는 SIGTERM 보내고 5초 후 SIGKILL 예약 (setTimeout)
3. stop()은 즉시 this.state.status = "failed" 설정 ← OK
4. 하지만 proc.on("close") 콜백이 나중에 타면서 status를 다시 덮어쓸 수 있음:
   - code=128 → status = "failed" (중복이지만 exitCode가 다를 수 있음)
   - code=0 → status = "completed" (stop했는데 completed로 바뀜!)
5. 결과: stop 후 status가 예측 불가능하게 변동
```

**시나리오 C — 워커가 orchestrate.sh를 재실행 (문제 10번)**
```
1. stop() → orchestrate.sh kill → status = "failed"
2. 워커(claude)가 worktree에서 orchestrate.sh를 spawn
3. 이 프로세스는 this.process가 아님 → manager가 모름
4. getStatus()에서 this.process = null, status = "failed" → 보정 안 함
5. 하지만 실제로는 orchestrate.sh가 돌고 있음
6. Run 누르면 lock PID 체크에서 차단될 수도, 안 될 수도 (worktree 경로 lock)
7. 결과: UI는 "failed"인데 실제로는 실행 중 → 불일치
```

**시나리오 D — HMR(Hot Module Replacement)에서 싱글톤 중복**
```
1. globalThis.__orchestrationManager__로 싱글톤 유지
2. 코드 변경 → HMR → 모듈 재로딩
3. globalThis에 이전 인스턴스가 남아있음 → 재사용 (의도된 동작)
4. 하지만 이전 인스턴스의 this.process가 이미 죽은 프로세스를 가리킬 수 있음
5. getStatus()가 죽은 process의 exitCode를 체크하지만 타이밍 이슈로 놓침
6. 결과: HMR 후 stale 상태 유지
```

**시나리오 E — 서버 프로세스 자체 재시작 (npm run dev)**
```
1. 서버 kill → 새 서버 시작
2. constructor의 cleanupZombies() 실행 → in_progress 태스크 정리
3. 하지만 this.state는 새로 초기화 → status = "idle" ← 이건 OK
4. 문제: cleanupZombies가 살아있는 워커를 오판할 수 있음 (문제 7번)
5. 결과: 서버 재시작은 상태를 리셋하지만 부작용 가능
```

### 현재 getStatus() 보정 로직의 한계

```typescript
getStatus(): OrchestrationStatus {
  // 체크 1: process.exitCode !== null || process.killed
  //   한계: 외부 kill 시 exitCode 반영 타이밍이 비동기적
  //   한계: 외부 pkill은 killed = false

  // 체크 2: process 없는데 running이면 보정
  //   한계: process가 null이 아닌데 죽어있는 경우를 못 잡음
  //   이게 시나리오 A의 핵심
}
```

**빠진 체크**: `this.process.pid`가 실제로 살아있는지 OS 레벨 확인

### 제안 수정

```typescript
getStatus(): OrchestrationStatus {
  if (this.state.status === "running" && this.process) {
    // 1) Node.js 레벨 체크 (기존)
    if (this.process.exitCode !== null || this.process.killed) {
      this.handleProcessDeath("exitCode/killed 감지");
      return this.state.status;
    }

    // 2) OS 레벨 체크 (신규) — 실제 프로세스 생존 확인
    if (this.process.pid) {
      try {
        process.kill(this.process.pid, 0); // signal 0 = 생존 확인만
      } catch {
        // ESRCH = 프로세스 없음 → 죽었는데 Node.js가 모르는 상태
        this.handleProcessDeath("OS 레벨 프로세스 사라짐");
        return this.state.status;
      }
    }
  }

  // 3) process 없는데 running (기존)
  if (this.state.status === "running" && !this.process && !this.launching) {
    this.handleProcessDeath("process 객체 없음");
  }

  return this.state.status;
}

private handleProcessDeath(reason: string) {
  this.appendLog(`[orchestrate] 프로세스 종료 감지: ${reason}`);
  this.state.status = "failed";
  this.state.finishedAt = new Date().toISOString();
  this.state.exitCode = this.state.exitCode ?? 1;
  this.process = null;
  this.saveRunHistory();
}
```

### 추가로 필요한 수정

**stop() 후 close 콜백 충돌 방지**:
```typescript
private stopped = false;

stop() {
  this.stopped = true;
  // ... kill logic ...
  this.state.status = "failed";
}

// proc.on("close") 내부:
proc.on("close", (code) => {
  if (this.stopped) return; // stop()이 이미 상태 설정함 → 덮어쓰기 방지
  // ... 기존 로직 ...
});
```

### Trade-off

| 방법 | 장점 | 단점 |
|------|------|------|
| process.kill(pid, 0) | OS 레벨 정확한 생존 확인 | 매 API 호출마다 syscall 1회 (무시 가능 수준) |
| stopped 플래그 | close 콜백 충돌 방지 | 플래그 관리 복잡도 증가 |
| 주기적 healthcheck interval | 폴링 없이도 감지 | setInterval 추가 = 리소스 |

**권장**: process.kill(pid, 0) + stopped 플래그. 가장 확실하고 부작용 적음.

---

## 우선순위별 수정 순서

| 순위 | 문제 | 상태 |
|------|------|------|
| 1 | orchestrate.sh 중복 실행 방지 | ✅ 수정됨 (run에서 pgrep 이중 체크) |
| 2 | orchestration-manager status 동기화 | ✅ 수정됨 (getStatus에서 process 생존 확인) |
| 3 | Stop 즉시 전체 종료 | ✅ 수정됨 (kill all + stopped + 정리) |
| 4 | 좀비 in_progress 정리 | ✅ 수정됨 (서버 시작 시 + stop 시) |
| 5 | Monitor/Running 카운트 정합성 | ✅ 좀비 제거로 해결 |
| 6 | MAX_PARALLEL 초과 | ✅ review/retry hard limit 추가 |
| 7 | 서버 재시작 시 워커 오판 | ❌ 미수정 — pgrep으로 실제 프로세스 확인 필요 |
| 8 | dirty tree에서 git commit 실패 | ❌ 미수정 — commit에 || true 또는 사전 체크 필요 |
| 9 | stale lock으로 Run 즉시 종료 | ⚠️ 부분 수정 — 서버 시작 시 정리는 됨 |
| 10 | 워커가 orchestrate.sh 실행 | ❌ 미수정 — 프롬프트 제약 또는 .claudeignore 필요 |
| 11 | 서버 재시작 없이 UI 상태 리셋 안 됨 | ❌ 미수정 — getStatus()에서 kill -0 체크 필요 |
