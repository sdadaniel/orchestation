# orchestrate.sh가 태스크를 in_progress로 전환 후 실제 작업 없이 방치하는 문제 (2026-03-30)

## 요약
orchestrate.sh(PID 77066)가 금요일(3/28)부터 60시간 이상 실행 중이었으나, TASK-270과 TASK-273이 `in_progress` 상태에서 실제 claude CLI 작업이 진행되지 않고 좀비 상태로 방치됨.

## 증상
- TASK-270(핵심 파서 유틸리티 단위 테스트 작성), TASK-273(파서 모듈 중복 코드 통합 및 일관성 개선)이 `in_progress` 상태로 고정
- orchestrate.sh 프로세스는 살아있으나(PID 77066, 2일 14시간 경과), 자식 프로세스(PID 81624)가 방금 생성된 직후 claude CLI를 spawn하지 못함
- 별도로 실행된 claude 세션(PID 76204, ttys014)이 금요일부터 열려있었으나 orchestrate.sh와 무관한 독립 프로세스(PPID 75748 ≠ 77066)
- 해당 태스크의 실행 로그 파일(TASK-270*.log, TASK-273*.log)이 존재하지 않음

## 코드 레벨 문제점

### 문제 1: status 전환과 job dispatch 사이에 검증 없음
`start_task()` (orchestrate.sh:383-426)에서 **status를 in_progress로 변경하고 git commit까지 한 뒤** job-task.sh를 실행한다. 하지만 job-task.sh 실행 성공 여부를 확인하지 않는다.

```bash
# :383-388 — 먼저 status 변경 + commit
sed_inplace_E "s/^status: (pending|stopped)/status: in_progress/" "$tf"
git -C "$REPO_ROOT" add "$tf"
git -C "$REPO_ROOT" commit --only "$tf" -m "chore(${task_id}): status → in_progress" || true

# :414-425 — 그 다음 job 실행 (실패해도 status는 이미 in_progress)
nohup bash "${REPO_ROOT}/scripts/job-task.sh" "${task_id}" "${SIGNAL_DIR}" "${feedback_arg}" \
  > "${log_file}" 2>&1 &
local pid=$!
echo "$pid" > "/tmp/worker-${task_id}.pid"
```

**문제**: `nohup ... &`는 백그라운드 실행이므로, job-task.sh가 즉시 죽어도 `$!`에는 PID가 찍히고 `start_task()`는 성공으로 리턴된다. status는 이미 in_progress로 커밋된 상태.

### 문제 2: process_signals_for_task가 "시그널 파일 없음 = 진행 중"으로 판단
`process_signals_for_task()` (orchestrate.sh:481-598)에서 시그널 파일(task-done, task-failed 등)을 체크한 뒤, 아무것도 없으면 `return 2` (진행 중)를 리턴한다.

```bash
# :598
return 2  # 아직 진행 중
```

**문제**: job-task.sh가 시작도 안 됐거나 즉시 죽어서 시그널 파일을 생성하지 못하면, orchestrate.sh는 영원히 "아직 진행 중"이라고 판단한다. **실제 프로세스가 살아있는지 확인하는 로직이 없다.**

### 문제 3: PID 파일 기반 liveness 체크 부재
`start_task()`에서 `/tmp/worker-${task_id}.pid` 파일에 PID를 기록하지만, `process_signals_for_task()`에서 이 PID가 실제로 살아있는지(`kill -0 $pid`) 확인하지 않는다. PID 파일만 있고 프로세스가 죽은 상태를 감지할 수 없다.

### 문제 4: cleanup 트리거 조건의 한계
cleanup_lock (orchestrate.sh:80-100)은 EXIT/INT/TERM 시그널에만 반응한다.

```bash
trap cleanup_lock EXIT INT TERM
```

**문제**: orchestrate.sh가 정상적으로 루프를 돌고 있는 한(죽지 않는 한), cleanup은 절대 발동하지 않는다. 메인 루프가 30초마다 sleep하며 "새 태스크 대기"를 반복해도, 이미 in_progress인 태스크는 QUEUE에 안 들어가고(`pending`/`stopped`만 큐잉), RUNNING 배열에서도 `return 2`로 계속 유지되므로 **영구 교착 상태**가 된다.

