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

## 우선순위별 수정 순서

| 순위 | 문제 | 의존 관계 | 난이도 |
|------|------|----------|--------|
| 1 | orchestrate.sh 중복 실행 방지 | 없음 (근본 원인) | 중간 |
| 2 | orchestration-manager status 동기화 | 1번 선행 | 중간 |
| 3 | Stop/Stopping 정상화 | 1, 2번 선행 | 낮음 |
| 4 | 좀비 in_progress 주기적 정리 | 서버 시작 시 정리는 완료 | 낮음 |
| 5 | Monitor/Running 카운트 정합성 | 4번 선행 | 낮음 |
| 6 | MAX_PARALLEL 초과 (잔여) | 1번 선행 | 낮음 |

**1번(중복 실행 방지)이 해결되면 2~6번은 대부분 자연스럽게 해결되거나 난이도가 크게 낮아짐.**
