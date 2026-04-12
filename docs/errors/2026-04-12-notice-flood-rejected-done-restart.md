# 오류: rejected/done 태스크 재시작 → NOTICE 파일 43,494개 폭발

## 발생일
2026-04-12 (야간 오케스트레이션 실행 중)

## 증상
- `.orchestration/notices/` 폴더에 `NOTICE-10000` ~ `NOTICE-53493`까지 **43,494개** 파일 생성
- TASK-333, TASK-343 실패 notice가 번갈아 반복 생성
- `git status` 출력이 수만 줄로 불어남
- TASK-333, TASK-343 파일이 staged/unstaged 양쪽에서 수정됨 (status 충돌)

## 근본 원인

### 버그: 종료된 태스크를 `in_progress`로 재시작

커밋 상태:
- TASK-333: `status: rejected`
- TASK-343: `status: done`

오케스트레이션 엔진이 재실행되면서 두 태스크를 `in_progress`로 덮어씀. 이미 완료/거절된 태스크를 재시작하는 로직이 `rejected`, `done` 상태를 터미널 상태로 취급하지 않은 것이 원인.

### 루프 구조

```
[엔진 재시작]
  → TASK-333 status: rejected → in_progress (버그)
  → TASK-343 status: done    → in_progress (버그)
       ↓
  태스크 실행 실패
       ↓
  markTaskFailed() 호출
  → status: failed
  → postNotice("error", ...) → NOTICE 파일 생성
  → cleanupWorktreeAndBranch()
       ↓
  다음 루프 tick (~3초)
  → 태스크 다시 in_progress로 재시작 (버그 반복)
       ↓
  ← 무한 반복 →
```

### 체인 (시간순)

| 시각 | 이벤트 |
|------|--------|
| 04:29 | 오케스트레이션 엔진 재시작 |
| 04:29 | TASK-333(rejected), TASK-343(done) → in_progress 재시작 |
| 04:29~07:56 | 약 3.5시간 동안 실패 루프 반복, NOTICE 43,494개 생성 |
| 07:56 | 좀비 정리(cleanupZombies)가 stopped으로 변경 |

## 관련 코드

**`src/frontend/src/lib/orchestrate-engine.ts`**

```typescript
// markTaskFailed — 실패할 때마다 notice 생성
private markTaskFailed(taskId: string, reason: string) {
  this.setTaskStatus(taskId, "failed");
  this.cleanupWorktreeAndBranch(taskId);
  this.postNotice("error", `${taskId} 실패`, `**${taskId}:** ${reason}`);
  this.stopDependents(taskId);
  this.emit("task-result", { taskId, status: "failure" });
}
```

`rejected`, `done` 상태를 재시작 대상에서 제외하는 가드가 누락되어 있었음.

## 정리 작업

1. `find .orchestration/notices -name "NOTICE-*.md" -delete` — 43,494개 untracked 파일 삭제
2. `git rm --cached -r .orchestration/notices/` — 104개 git-tracked notice 파일 index에서 제거
3. `.gitignore`에 `.orchestration/notices/` 추가 — 재발 시 git 추적 방지
4. TASK-333, TASK-343 파일을 HEAD 상태로 restore — `rejected`/`done` 복원

## 재발 방지

### 즉시 조치 (완료)
- `.orchestration/notices/` → `.gitignore` 추가

### 필요한 코드 수정 (미완료 — 별도 태스크 권고)
오케스트레이션 엔진의 태스크 시작 로직에 터미널 상태 가드 추가 필요:

```typescript
const TERMINAL_STATUSES = ["done", "rejected", "failed"];

// 태스크 시작 전 체크
if (TERMINAL_STATUSES.includes(task.status)) {
  this.log(`  ⚠️  ${taskId} 이미 종료된 상태(${task.status}), 재시작 skip`);
  return;
}
```

### 추가 권고
- notice 생성 시 동일 taskId에 대한 중복 방지 (예: 같은 태스크 실패는 1회만 notice)
- 오케스트레이션 루프 상태 파일에 "last_error_count" 추적하여 급증 시 자동 중단
