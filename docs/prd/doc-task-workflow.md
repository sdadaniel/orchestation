# Task Workflow — 현재 동작하는 태스크 실행 흐름

> 최종 수정: 2026-03-26

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                 Web Dashboard (:3000)                 │
│  Next.js + zustand + React Query                     │
│                                                      │
│  [Run] → WS-RPC orchestrate.start (/ws/gateway)      │
│  [Stop] → WS-RPC orchestrate.stop (/ws/gateway)      │
│  status polling → GET /api/orchestrate/status (5s)   │
│  tasks polling → GET /api/tasks/watch (5s)           │
└──────────────────┬──────────────────────────────────┘
                   │ spawn
┌──────────────────▼──────────────────────────────────┐
│           orchestration-manager (Node.js)             │
│  - 싱글톤 (globalThis)                                │
│  - reconcileStateWithOS(): kill(pid,0) 기반 상태 동기화│
│  - runId 세대 관리: stale 콜백 무시                    │
│  - stop(): 전체 kill + in_progress → stopped          │
└──────────────────┬──────────────────────────────────┘
                   │ bash spawn
┌──────────────────▼──────────────────────────────────┐
│              orchestrate.sh (감독관)                   │
│                                                      │
│  1. config.json에서 MAX_PARALLEL 핫 리로드             │
│  2. pending/stopped 태스크 스캔 + priority 정렬        │
│  3. 의존성 체크 (deps_satisfied)                       │
│  4. scope 충돌 체크 (scope_not_conflicting)            │
│  5. memory guard (memory_pressure + hard limit)       │
│  6. job-task.sh 디스패치                               │
│  7. signal 감지 (fswatch + polling fallback)           │
│  8. signal별 처리 (아래 상태 머신 참조)                 │
│                                                      │
│  Lock: /tmp/orchestrate.lock/pid                      │
│  Retry: /tmp/orchestrate-retry/TASK-XXX               │
└───────┬─────────────────────────────┬───────────────┘
        │ nohup                       │ nohup
┌───────▼───────┐             ┌───────▼───────┐
│  job-task.sh  │             │ job-review.sh │
│               │             │               │
│ - worktree    │             │ - diff-only   │
│   생성/재사용  │             │ - haiku 모델  │
│ - context     │             │ - 승인/수정요청│
│   builder     │             │   판정        │
│ - claude CLI  │             │ - claude CLI  │
│   1회 호출     │             │   1회 호출     │
│ - signal 생성 │             │ - signal 생성 │
│   task-done   │             │   review-     │
│   task-failed │             │   approved/   │
│               │             │   rejected    │
└───────────────┘             └───────────────┘
```

## 태스크 상태 머신

```
pending ──────────────────────────────┐
  │                                    │
  │ deps OK + slot OK + memory OK      │
  ▼                                    │
in_progress                            │
  │ (job-task.sh 실행 중)              │
  │                                    │
  ├─ task-done signal ──┐              │
  │                      ▼             │
  │              job-review.sh 실행    │
  │                      │             │
  │         ┌────────────┼─────────┐   │
  │         ▼            ▼         │   │
  │    review-approved  review-    │   │
  │         │           rejected   │   │
  │         ▼            │         │   │
  │       merge          │         │   │
  │         │      retry < max?    │   │
  │         ▼       yes │  no │    │   │
  │       done ─────    │     │    │   │
  │                 │   ▼     ▼    │   │
  │                 │ retry  failed│   │
  │                 │   │         │   │
  │                 │   └──► in_progress
  │                 │              │
  ├─ task-failed ──────────► failed│
  │                                │
  ├─ Stop 버튼 ───────────► stopped ──┘
  │                          (다음 Run 시 재실행)
  │
  └─ 비정상 종료 ─────────► stopped
     (orchestrate crash)      (워커도 kill)
```

## 실행 흐름 (step-by-step)

### 1. Run 버튼 클릭

```
브라우저 → WS-RPC orchestrate.start
  → orchestration-manager.start()
    → lock PID 체크 (중복 방지)
    → runId 증가
    → spawn("bash", ["orchestrate.sh"])
    → this.pid 저장
    → status = "running"
