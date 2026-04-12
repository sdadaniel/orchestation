# 오류: mergeAndDone 루프 → NOTICE 파일 43,494개 폭발

## 발생일
2026-04-12 (야간 오케스트레이션 실행 중)

## 증상
- `.orchestration/notices/` 폴더에 `NOTICE-10000` ~ `NOTICE-53493`까지 **43,494개** 파일 생성
- TASK-333 실패 notice, TASK-343 실패 notice가 번갈아 반복 생성
- TASK-333 파일에 `chore(TASK-333): status → done` 커밋이 **131번** 중복 생성
- `git status` 출력이 수만 줄로 불어남

## 트리거

2026-04-10 커밋 `57a8b088`에서 TASK-333의 status를 `done` → `in_progress`로 수동 재설정.
이후 오케스트레이션이 재시작되면서 두 버그가 맞물려 루프 발생.

## 근본 원인 (버그 2개)

### 버그 1: `runMergeTask()` — done 상태 중복 실행 방어 없음

`merge-utils.ts`의 `runMergeTask()`는 호출 시 현재 태스크 상태를 확인하지 않음.
이미 `done`인 태스크에 대해 재호출되면 다시 `updateStatusToDone()` 실행 → 중복 커밋.

**코드 경로:**
```
handleSignal("task-done") → mergeAndDone() → runMergeTask()
                                          ↑ 재호출 시 상태 체크 없음
```

### 버그 2: `runMergeTask()` — stash가 다른 태스크 상태 파일 덮어씀

merge 전 `git stash push --include-untracked`로 working directory 전체를 stash.
이 시점에 다른 태스크들의 `setTaskStatus()`가 수정한 파일들도 stash에 포함됨.
merge 완료 후 `git stash pop`으로 복원될 때 이미 `done`으로 커밋된 태스크 파일이
stash 시점의 `in_progress` 값으로 되돌아감.

**루프 사이클:**
```
TASK-333 done 커밋
  → stash pop으로 TASK-333 파일이 in_progress로 복원
  → cleanupZombies(): in_progress → stopped
  → 다음 루프 tick: stopped 태스크 재실행
  → 완료 → done 커밋 (← 반복)
```

## 관련 코드

**`src/frontend/src/lib/merge-utils.ts`**

```typescript
// [버그 1] 현재 status 확인 없이 바로 실행
export async function runMergeTask(taskId, onLog) {
  const { data } = parseFrontmatter(raw);
  const branch = getString(data, "branch");
  // currentStatus === "done" 인지 확인 안 함!
  ...
  updateStatusToDone(taskFile, taskId); // 중복 호출 가능
}

// [버그 2] 전체 stash — 다른 태스크 파일 포함
execSync(`git stash push -m "merge-${taskId}" --include-untracked`);
// merge 완료 후
execSync(`git stash pop`); // 다른 태스크의 in_progress 복원됨
```

## 수정 내용 (`src/frontend/src/lib/merge-utils.ts`)

### 버그 1 수정: done 상태 조기 반환

```typescript
const currentStatus = getString(data, "status");
if (currentStatus === "done") {
  log("ℹ️ 이미 done 상태 — 스킵");
  return true;
}
```

### 버그 2 수정: stash 제거

stash를 완전히 제거. merge conflict는 기존 `resolveMergeConflict()`가 처리.
stash가 없으면 다른 태스크 상태 파일을 건드리지 않음.

## 정리 작업 (2026-04-12)

1. NOTICE 파일 43,494개 전부 삭제
2. git-tracked NOTICE 파일 104개 index에서 제거
3. `.gitignore`에 `.orchestration/notices/` 추가 (재발 시 git 추적 방지)
4. TASK-333, TASK-343 파일을 HEAD 상태로 restore

## 재발 방지

- `.orchestration/notices/` → `.gitignore` 추가 (완료)
- `runMergeTask()` done 상태 가드 추가 (완료)
- stash 제거 (완료)