### 문제 5: 메인 루프의 "대기 중" 판단 오류
메인 루프 (orchestrate.sh:793-800)에서 RUNNING이 비어있고 QUEUE도 비어있으면 "새 태스크 대기"로 30초 sleep한다.

```bash
if [ "${#RUNNING[@]}" -eq 0 ] && [ "${#QUEUE[@]}" -eq 0 ]; then
    echo "  ⏳ 새 태스크 대기 중... (30초마다 스캔)"
    sleep 30
    continue
fi
```

**문제**: in_progress 태스크는 RUNNING에 들어있으므로 이 분기에 해당하지 않지만, 만약 RUNNING 배열과 실제 프로세스 상태가 불일치하면(프로세스는 죽었는데 RUNNING에 남아있으면) 빈 슬롯이 없다고 판단하여 새 태스크도 투입하지 못한다.

## 근본 원인 요약

```
start_task()에서 status를 in_progress로 변경 + commit
        ↓
nohup job-task.sh & 실행 (실패해도 감지 불가)
        ↓
job-task.sh가 claude spawn 실패 → 시그널 파일 미생성
        ↓
process_signals_for_task()에서 시그널 없음 → return 2 (진행 중)
        ↓
PID liveness 체크 없음 → 프로세스 죽은 것 감지 불가
        ↓
cleanup은 orchestrate.sh 종료 시에만 발동
        ↓
∞ 교착: in_progress 상태로 영구 잠김
```

**핵심**: 시그널 파일 기반 상태 관리는 "job이 정상 시작되어 시그널을 생성한다"는 전제에 의존하는데, job이 시작 자체에 실패하면 이 전제가 깨진다.

## 영향
- 2개 태스크가 60시간+ 동안 in_progress 상태로 잠김
- 다른 워커가 해당 태스크를 건너뛰므로 작업 큐 병목 발생
- 사용자가 수동으로 발견하기 전까지 자동 복구 불가

## 프로세스 증거

```
# orchestrate.sh — 2일 14시간 경과, 자식 프로세스는 1초 전 생성
PID   PPID  STAT ELAPSED       COMMAND
77066 76918 S    02-14:30:03   bash orchestrate.sh
81624 77066 S    00:01         bash orchestrate.sh  (자식, claude spawn 실패)

# 독립 claude 세션 — orchestrate와 무관
76204 75748 R+   (금요일부터)  claude   (PPID ≠ 77066)

# 태스크 로그 부재
TASK-270*.log → 없음
TASK-273*.log → 없음
```

## 재발 방지 제안

### 단기 — ✅ 구현 완료
1. **job dispatch 직후 PID liveness 체크**: `start_task()`에서 `nohup ... &` 후 0.3초 대기하고 `kill -0 $pid`로 프로세스가 살아있는지 확인. 죽었으면 즉시 status를 pending으로 원복 → `orchestrate.sh:689-703`
2. **process_signals_for_task에 PID 생존 확인 추가**: 시그널 파일이 없을 때 PID가 실제로 살아있는지 + PID 재사용 검증(프로세스 명령어 확인) → `orchestrate.sh:888-927`

### 중기 — ✅ 구현 완료 (2026-04-02)
3. **in_progress 타임아웃**: `INPROGRESS_TIMEOUT` (기본 1800초=30분) 추가. start 파일 epoch 또는 로그 파일 mtime 중 최신 기준으로 경과 시간 체크. 타임아웃 시 워커 프로세스 kill 후 failed 처리 → `orchestrate.sh:process_signals_for_task` 내 타임아웃 체크 블록. `config.json`의 `inProgressTimeout`으로 조정 가능.
4. **상태 전이 로깅**: job-task.sh가 시작 시 `${SIGNAL_DIR}/${TASK_ID}-start`에 epoch 타임스탬프 기록 (기존 구현 활용)

### 장기 — 미구현
5. **heartbeat 기반 liveness 체크**: orchestrate.sh가 주기적으로(예: 5분) heartbeat 파일을 갱신하고, 대시보드 또는 별도 watchdog이 heartbeat 갱신이 멈추면 알림 발송
6. **프로세스 트리 검증**: orchestrate.sh가 job을 dispatch한 후, 실제 claude 프로세스가 자식 트리에 존재하는지 확인하는 로직 추가