```

### 2. orchestrate.sh 메인 루프

```
매 루프:
  1. config.json에서 MAX_PARALLEL 핫 리로드
  2. signal 체크 (실행 중인 태스크들)
     - task-done → job-review.sh 시작 (hard limit 체크)
     - task-failed → failed 처리
     - review-approved → merge + done
     - review-rejected → retry 또는 failed
     - stopped → stopped 처리
  3. pending 태스크 스캔 + 투입
     - deps 충족?
     - scope 충돌?
     - memory_pressure OK?
     - claude hard limit OK?
  4. wait_for_signal (fswatch 또는 2초 poll)
```

### 3. job-task.sh 실행

```
1. 태스크 파일 읽기 + frontmatter 파싱
2. worktree 생성 또는 재사용
3. .claudeignore 생성 (완료 태스크 + orchestrate.sh 제외)
4. 계층형 context 생성:
   - ≤300줄: 전체 임베드
   - 301-800줄: 전체 + 경고
   - >800줄: signature만
5. model-selector로 모델 선택:
   - scope ≤ 1: haiku (키워드 무시)
   - scope ≥ 4: sonnet
6. claude CLI 1회 호출
7. signal 생성 (task-done / task-failed)
8. 프로세스 종료
```

### 4. job-review.sh 실행

```
1. 태스크 파일 + worktree 확인
2. haiku 모델 사용 (경량 리뷰)
3. claude CLI 1회 호출
4. 결과에서 "승인" / "수정요청" 판정
5. signal 생성 (review-approved / review-rejected)
6. 피드백 저장 (review-feedback.txt)
7. 프로세스 종료
```

### 5. Stop 버튼 클릭

```
브라우저 → POST /api/orchestrate/stop
  → orchestration-manager.stop()
    → runId 증가 (stale 콜백 무시)
    → orchestrate.sh kill (process + lock PID)
    → 모든 워커 kill (PID 파일 기반)
    → claude 프로세스 kill
    → in_progress → stopped (파일 수정)
    → lock/signal/PID 파일 정리
    → status = "failed" (exit 130)
```

### 6. 비정상 종료 감지

```
orchestrate.sh가 외부에서 kill됨
  → reconcileStateWithOS()가 감지
    → kill(pid, 0) 실패
    → handleProcessDeath() 호출
    → status = "failed"
    → UI 자동 갱신 (서버 재시작 불필요)
```

## 파일 구조

```
scripts/
  orchestrate.sh          ← 감독관 (스케줄링 + 상태 관리)
  job-task.sh             ← 단발성 태스크 실행
  job-review.sh           ← 단발성 리뷰 실행
  lib/
    common.sh             ← YAML frontmatter 파싱
    signal.sh             ← 원자적 signal 파일 생성/소비
    context-builder.sh    ← 계층형 context + .claudeignore
    model-selector.sh     ← 복잡도 기반 모델 선택
    merge-resolver.sh     ← 머지 충돌 자동 해결
    sed-inplace.sh        ← macOS/Linux 호환 sed

.orchestration/
  tasks/TASK-*.md         ← 태스크 정의 (frontmatter)
  signals/                ← signal 파일 (task-done, review-approved 등)
  output/                 ← 실행 결과, 토큰 로그
  config.json             ← maxParallel, baseBranch 등

/tmp/
  orchestrate.lock/pid    ← 감독관 싱글톤 lock
  orchestrate-retry/      ← retry 카운트 (태스크별)
  worker-TASK-*.pid       ← 워커 PID 파일

src/frontend/src/lib/
  orchestration-manager.ts ← Node.js 싱글톤 (spawn, stop, reconcile)
```

## Source of Truth

| 항목 | 진실 | 이유 |
|------|------|------|
| orchestrate 실행 여부 | OS PID 생존 (`kill(pid, 0)`) | 메모리 변수는 거짓말할 수 있음 |
| 태스크 상태 | `.orchestration/tasks/TASK-*.md` frontmatter | 파일이 유일한 영속 상태 |
| 워커 실행 여부 | `/tmp/worker-TASK-*.pid` + `kill(pid, 0)` | PID 파일만으로 부족, 생존 확인 필요 |
| 비용 | `.orchestration/output/token-usage.log` | claude CLI가 직접 기록 |
