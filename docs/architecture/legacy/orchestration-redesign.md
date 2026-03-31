# Orchestration 재설계: Subagent-like Architecture

## 1. 핵심 문제

| 문제 | 원인 | 영향 |
|------|------|------|
| 메모리 폭발 | claude 프로세스 3개 상주 (각 2-4GB) | 시스템 불안정, OOM |
| 비용 과다 | review가 task와 동일 모델/context | 불필요한 토큰 소비 |
| worker 비대 | task+review+retry가 하나의 long-running 프로세스 | 리소스 장기 점유 |
| context 낭비 | worktree 전체 접근 가능 | Claude가 불필요한 파일 탐색 |

---

## 2. 기존 vs 개선 구조

### 기존: Long-running Worker

```
orchestrate.sh (스케줄러 + 폴링)
  │
  ├─ run-worker.sh TASK-A ──────────────────────────┐
  │   claude CLI (상주)                              │
  │   for retry in 0..MAX:                          │ 프로세스 수명
  │     task 실행 → review 실행 → 실패 시 재시도      │ = 5~30분
  │   done                                          │
  │   signal 생성                                    │
  ├──────────────────────────────────────────────────┘
  │
  ├─ run-worker.sh TASK-B (동일 구조)
  ├─ run-worker.sh TASK-C (동일 구조)
  └─ sleep 2 폴링 루프
```

- claude 프로세스 3개 동시 상주
- 각 worker가 내부에서 retry 루프
- review도 task와 동일 비용

### 개선: 단발성 Job

```
orchestrate.sh (스케줄러 + 이벤트 루프)
  │
  │  ── Phase 1: Task 실행 ──
  ├─ job-task.sh TASK-A → claude 1회 호출 → 종료 → signal
  ├─ job-task.sh TASK-B → claude 1회 호출 → 종료 → signal
  │
  │  ── Phase 2: Review (signal 수신 후) ──
  ├─ job-review.sh TASK-A → claude 1회 (diff only, haiku) → 종료 → signal
  │
  │  ── Phase 3: Retry (orchestrator 판단) ──
  ├─ job-task.sh TASK-A → claude 1회 (feedback 포함) → 종료 → signal
  │
  └─ merge → done
```

- claude 프로세스 = 실행 중인 job 수만큼 (끝나면 즉시 해제)
- retry는 orchestrator가 관리
- review는 경량 모델 + diff-only

---

## 3. 수치 비교

| 항목 | 기존 | 개선 | 절감 |
|------|------|------|------|
| 동시 claude 프로세스 | 3개 상주 | 1-2개 (job 단위) | -60% |
| 피크 메모리 | ~9GB (3×3GB) | ~3GB (1-2×1.5GB) | -66% |
| Review 비용 | task의 70-100% | task의 10-20% | -80% |
| Worker 수명 | 5-30분 | 1-5분 (job당) | -80% |
| Context 크기 | worktree 전체 | scope 파일만 임베드 | -50%+ |

---

## 4. 상태 머신

```
pending
  │ deps OK + slot OK
  ▼
task_running ──실패──→ failed
  │ 성공                  ↑
  ▼                      │ retry ≥ max
review_running            │
  │        │              │
  │ 승인    │ 수정요청 ────┤
  ▼        ▼              │
done    retry_pending ────┘
          │ retry < max
          ▼
        task_running (재투입)
```

---

## 5. 컴포넌트 분리

### 기존: 2개 스크립트

| 파일 | 줄수 | 역할 |
|------|------|------|
| orchestrate.sh | ~560 | 스케줄링 + 상태관리 + 머지 |
| run-worker.sh | ~340 | task + review + retry 루프 |

### 개선: 4개 스크립트

| 파일 | 예상 줄수 | 역할 |
|------|----------|------|
| orchestrate.sh | ~300 | 스케줄링 + 상태전이 + retry 관리 + 머지 |
| job-task.sh | ~80 | claude 1회 호출 (task 실행) → signal → 종료 |
| job-review.sh | ~60 | claude 1회 호출 (diff-only review) → signal → 종료 |
| lib/context-builder.sh | 기존 유지 | scope 임베드 프롬프트 생성 |

---

## 6. 핵심 개선 상세

### 6-1. Review 경량화

```
기존: worktree 전체 접근 + sonnet
  → context: ~50K tokens, 비용: ~$0.15/review

개선: diff + 태스크 정의만 + haiku
  → context: ~5K tokens, 비용: ~$0.01/review
```

```bash
# job-review.sh 핵심 로직
DIFF=$(git diff "${BASE_BRANCH}..HEAD" -- ${SCOPE_FILES})
PROMPT="## 태스크 정의\n${TASK_CONTENT}\n\n## diff\n${DIFF}\n\n판정하라."
echo "$PROMPT" | claude --model claude-haiku-4-5 --dangerously-skip-permissions
```

### 6-2. Worktree 조건부 생성

| scope 크기 | worktree | 이유 |
|-----------|----------|------|
| ≤ 2 파일 | 미생성 (main 직접) | 충돌 낮음, 오버헤드 불필요 |
| ≥ 3 파일 | 생성 | 병렬 수정 충돌 방지 |
| glob 포함 (`**`) | 생성 | 범위 불확정 |

### 6-3. Heavy/Light 분류

| | Light | Heavy |
|--|-------|-------|
| 기준 | scope ≤ 2, simple keywords | scope ≥ 3, complex keywords |
| 모델 | haiku | sonnet |
| worktree | 없음 | 생성 |
| 예상 시간 | 30초-1분 | 2-5분 |
| 예상 메모리 | ~500MB | ~1.5GB |

### 6-4. 스케줄링: Slot + Memory Guard 하이브리드

**Slot만으로 안 되는 이유**: claude 프로세스의 메모리 사용량은 선형이 아니라 burst 형태.
2개 job이 동시에 시작되면 순간 피크가 slot 예측치를 초과할 수 있다.

```
[AS-IS]  slot 합산만 체크 → 3개 동시 시작 → 순간 피크 9GB → OOM

[TO-BE]  slot 체크 + 실제 메모리 체크 + 시작 간격 강제
         → 메모리 80% 이상이면 slot 여유 있어도 대기
```

```bash
# orchestrate.sh 내 디스패치 전 체크
can_dispatch() {
  # 1) slot 체크 (기존)
  if (( $(echo "$USED_SLOTS >= $MAX_SLOTS" | bc) )); then return 1; fi

  # 2) 실제 메모리 체크
  local mem_pressure
  mem_pressure=$(memory_pressure_pct)  # macOS: memory_pressure | grep percentage
  if [ "$mem_pressure" -gt 80 ]; then
    echo "  ⏸️ 메모리 압박 ${mem_pressure}% → 대기"
    return 1
  fi

  # 3) 마지막 job 시작 후 최소 5초 간격 (burst 방지)
  local now=$(date +%s)
  if (( now - LAST_DISPATCH_TIME < 5 )); then return 1; fi

  return 0
}

memory_pressure_pct() {
  # macOS
  local pct=$(memory_pressure 2>/dev/null | grep -o '[0-9]*%' | head -1 | tr -d '%')
  echo "${pct:-0}"
}
```

**Trade-off**: 시작 간격 5초로 throughput이 약간 감소하지만, OOM으로 전체가 죽는 것보다 안전.
메모리 여유 시 간격을 2초로 줄이는 adaptive 로직도 가능.

### 6-5. Context: 계층형 접근 (임베드 + Fallback)

**전부 임베드의 문제점**:
- 큰 파일(1000줄+)은 토큰 폭발
- 의존 파일을 scope에 안 넣으면 논리가 깨짐
- retry 시 동일 context 반복 전송

**계층형 context 전략**:

```
Layer 1 (항상 포함):  태스크 정의 + scope 파일 시그니처 (import/export, 함수 선언부)
Layer 2 (조건 포함):  scope 파일 전체 내용 (파일당 500줄 이하만)
Layer 3 (fallback):   500줄 초과 파일 → Claude에게 직접 읽게 허용 (worktree 필요)
```

```bash
build_layered_prompt() {
  local task_file="$1" scope_files="$2"
  local prompt total_lines=0

  prompt="## 태스크\n$(cat "$task_file")\n\n## 작업 대상 파일\n\n"

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ ! -f "$f" ] && continue
    local lines=$(wc -l < "$f")
    total_lines=$((total_lines + lines))

    if [ "$lines" -le 500 ]; then
      # Layer 2: 전체 임베드
      prompt+="### ${f} (${lines}줄)\n\`\`\`\n$(cat "$f")\n\`\`\`\n\n"
    else
      # Layer 1: 시그니처만 임베드
      prompt+="### ${f} (${lines}줄 — 시그니처만)\n\`\`\`\n"
      prompt+="$(grep -n -E '^(export|import|function|class|interface|type |const |def |async )' "$f" | head -50)\n"
      prompt+="\`\`\`\n⚠️ 이 파일은 크므로 필요 시 직접 읽어라.\n\n"
    fi
  done <<< "$scope_files"

  # 토큰 안전장치: 총 임베드가 80K 문자 초과 시 경고
  if [ "$total_lines" -gt 2000 ]; then
    prompt+="\n⚠️ 총 ${total_lines}줄 임베드됨. scope 파일에 집중하고 불필요한 탐색을 하지 마라.\n"
  fi

  echo "$prompt"
}
```

**Retry 시 context 최적화**:
- 1차: 전체 scope 파일 포함
- 2차+: 리뷰 피드백 + 수정 필요 파일만 포함 (줄인 context)

### 6-6. Worktree: 영향도 기반 판단

**파일 수 기준의 문제**: `shared/utils.ts` 1개 수정이 `page1.css` + `page2.css` 2개 수정보다 충돌 위험이 높다.

```
[AS-IS]  scope ≤ 2 → worktree 없음
[TO-BE]  영향도 점수 기반 판단
```

| 조건 | 점수 | 이유 |
|------|------|------|
| scope에 shared/, lib/, utils/, core/ 경로 포함 | +3 | 공유 파일은 충돌 확률 높음 |
| scope에 config, package.json, tsconfig 포함 | +3 | 전역 설정 변경 |
| scope에 `**` glob 포함 | +2 | 범위 불확정 |
| scope 파일 수 | +파일수 | 기본 가중치 |
| 현재 병렬 실행 중인 job 없음 | -5 | 충돌 대상 자체가 없음 |

**판단**: 점수 ≥ 3 → worktree 생성, 점수 < 3 → main 직접

```bash
calc_worktree_score() {
  local task_file="$1" score=0
  local scope=$(get_list "$task_file" "scope")
  local file_count=$(echo "$scope" | grep -c '[^ ]' || echo 0)

  score=$file_count

  # 공유 경로 체크
  if echo "$scope" | grep -qE '(shared/|lib/|utils/|core/|common/)'; then
    score=$((score + 3))
  fi
  # 전역 설정 체크
  if echo "$scope" | grep -qE '(config|package\.json|tsconfig)'; then
    score=$((score + 3))
  fi
  # glob 체크
  if echo "$scope" | grep -q '\*\*'; then
    score=$((score + 2))
  fi
  # 병렬 job 없으면 감점
  if [ "${#RUNNING[@]}" -eq 0 ]; then
    score=$((score - 5))
  fi

  echo "$score"
}

needs_worktree() {
  local score=$(calc_worktree_score "$1")
  [ "$score" -ge 3 ]
}
```

---

## 7. Signal: Polling → Event-driven 하이브리드

**1초 polling의 한계**:
- 태스크 50개면 매초 signal 디렉토리 스캔 → 불필요한 I/O
- signal 생성과 소비 사이 race condition 가능
- 반응 지연 최대 1초 (대부분 불필요한 대기)

**개선: fswatch + polling fallback**

```bash
# macOS: fswatch 사용 (inotifywait 대체)
# Linux: inotifywait 사용

wait_for_signal() {
  if command -v fswatch &>/dev/null; then
    # event-driven: signal 파일 생성 즉시 감지
    fswatch -1 --event Created "$SIGNAL_DIR" --timeout 10
  elif command -v inotifywait &>/dev/null; then
    inotifywait -q -t 10 -e create "$SIGNAL_DIR" 2>/dev/null
  else
    # fallback: polling (도구 없을 때만)
    sleep 2
  fi
}

# 메인 루프
while true; do
  process_signals        # 도착한 signal 전부 처리
  dispatch_if_possible   # 빈 슬롯에 job 투입
  wait_for_signal        # 다음 signal까지 블록 (최대 10초)
done
```

**Race condition 방지**: 기존 signal.sh의 atomic mkdir lock은 유지.
fswatch는 "깨우기" 역할만, 실제 소비는 signal_consume()이 보장.

**Trade-off**: fswatch/inotifywait 의존성 추가. 없으면 기존 polling으로 fallback하므로 안전.

---

## 8. Retry: 실패 유형별 Adaptive 전략

**기존 문제**: 모든 실패를 동일하게 retry → 같은 실패 반복, 토큰 낭비

### 실패 유형 분류

| 유형 | 감지 방법 | retry 전략 |
|------|----------|-----------|
| **task_error** | job-task.sh exit code ≠ 0 | 1회 retry (다른 결과 나올 가능성 낮음) |
| **review_rejected** | review 결과에 "수정요청" | max 2회 retry (feedback 포함) |
| **merge_conflict** | git merge 실패 | merge-resolver.sh 시도 → 실패 시 즉시 failed |
| **timeout** | job이 제한시간 초과 | retry 없음 → 즉시 failed (scope 문제) |
| **oom_kill** | 프로세스 비정상 종료 | retry 없음 → heavy로 재분류 후 단독 실행 |

### signal 파일에 실패 유형 기록

```bash
# job-task.sh 종료 시
signal_create "$SIGNAL_DIR" "$TASK_ID" "failed" "task_error"
# → .orchestration/signals/TASK-XXX-failed 파일 내용: "task_error"

# job-review.sh 종료 시
signal_create "$SIGNAL_DIR" "$TASK_ID" "failed" "review_rejected"
```

### orchestrator의 retry 판단

```bash
handle_failure() {
  local task_id="$1"
  local fail_type=$(cat "${SIGNAL_DIR}/${task_id}-failed" 2>/dev/null)
  local retry_count=$(get_retry_count "$task_id")

  case "$fail_type" in
    review_rejected)
      if [ "$retry_count" -lt 2 ]; then
        increment_retry "$task_id"
        requeue_task "$task_id"  # feedback 포함하여 재투입
      else
        mark_failed "$task_id" "review retry 상한 초과"
      fi
      ;;
    task_error)
      if [ "$retry_count" -lt 1 ]; then
        increment_retry "$task_id"
        requeue_task "$task_id"
      else
        mark_failed "$task_id" "task 실행 반복 실패"
      fi
      ;;
    timeout|oom_kill)
      mark_failed "$task_id" "${fail_type} — retry 불가"
      ;;
    *)
      mark_failed "$task_id" "알 수 없는 실패: ${fail_type}"
      ;;
  esac
}
```

### Retry context 최적화

```
1차 시도: 전체 scope 파일 포함
2차 시도: 리뷰 피드백 + 지적된 파일만 포함 (context 축소)
3차 시도: 없음 (2회가 최대)
```

**효과**: 불필요한 retry 제거로 토큰 30-50% 절감. timeout/OOM은 retry해도 같은 결과이므로 즉시 중단.

---

## 9. 실행 흐름 (최종)

```
1. orchestrate.sh 시작
2. pending 태스크 스캔 → priority 정렬
3. 각 태스크:
   ├─ deps 충족? → NO → skip
   ├─ scope 충돌? → YES → skip
   ├─ can_dispatch()? (slot + 메모리 + 간격) → NO → 대기
   ├─ needs_worktree()? (영향도 점수) → 조건부 생성
   └─ YES → classify(light/heavy) → job-task.sh 실행
4. wait_for_signal (fswatch 또는 poll 2초)
5. signal 처리:
   ├─ task-done → job-review.sh 실행 (diff-only, haiku)
   ├─ task-failed → handle_failure (유형별 판단)
   │    ├─ review_rejected + retry OK → 재투입 (축소 context)
   │    ├─ task_error + retry OK → 재투입
   │    └─ timeout/oom/retry 초과 → failed + stop_dependents
   ├─ review-approved → merge + done
   └─ stopped → stopped 처리
6. 2로 돌아가기
```

---

## 10. 마이그레이션 계획

| 단계 | 작업 | 영향 | 동시 수정 (프론트엔드) |
|------|------|------|---------------------|
| 1 | run-worker.sh → job-task.sh + job-review.sh 분리 | 구조 변경의 핵심 | useMonitor interval 10s + visible 조건 |
| 2 | retry를 orchestrate.sh로 이동 + 실패 유형 분류 | 상태 머신 + adaptive retry | store 자동 폴링 제거, SSE backoff |
| 3 | review 경량화 (diff-only + haiku) | 비용 80% 절감 | tasks/[id] 중복 interval 제거 |
| 4 | memory guard + dispatch 간격 도입 | OOM 방지 | SSE 타임아웃, node-pty idle kill |
| 5 | 계층형 context (임베드 + fallback) | 토큰 절감 + 정확도 유지 | 파서 TTL 캐시 |
| 6 | worktree 영향도 판단 + fswatch 도입 | 디스크 I/O + 반응속도 | — |

각 단계는 독립적으로 배포 가능. 1→2가 가장 중요 (구조 변경의 핵심).

---

## 11. Production Hardening — 실패 시나리오 & 구조적 해결

### 11-1. Memory Guard의 실제 한계와 해결

**실패 시나리오**: memory_pressure가 70%일 때 can_dispatch()가 통과시킴.
job-task.sh가 claude를 실행하는 순간 burst로 2GB 할당 → 95%로 뛰면서 기존 job도 같이 OOM kill.

**근본 원인**: memory_pressure는 _이미 할당된 후_의 결과. 예방이 아니라 사후 감지.

**해결: 예약 기반 메모리 관리**

```bash
# 프로세스 시작 전에 "예약"하고, 예약 합계로 판단
RESERVED_MB=0
MEMORY_LIMIT_MB=8192  # 시스템 RAM의 50%로 설정

reserve_memory() {
  local task_type="$1"  # heavy=2048, light=768
  local needed_mb
  case "$task_type" in
    heavy)  needed_mb=2048 ;;
    light)  needed_mb=768 ;;
    review) needed_mb=512 ;;
  esac

  local projected=$((RESERVED_MB + needed_mb))
  if [ "$projected" -gt "$MEMORY_LIMIT_MB" ]; then
    echo "  ⏸️ 메모리 예약 초과 (현재:${RESERVED_MB}MB + 요청:${needed_mb}MB > 한계:${MEMORY_LIMIT_MB}MB)"
    return 1
  fi

  # 실제 메모리도 체크 (예약 모델과 현실 괴리 방지)
  local actual_used_mb=$(ps -A -o rss= | awk '{s+=$1} END {print int(s/1024)}')
  if [ "$((actual_used_mb + needed_mb))" -gt "$MEMORY_LIMIT_MB" ]; then
    echo "  ⏸️ 실제 메모리 부족 (사용:${actual_used_mb}MB + 요청:${needed_mb}MB)"
    return 1
  fi

  RESERVED_MB=$projected
  return 0
}

release_memory() {
  local task_type="$1"
  case "$task_type" in
    heavy)  RESERVED_MB=$((RESERVED_MB - 2048)) ;;
    light)  RESERVED_MB=$((RESERVED_MB - 768)) ;;
    review) RESERVED_MB=$((RESERVED_MB - 512)) ;;
  esac
  [ "$RESERVED_MB" -lt 0 ] && RESERVED_MB=0
}
```

**추가 안전장치: 순차 시작 (staggered start)**

```bash
# can_dispatch() 개선: 간격을 고정 5초가 아니라 부하 비례로
dispatch_interval() {
  local running=${#RUNNING[@]}
  if [ "$running" -eq 0 ]; then echo 0     # 아무것도 없으면 즉시
  elif [ "$running" -eq 1 ]; then echo 3    # 1개 실행 중이면 3초
  else echo 8                                # 2개 이상이면 8초
  fi
}
```

**Trade-off**: 예약 모델은 실제 사용량과 괴리 가능. 그래서 예약 + 실제 메모리 이중 체크.
보수적 예약값(heavy=2GB)으로 설정해서 과소평가보다 과대평가가 낫다.

---

### 11-2. 계층형 Context가 실패하는 케이스와 보강

**실패 시나리오 1 — signature 부족**:
`utils/format.ts`의 signature에 `export function formatDate(...)` 만 보임.
Claude가 수정 시 내부 로직(timezone 처리)을 모르고 호환성 깨는 코드 작성.

**실패 시나리오 2 — hidden dependency**:
scope에 `page.tsx`만 있지만 실제로는 `useCustomHook.ts`를 import.
hook의 반환 타입이 바뀌면 page가 깨지는데 Claude는 hook을 볼 수 없음.

**해결: import chain 자동 추출 + 선택적 포함**

```bash
# scope 파일의 1-depth import를 자동으로 context에 추가
extract_deps() {
  local scope_files="$1"
  local deps=""

  while IFS= read -r f; do
    [ -z "$f" ] || [ ! -f "$f" ] && continue
    # import/require 문에서 로컬 파일 경로 추출
    grep -oE "(from|require\()\s*['\"]\.\.?/[^'\"]+['\"]" "$f" 2>/dev/null \
      | sed "s/.*['\"]//;s/['\"]//g" \
      | while read -r imp; do
          # 상대경로 → 절대경로 변환
          local dir=$(dirname "$f")
          local resolved=$(cd "$dir" && realpath "$imp.ts" 2>/dev/null || realpath "$imp.tsx" 2>/dev/null || realpath "$imp/index.ts" 2>/dev/null || echo "")
          [ -n "$resolved" ] && [ -f "$resolved" ] && echo "$resolved"
        done
  done <<< "$scope_files" | sort -u

}

build_layered_prompt_v2() {
  local task_file="$1" scope_files="$2"

  # 1) scope 파일의 1-depth 의존성 추출
  local deps=$(extract_deps "$scope_files")

  # 2) scope 파일 = Layer 2 (전체 임베드, 500줄 이하)
  # 3) deps 파일 = Layer 1.5 (signature + 수정 대상 함수 주변 ±10줄)
  # 4) 500줄 초과 = Layer 3 (fallback)

  # deps는 signature만 포함하되, scope에서 사용하는 함수는 본문까지
  # → grep으로 scope에서 호출하는 함수명 추출 → deps에서 해당 함수 ±10줄 포함
}
```

**Retry context 개선**:

```
1차: scope 전체 + deps signature
2차: 리뷰 피드백에서 언급된 파일만 전체 + 나머지 signature
     (피드백 파싱: grep -oE '[a-zA-Z/]+\.(ts|tsx|js)' feedback.txt)
3차: 없음
```

**Trade-off**: import chain 추출은 정규식 기반이라 dynamic import나 barrel export 놓칠 수 있음.
하지만 90%의 케이스를 커버하므로 signature-only보다 훨씬 안전.

---

### 11-3. Worktree 판단: 안전 기본값 전환

**실패 시나리오**: TASK-A가 `page.tsx` 수정 (점수 1, worktree 없음).
TASK-B도 같은 `page.tsx`를 import하는 `layout.tsx` 수정 (점수 1, worktree 없음).
둘 다 main에서 직접 작업 → git conflict는 아니지만 런타임 호환성 깨짐 (silent corruption).

**근본 문제**: 정적 점수 시스템으로는 _실행 시점의 동적 충돌_을 예측할 수 없다.

**해결: 기본값을 "항상 worktree"로 뒤집기**

```
[AS-IS]  점수 < 3 → main 직접 (위험)
[TO-BE]  기본 = worktree, 예외적으로 skip

worktree 생략 조건 (모두 충족해야 함):
  1. 현재 병렬 실행 중인 job이 0개
  2. scope에 glob 없음
  3. scope 파일이 다른 pending task의 scope와 겹치지 않음
```

```bash
skip_worktree() {
  local task_id="$1" task_file="$2"

  # 조건 1: 병렬 job 없음
  [ "${#RUNNING[@]}" -gt 0 ] && return 1

  # 조건 2: glob 없음
  local scope=$(get_list "$task_file" "scope")
  echo "$scope" | grep -q '\*\*' && return 1

  # 조건 3: 다른 pending task의 scope와 겹치지 않음
  local my_files=$(echo "$scope" | sort)
  for pending_id in "${QUEUE[@]}"; do
    [ "$pending_id" = "$task_id" ] && continue
    local pf=$(find_file "$pending_id")
    [ -z "$pf" ] && continue
    local other_files=$(get_list "$pf" "scope" | sort)
    # 교집합 체크
    if [ -n "$(comm -12 <(echo "$my_files") <(echo "$other_files"))" ]; then
      return 1
    fi
  done

  return 0  # 모든 조건 충족 → worktree 생략 가능
}
```

**Trade-off**: worktree 생성 비용(~1초, ~50MB 디스크)은 silent corruption 대비 무시할 수준.
병렬 job 0개일 때만 skip하므로 실질적 오버헤드 최소.

---

### 11-4. Signal Race Condition 구체적 시나리오와 해결

**시나리오 1 — 이벤트 누락**:
fswatch가 블록 중 → 동시에 TASK-A-done과 TASK-B-done 생성 →
fswatch -1은 첫 번째만 감지하고 리턴 → TASK-B-done은 다음 루프까지 대기.

**시나리오 2 — signal 생성과 소비 사이 간극**:
job이 signal 파일 생성 중(mv 직전) → orchestrator가 디렉토리 스캔 → 파일 못 봄 →
다음 스캔까지 대기(최대 10초).

**시나리오 3 — 중복 소비**:
orchestrator가 signal 처리 중 SIGTERM → 재시작 → 같은 signal 재처리 → 이중 머지.

**해결: scan-after-wake + idempotent 처리**

```bash
# 깨어난 후 항상 전체 스캔 (이벤트 누락 방지)
main_loop() {
  while true; do
    # 1) 전체 signal 스캔 (fswatch 결과가 아닌 디렉토리 전체)
    local signals=()
    for sig_file in "$SIGNAL_DIR"/*-done "$SIGNAL_DIR"/*-failed "$SIGNAL_DIR"/*-stopped; do
      [ -f "$sig_file" ] && signals+=("$sig_file")
    done

    # 2) 각 signal을 atomic하게 소비 (mkdir lock)
    for sig_file in "${signals[@]}"; do
      local task_id=$(basename "$sig_file" | sed 's/-[^-]*$//')
      if signal_consume "$SIGNAL_DIR" "$task_id"; then
        process_signal "$task_id" "$sig_file"  # idempotent 처리
      fi
      # signal_consume 실패 = 다른 프로세스가 이미 소비 → skip
    done

    # 3) dispatch
    dispatch_if_possible

    # 4) 대기 (fswatch는 "깨우기"만, 실제 처리는 위의 스캔)
    wait_for_signal
  done
}
```

**Idempotent 머지 보장**:

```bash
process_done_task() {
  local task_id="$1"
  # 이미 done이면 skip (재시작 후 중복 처리 방지)
  local current_status=$(get_status "$task_id")
  [ "$current_status" = "done" ] && return 0

  # 머지 전에 브랜치 존재 확인
  local branch=$(get_branch "$task_id")
  if ! git rev-parse --verify "$branch" &>/dev/null; then
    echo "  ⚠️ ${task_id}: 브랜치 없음 (이미 머지됨?) → skip"
    return 0
  fi

  # ... 머지 로직 ...
}
```

---

### 11-5. Retry 분류 오판과 방어

**실패 시나리오 — 오분류**:
Claude가 문법 에러 코드를 생성 → job-task.sh는 exit 0 (Claude 호출 자체는 성공) →
review에서 reject → `review_rejected`로 분류 → retry 2회 → 같은 문법 에러 반복.

**실패 시나리오 — context 축소 역효과**:
1차에서 전체 scope로 80% 완성했지만 리뷰 reject.
2차에서 피드백 파일만 보내니 1차의 작업 맥락을 잃어 더 나쁜 코드 생성.

**해결: retry 시 diff 포함 + 반복 감지**

```bash
requeue_task() {
  local task_id="$1"
  local retry_count=$(get_retry_count "$task_id")

  # 이전 시도의 diff를 피드백에 포함 (맥락 유지)
  local prev_diff=""
  local wt=$(get_worktree "$task_id")
  if [ -d "$wt" ]; then
    prev_diff=$(git -C "$wt" diff "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "")
  fi

  local feedback_file="$OUTPUT_DIR/${task_id}-review-feedback.txt"

  # retry용 합성 피드백 생성
  cat > "$OUTPUT_DIR/${task_id}-retry-context.txt" <<RETRY_EOF
## 이전 시도 (#${retry_count})의 변경 내용
\`\`\`diff
${prev_diff}
\`\`\`

## 리뷰어 피드백
$(cat "$feedback_file" 2>/dev/null || echo "(피드백 없음)")

## 지시
위 diff는 이전 시도이다. 리뷰 피드백을 반영하여 수정하라.
이전 코드를 기반으로 개선할 것. 처음부터 다시 작성하지 마라.
RETRY_EOF

  # context는 축소하지 않음 — 전체 scope 유지 + retry context 추가
  set_status "$task_id" "task_queued"
}
```

**반복 실패 감지**:

```bash
# 연속 2회 동일한 review 피드백이면 → 사람 개입 필요
detect_repeated_failure() {
  local task_id="$1"
  local fb1="$OUTPUT_DIR/${task_id}-review-feedback-1.txt"
  local fb2="$OUTPUT_DIR/${task_id}-review-feedback-2.txt"

  [ ! -f "$fb1" ] || [ ! -f "$fb2" ] && return 1

  # 유사도 체크 (단순 diff 기반)
  local diff_lines=$(diff "$fb1" "$fb2" | grep -c '^[<>]' || echo 999)
  if [ "$diff_lines" -lt 5 ]; then
    echo "  ⚠️ ${task_id}: 동일 피드백 반복 → retry 중단, 사람 개입 필요"
    mark_failed "$task_id" "반복 실패 (동일 피드백)"
    return 0
  fi
  return 1
}
```

---

### 11-6. 시스템 레벨 병목 분석 & 해결

**병목 1 — orchestrator CPU**:
매 루프마다 get_task_ids()가 find + awk + sort 실행.
pending 태스크 50개면 매 루프 ~100ms 소비. 문제는 안 되지만 더 커지면 bottleneck.

```bash
# 해결: 태스크 목록 캐싱 (signal 수신 시에만 갱신)
TASK_CACHE=""
TASK_CACHE_DIRTY=true

invalidate_task_cache() { TASK_CACHE_DIRTY=true; }

get_task_ids_cached() {
  if $TASK_CACHE_DIRTY; then
    TASK_CACHE=$(get_task_ids)
    TASK_CACHE_DIRTY=false
  fi
  echo "$TASK_CACHE"
}
# signal 처리 후 invalidate_task_cache 호출
```

**병목 2 — git worktree 생성/삭제**:
worktree add는 ~1초, remove는 ~0.5초. 동시에 3개 생성하면 git lock 경합.

```bash
# 해결: worktree 풀 (미리 생성해두고 재사용)
WORKTREE_POOL_DIR="$REPO_ROOT/.worktree-pool"
POOL_SIZE=3

init_worktree_pool() {
  mkdir -p "$WORKTREE_POOL_DIR"
  for i in $(seq 1 $POOL_SIZE); do
    local wt="$WORKTREE_POOL_DIR/slot-${i}"
    local br="pool/slot-${i}"
    if [ ! -d "$wt" ]; then
      git -C "$REPO_ROOT" worktree add "$wt" -b "$br" "$BASE_BRANCH" 2>/dev/null || true
    fi
  done
}

acquire_worktree() {
  local task_id="$1" branch="$2"
  for i in $(seq 1 $POOL_SIZE); do
    local lock="$WORKTREE_POOL_DIR/slot-${i}.lock"
    if mkdir "$lock" 2>/dev/null; then
      local wt="$WORKTREE_POOL_DIR/slot-${i}"
      git -C "$wt" checkout -B "$branch" "$BASE_BRANCH" 2>/dev/null
      echo "$task_id" > "$lock/owner"
      echo "$wt"
      return 0
    fi
  done
  return 1  # 풀 소진 → 대기
}

release_worktree() {
  local wt="$1"
  local slot_dir=$(dirname "$wt")
  local lock="${wt}.lock"
  git -C "$wt" checkout "$BASE_BRANCH" 2>/dev/null
  git -C "$wt" clean -fd 2>/dev/null
  rm -rf "$lock"
}
```

**병목 3 — signal 파일 I/O**:
signal 디렉토리에 처리 완료된 파일이 쌓이면 ls/glob 느려짐.

```bash
# 해결: 처리 완료 signal을 archive로 이동
archive_signal() {
  local sig_file="$1"
  mkdir -p "$SIGNAL_DIR/archive"
  mv "$sig_file" "$SIGNAL_DIR/archive/" 2>/dev/null || rm -f "$sig_file"
}
```

**병목 4 — 24/7 장시간 운영**:

```bash
# 해결: 자가 진단 루프 (10분마다)
healthcheck() {
  local now=$(date +%s)

  # 좀비 job 감지: PID 파일은 있는데 프로세스 없음
  for pid_file in /tmp/worker-TASK-*.pid; do
    [ -f "$pid_file" ] || continue
    local pid=$(cat "$pid_file")
    if ! kill -0 "$pid" 2>/dev/null; then
      local task_id=$(basename "$pid_file" | sed 's/worker-//;s/\.pid//')
      echo "  🧟 ${task_id}: 좀비 감지 (PID=${pid} 사라짐) → failed 처리"
      signal_create "$SIGNAL_DIR" "$task_id" "failed" "zombie"
      rm -f "$pid_file"
    fi
  done

  # 장기 실행 job 감지: 30분 초과
  for task_id in "${RUNNING[@]}"; do
    [ -z "$task_id" ] && continue
    local start_time=$(cat "$SIGNAL_DIR/${task_id}-start" 2>/dev/null || echo 0)
    if [ "$((now - start_time))" -gt 1800 ]; then
      echo "  ⏰ ${task_id}: 30분 초과 → timeout 처리"
      _stop_worker "$task_id"
      signal_create "$SIGNAL_DIR" "$task_id" "failed" "timeout"
    fi
  done
}
```

---

## 12. Production Hardening v2 — 해결책의 취약점 재검증

### 12-1. Claude 동시 실행 Hard Limit

**11-1의 취약점**: memory reservation + staggered start는 모두 _orchestrator 내부 변수_.
orchestrator가 죽고 재시작하면 RESERVED_MB=0으로 리셋 → 기존 job과 겹쳐 OOM.

**실패 시나리오**:
orchestrator 재시작 → RESERVED_MB=0, RUNNING=() →
이미 실행 중인 claude 2개를 모르고 새 job 2개 dispatch →
순간 claude 4개 동시 실행 → OOM.

**해결: 프로세스 카운트 기반 hard limit (OS 레벨)**

```bash
MAX_CLAUDE_PROCS=2  # 시스템 전체에서 동시 실행 가능한 claude 프로세스 수

count_claude_procs() {
  # orchestrator 상태와 무관하게, 실제 실행 중인 claude 프로세스 수를 OS에서 직접 카운트
  pgrep -f "claude.*--dangerously-skip-permissions" | wc -l | tr -d ' '
}

can_dispatch_hard() {
  local current=$(count_claude_procs)
  if [ "$current" -ge "$MAX_CLAUDE_PROCS" ]; then
    echo "  🛑 claude hard limit 도달 (${current}/${MAX_CLAUDE_PROCS}) → 대기"
    return 1
  fi
  return 0
}

# can_dispatch() 최종 구조: 3중 게이트
can_dispatch() {
  # Gate 1: OS 레벨 hard limit (최우선, 재시작 후에도 안전)
  can_dispatch_hard || return 1

  # Gate 2: memory reservation (정상 운영 시 정밀 제어)
  reserve_memory "$1" || return 1

  # Gate 3: staggered start (burst 방지)
  local interval=$(dispatch_interval)
  local now=$(date +%s)
  if (( now - LAST_DISPATCH_TIME < interval )); then return 1; fi

  return 0
}
```

**재시작 시 상태 복구**:

```bash
# orchestrator 시작 시 실행 중인 job 복구
recover_running_state() {
  RUNNING=()
  RESERVED_MB=0
  for pid_file in /tmp/worker-TASK-*.pid; do
    [ -f "$pid_file" ] || continue
    local pid=$(cat "$pid_file")
    local task_id=$(basename "$pid_file" | sed 's/worker-//;s/\.pid//')
    if kill -0 "$pid" 2>/dev/null; then
      RUNNING+=("$task_id")
      # 타입 추정: task 파일에서 complexity 읽기
      local tf=$(find_file "$task_id")
      local complexity=$(determine_complexity "$tf")
      case "$complexity" in
        simple) RESERVED_MB=$((RESERVED_MB + 768)) ;;
        *)      RESERVED_MB=$((RESERVED_MB + 2048)) ;;
      esac
      echo "  🔄 ${task_id}: 실행 중 복구 (PID=${pid})"
    else
      rm -f "$pid_file"
    fi
  done
  echo "  📊 복구 완료: RUNNING=${#RUNNING[@]}, RESERVED=${RESERVED_MB}MB"
}
```

**ulimit 기반 개별 job 메모리 제한**:

```bash
# job-task.sh 내부에서 자기 자신의 메모리 상한 설정
# heavy=3GB, light=1.5GB — 초과 시 OS가 강제 종료
start_job_with_limit() {
  local task_id="$1" task_type="$2"
  local mem_limit_kb
  case "$task_type" in
    heavy)  mem_limit_kb=$((3 * 1024 * 1024)) ;;  # 3GB
    light)  mem_limit_kb=$((1536 * 1024)) ;;       # 1.5GB
    review) mem_limit_kb=$((1024 * 1024)) ;;       # 1GB
  esac

  # ulimit -v는 virtual memory 제한 (macOS에서는 제한적)
  # macOS 대안: 주기적 RSS 감시 + 자체 kill
  nohup bash -c "
    MYPID=\$\$
    (
      while kill -0 \$MYPID 2>/dev/null; do
        rss=\$(ps -o rss= -p \$MYPID 2>/dev/null | tr -d ' ')
        if [ -n \"\$rss\" ] && [ \"\$rss\" -gt $mem_limit_kb ]; then
          echo '⚠️ 메모리 한계 초과 (${rss}KB > ${mem_limit_kb}KB) → 강제 종료'
          kill -TERM \$MYPID
        fi
        sleep 5
      done
    ) &
    exec bash '${REPO_ROOT}/scripts/job-task.sh' '${task_id}' '${SIGNAL_DIR}'
  " > "${LOG_DIR}/${task_id}.log" 2>&1 &
}
```

**Trade-off**: pgrep 기반 카운트는 ~10ms 소비. 매 dispatch마다 호출해도 부담 없음.
ulimit -v는 macOS에서 동작 안 하므로 RSS 감시 워치독으로 대체. 5초 간격이라 정밀하지 않지만
OOM으로 전체가 죽는 것보다 한 job만 죽이는 게 낫다.

---

### 12-2. Retry Context 누적 방지

**11-5의 취약점**: retry 시 "이전 diff + 피드백 + 전체 scope"를 합성하면
retry 횟수에 비례해서 context가 커짐. 2차 retry에서 이미 context가 1.5배.

**실패 시나리오**:
1차 실행: scope 20파일 임베드 (60K tokens)
리뷰 reject → 피드백 2K tokens + diff 5K tokens
2차 실행: 60K + 7K = 67K tokens → 모델 성능 저하 시작
리뷰 다시 reject → 피드백 2K + diff 8K
(3차가 있었다면: 67K + 10K = 77K → context 한계 근접)

**해결: context reset + focused retry**

```bash
build_retry_prompt() {
  local task_file="$1" scope_files="$2" retry_count="$3"
  local feedback_file="$OUTPUT_DIR/${TASK_ID}-review-feedback.txt"
  local prev_diff_file="$OUTPUT_DIR/${TASK_ID}-prev-diff.txt"

  # retry에서는 scope 전체를 다시 보내지 않는다.
  # 대신: 피드백에서 언급된 파일만 전체 + 나머지는 diff-context로 대체

  # 1) 피드백에서 언급된 파일 추출
  local mentioned_files=$(grep -oE '[a-zA-Z0-9_/.-]+\.(ts|tsx|js|jsx|css)' "$feedback_file" 2>/dev/null | sort -u)

  # 2) 프롬프트 구성
  local prompt="## 태스크\n$(cat "$task_file")\n\n"

  # 3) 언급된 파일만 전체 임베드 (focused)
  prompt+="## 수정 필요 파일\n\n"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # scope 내에서 매칭되는 실제 경로 찾기
    local real_path=$(echo "$scope_files" | grep "$f" | head -1)
    [ -z "$real_path" ] || [ ! -f "$real_path" ] && continue
    prompt+="### ${real_path}\n\`\`\`\n$(cat "$real_path")\n\`\`\`\n\n"
  done <<< "$mentioned_files"

  # 4) 이전 diff (무엇을 했는지 맥락)
  prompt+="## 이전 시도의 변경 (참고용, 이 위에서 개선할 것)\n"
  prompt+="\`\`\`diff\n$(head -200 "$prev_diff_file" 2>/dev/null)\n\`\`\`\n\n"

  # 5) 리뷰 피드백
  prompt+="## 리뷰어 피드백 (반드시 반영)\n$(cat "$feedback_file")\n\n"

  # 6) diff 200줄 제한 = context 폭발 방지
  # 전체 scope 재전송 없이 focused files + truncated diff로 구성

  echo "$prompt"
}
```

**Context 크기 추적**:

```bash
# job-task.sh 내에서 프롬프트 크기 사전 체크
check_prompt_size() {
  local prompt="$1"
  local char_count=${#prompt}
  local est_tokens=$((char_count / 4))  # 대략 4자 = 1토큰

  if [ "$est_tokens" -gt 80000 ]; then
    echo "⚠️ 프롬프트 ${est_tokens} 토큰 추정 — 80K 초과, 축소 필요" >&2
    return 1
  fi
  echo "📊 프롬프트 크기: ~${est_tokens} 토큰"
  return 0
}
```

**단계별 context 크기 전략**:

```
1차 실행: scope 전체 + deps signature         ≈ 40-60K tokens (상한)
2차 실행: 피드백 언급 파일만 + diff 200줄     ≈ 15-25K tokens
          (scope 재전송 없음 — worktree에 이전 코드가 남아있으므로 Claude가 직접 읽기 가능)
```

---

### 12-3. Memory Reservation 괴리 해소

**11-1의 취약점**: heavy=2048MB 고정 예약이지만, 실제 claude 프로세스는
context 크기에 따라 800MB~4GB까지 변동. 예약값이 맞을 확률이 낮음.

**실패 시나리오**:
light task지만 scope에 대형 파일 포함 → 실제 2.5GB 사용 → 예약은 768MB →
다른 job도 dispatch됨 → 합계 초과 → OOM.

**해결: 실행 후 실측 기반 예약 보정**

```bash
# job 시작 후 10초 뒤 실제 RSS 측정 → 예약값 보정
adjust_reservation() {
  local task_id="$1" task_type="$2"
  local pid_file="/tmp/worker-${task_id}.pid"
  local pid=$(cat "$pid_file" 2>/dev/null)
  [ -z "$pid" ] && return

  # 10초 후 RSS 측정 (claude가 context 로딩 완료한 시점)
  sleep 10

  if kill -0 "$pid" 2>/dev/null; then
    # claude 자식 프로세스의 RSS 합계
    local actual_mb=$(ps -o rss= -p "$pid" $(pgrep -P "$pid") 2>/dev/null \
      | awk '{s+=$1} END {print int(s/1024)}')

    local reserved_mb
    case "$task_type" in
      heavy) reserved_mb=2048 ;; light) reserved_mb=768 ;; review) reserved_mb=512 ;;
    esac

    local diff=$((actual_mb - reserved_mb))
    if [ "$diff" -gt 256 ]; then
      # 실제가 예약보다 256MB 이상 크면 → 보정
      RESERVED_MB=$((RESERVED_MB + diff))
      echo "  ⚠️ ${task_id}: 실측 ${actual_mb}MB > 예약 ${reserved_mb}MB → +${diff}MB 보정"
    fi
  fi
}

# dispatch 직후 백그라운드로 보정 실행
start_task() {
  # ... job 시작 ...
  adjust_reservation "$task_id" "$task_type" &
}
```

**비상 브레이크: 시스템 메모리 임계치 초과 시 신규 dispatch 전면 중단**

```bash
# 메인 루프 최상단에서 체크
emergency_check() {
  local free_mb
  # macOS
  free_mb=$(vm_stat | awk '/Pages free/ {print int($3 * 4096 / 1048576)}')
  # 남은 메모리 512MB 미만 → 비상
  if [ "${free_mb:-9999}" -lt 512 ]; then
    echo "  🚨 비상: 가용 메모리 ${free_mb}MB < 512MB → dispatch 전면 중단"
    return 1
  fi
  return 0
}
```

---

### 12-4. Context 정확도: 코드 깨지는 구체적 케이스

**케이스 1 — 타입 불일치**:
scope: `UserCard.tsx`. deps signature에 `useUser(): User` 보임.
Claude가 `User.email`을 쓰지만, 실제 `User` 타입에 `email`은 optional이고
null check 없이 접근 → 런타임 에러.
signature만으로는 타입 정의의 optional/required 구분 불가.

**케이스 2 — barrel export 누락**:
`components/index.ts`에서 `export * from './Button'` 형태.
import chain이 `./components`를 resolve하지만 barrel 내부의 실제 파일은 추적 못함.

**해결: 타입 정의 포함 + barrel 전개**

```bash
# 의존 파일에서 type/interface 정의를 추출하여 포함 (signature 보강)
extract_type_defs() {
  local file="$1"
  # export type, export interface, type alias 전체 블록 추출
  awk '/^export (type|interface)/{p=1} p{print} p && /^\}$/{p=0}' "$file" 2>/dev/null
}

# barrel export 전개: index.ts의 re-export를 실제 파일로 resolve
resolve_barrel() {
  local index_file="$1"
  [ ! -f "$index_file" ] && return
  local dir=$(dirname "$index_file")
  grep -oE "export \* from '\./[^']+'" "$index_file" 2>/dev/null \
    | sed "s/export \* from '//;s/'//" \
    | while read -r rel; do
        local resolved=$(realpath "$dir/$rel.ts" 2>/dev/null || realpath "$dir/$rel/index.ts" 2>/dev/null || echo "")
        [ -n "$resolved" ] && [ -f "$resolved" ] && echo "$resolved"
      done
}
```

**Context 구성 최종 전략**:

```
scope 파일:
  ≤300줄 → 전체 임베드
  301-800줄 → 전체 임베드 + "이 파일은 크다. 변경 최소화하라" 경고
  >800줄 → signature + type 정의 + Claude 직접 읽기 허용 (worktree 필수)

deps 파일 (1-depth import):
  → type/interface 정의 전체 + 함수 signature
  → barrel export는 전개하여 실제 파일 추적

scope 외 파일:
  → Claude에게 "scope 외 파일을 수정하지 마라" 명시
  → 읽기는 허용, 수정은 scope 내만
```

**Trade-off**: type 정의 추출로 context가 10-20% 증가하지만, 타입 불일치 버그를 방지.
800줄 기준은 ~12K tokens ≈ 모델 context의 10% 이하로 안전.

---

### 12-5. Worktree 안정성 보강

**worktree pool의 취약점**:
pool slot에서 `git checkout -B` 시 이전 job의 uncommitted 변경이 남아있으면 checkout 실패.
`git clean -fd`가 `.gitignore` 파일은 안 지움 → node_modules 등 잔존.

**실패 시나리오**:
TASK-A가 slot-1에서 작업 → `package.json` 수정 + `npm install` 실행 →
node_modules 변경 → release_worktree에서 `git clean -fd` →
node_modules는 `.gitignore`라 안 지워짐 →
TASK-B가 slot-1 획득 → 오염된 node_modules로 작업 → 빌드 결과 다름.

**해결: worktree 정리 강화**

```bash
release_worktree() {
  local wt="$1"
  local lock="${wt}.lock"

  # 1) 모든 변경 폐기
  git -C "$wt" checkout -- . 2>/dev/null || true
  git -C "$wt" clean -fdx 2>/dev/null || true  # -x: .gitignore 파일도 삭제

  # 2) base branch로 리셋
  git -C "$wt" checkout "$BASE_BRANCH" 2>/dev/null || true
  git -C "$wt" reset --hard "$BASE_BRANCH" 2>/dev/null || true

  # 3) task 브랜치 삭제 (풀 브랜치가 아닌 task 브랜치)
  local owner_task=$(cat "$lock/owner" 2>/dev/null)
  if [ -n "$owner_task" ]; then
    local task_branch=$(get_branch "$owner_task")
    [ -n "$task_branch" ] && git -C "$REPO_ROOT" branch -D "$task_branch" 2>/dev/null || true
  fi

  rm -rf "$lock"
}

# 풀 초기화 시 오염 검증
validate_pool() {
  for i in $(seq 1 $POOL_SIZE); do
    local wt="$WORKTREE_POOL_DIR/slot-${i}"
    local lock="${wt}.lock"
    [ -d "$lock" ] && continue  # 사용 중 → skip

    if [ -d "$wt" ]; then
      # dirty 상태면 강제 정리
      if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
        echo "  🧹 slot-${i}: dirty 상태 감지 → 정리"
        git -C "$wt" checkout -- . 2>/dev/null || true
        git -C "$wt" clean -fdx 2>/dev/null || true
        git -C "$wt" reset --hard "$BASE_BRANCH" 2>/dev/null || true
      fi
    fi
  done
}
```

**branch 충돌 방지**: task 브랜치명에 timestamp 포함

```bash
# 기존: task/task-203
# 개선: task/task-203-1711411200
create_task_branch() {
  local task_id="$1"
  local ts=$(date +%s)
  local slug=$(echo "$task_id" | tr '[:upper:]' '[:lower:]')
  echo "task/${slug}-${ts}"
}
```

---

### 12-6. Signal 시스템 순서 보장

**11-4의 취약점**: signal 처리 순서가 보장되지 않음.
TASK-A-done 처리(머지) 중에 TASK-B-done도 도착 →
다음 루프에서 TASK-B 머지 시도 → TASK-A 머지가 아직 안 끝남 → git lock 충돌.

**실패 시나리오**:
1. TASK-A-done 감지 → merge 시작 (git merge는 수 초 소요)
2. 같은 루프에서 TASK-B-done도 감지 → merge 시도
3. git lock 충돌 → merge 실패 → TASK-B가 failed 처리됨 (실제로는 성공인데)

**해결: signal 처리를 sequential queue로**

```bash
process_signals() {
  local signals=()
  for sig_file in "$SIGNAL_DIR"/*-done "$SIGNAL_DIR"/*-failed "$SIGNAL_DIR"/*-stopped; do
    [ -f "$sig_file" ] && signals+=("$sig_file")
  done

  # done signal은 한 번에 하나씩만 처리 (머지 순차 보장)
  local done_processed=false
  for sig_file in "${signals[@]}"; do
    local suffix=$(echo "$sig_file" | grep -oE '(done|failed|stopped)$')
    local task_id=$(basename "$sig_file" | sed 's/-[^-]*$//')

    if [ "$suffix" = "done" ]; then
      if $done_processed; then
        # 이번 루프에서 이미 done 하나 처리함 → 다음 루프로 미룸
        continue
      fi
      if signal_consume "$SIGNAL_DIR" "$task_id"; then
        process_done_task "$task_id"
        done_processed=true
      fi
    else
      # failed/stopped는 git 작업 없으므로 병렬 처리 가능
      if signal_consume "$SIGNAL_DIR" "$task_id"; then
        process_signal "$task_id" "$suffix"
      fi
    fi
  done
}
```

**Signal 순서 기록 (디버깅용)**:

```bash
# signal 생성 시 타임스탬프 기록
signal_create_with_ts() {
  local signal_dir="$1" task_id="$2" suffix="$3" payload="${4:-}"
  local ts=$(date +%s.%N)
  echo "${ts} ${payload}" > "${signal_dir}/${task_id}-${suffix}"
}

# 처리 시 순서 로그
log_signal_order() {
  local task_id="$1" suffix="$2"
  echo "[$(date '+%Y-%m-%d %H:%M:%S.%N')] CONSUMED: ${task_id}-${suffix}" >> "$OUTPUT_DIR/logs/signal-order.log"
}
```

---

## 13. Final Edge Cases — 3차 검증

이전 Hardening(11, 12)에서 다루지 못한 마지막 edge case들.

### 13-1. pgrep 기반 hard limit의 race condition

**시나리오**: can_dispatch_hard()가 pgrep으로 claude 1개 확인 → 통과 →
job-task.sh 실행 직전에 다른 루프에서도 동시에 통과 →
두 job이 거의 동시에 claude 시작 → hard limit 2인데 3개 실행.

**원인**: pgrep 체크와 프로세스 시작 사이에 atomic하지 않은 gap.

**해결: dispatch semaphore (파일 기반 mutex)**

```bash
DISPATCH_LOCK="/tmp/orchestrate-dispatch.lock"

dispatch_with_lock() {
  local task_id="$1" task_type="$2"

  # atomic lock 획득 (mkdir은 atomic)
  if ! mkdir "$DISPATCH_LOCK" 2>/dev/null; then
    return 1  # 다른 dispatch 진행 중
  fi
  trap "rm -rf '$DISPATCH_LOCK'" RETURN

  # lock 안에서 체크 + 시작 → atomic
  can_dispatch_hard || return 1
  reserve_memory "$task_type" || return 1

  start_job "$task_id" "$task_type"
  LAST_DISPATCH_TIME=$(date +%s)
  return 0
}
```

이 구조에서 pgrep 체크와 job 시작이 같은 lock 안에서 일어나므로 race 불가.
orchestrator가 single process이면 사실상 불필요하지만, 실수로 2개 실행될 때도 안전.

---

### 13-2. RSS 워치독의 자식 프로세스 누락

**시나리오**: start_job_with_limit()의 RSS 워치독이 `$MYPID`만 감시.
하지만 claude CLI는 node 자식 프로세스를 여러 개 spawn.
$MYPID의 RSS는 50MB인데 자식들 합계가 3GB → 워치독이 감지 못함.

**해결: 프로세스 트리 전체 RSS 감시**

```bash
# 워치독 개선: 자신 + 모든 자손 프로세스의 RSS 합계
watch_tree_rss() {
  local root_pid=$1 limit_kb=$2
  while kill -0 "$root_pid" 2>/dev/null; do
    # pgrep -P로 자손 전체 수집
    local all_pids="$root_pid $(pgrep -P "$root_pid" 2>/dev/null) \
                    $(pgrep -P "$(pgrep -P "$root_pid" 2>/dev/null)" 2>/dev/null)"
    local total_rss=0
    for p in $all_pids; do
      local rss=$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ')
      [ -n "$rss" ] && total_rss=$((total_rss + rss))
    done

    if [ "$total_rss" -gt "$limit_kb" ]; then
      echo "⚠️ 트리 RSS ${total_rss}KB > ${limit_kb}KB → SIGTERM"
      kill -TERM "$root_pid" 2>/dev/null
      sleep 2
      kill -9 "$root_pid" 2>/dev/null  # graceful 실패 시 강제
      break
    fi
    sleep 5
  done
}
```

---

### 13-3. emergency_check()의 macOS vm_stat 오류

**시나리오**: macOS의 `vm_stat`에서 "Pages free"는 실제 사용 가능 메모리를 반영하지 않음.
macOS는 적극적으로 캐시를 사용하므로 "free"가 100MB여도 실제로는 4GB 사용 가능.
emergency_check()가 false positive → dispatch가 불필요하게 중단.

**해결: macOS는 memory_pressure 명령어 사용**

```bash
emergency_check() {
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS: memory_pressure가 CRITICAL/WARN이면 비상
    local level=$(memory_pressure 2>/dev/null | grep -o 'The system is under .*memory pressure' | awk '{print $6}')
    case "$level" in
      critical) echo "  🚨 비상: memory pressure CRITICAL"; return 1 ;;
      warn*)    echo "  ⚠️ 경고: memory pressure WARNING"; return 1 ;;
      *)        return 0 ;;
    esac
  else
    # Linux: /proc/meminfo 기반
    local avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null)
    if [ "${avail_mb:-9999}" -lt 512 ]; then
      echo "  🚨 비상: 가용 메모리 ${avail_mb}MB < 512MB"; return 1
    fi
  fi
  return 0
}
```

---

### 13-4. 24/7 장기 운영 시 누적 degradation

**시나리오**: 며칠 운영 후:
- signal archive에 수백 파일 쌓임 → 디스크 소비
- git 히스토리 증가 → worktree checkout 점점 느려짐
- 로그 파일 무한 증가 → 디스크 풀
- PID 파일 잔존 (좀비 감지 실패 시)

**해결: 일일 자정 정리 루프**

```bash
daily_cleanup() {
  local now_hour=$(date +%H)
  [ "$now_hour" != "03" ] && return  # 새벽 3시에만 실행
  [ -f "/tmp/orchestrate-cleanup-today" ] && return  # 오늘 이미 실행

  echo "🧹 일일 정리 시작"

  # 1) signal archive: 7일 이상 된 파일 삭제
  find "$SIGNAL_DIR/archive" -type f -mtime +7 -delete 2>/dev/null

  # 2) 로그 로테이션: 10MB 이상 파일 truncate
  for log in "$OUTPUT_DIR/logs"/*.log; do
    [ -f "$log" ] || continue
    local size_mb=$(du -m "$log" | cut -f1)
    if [ "$size_mb" -gt 10 ]; then
      tail -1000 "$log" > "${log}.tmp" && mv "${log}.tmp" "$log"
    fi
  done

  # 3) 고아 PID 파일 정리
  for pid_file in /tmp/worker-TASK-*.pid; do
    [ -f "$pid_file" ] || continue
    local pid=$(cat "$pid_file")
    kill -0 "$pid" 2>/dev/null || rm -f "$pid_file"
  done

  # 4) worktree pool 오염 검증
  validate_pool

  touch "/tmp/orchestrate-cleanup-today"
  echo "🧹 일일 정리 완료"
}
# cleanup 플래그는 날짜 변경 시 리셋
[ "$(date +%Y%m%d)" != "$(stat -f %Sm -t %Y%m%d /tmp/orchestrate-cleanup-today 2>/dev/null)" ] && \
  rm -f "/tmp/orchestrate-cleanup-today"
```

---

### 13-5. Retry가 시스템을 망치는 케이스

**시나리오**: TASK-A가 review reject → retry 투입.
이 사이에 TASK-B가 같은 scope 파일을 수정하고 merge 완료.
TASK-A의 retry가 worktree의 _옛 코드_ 기반으로 작업 → TASK-B 변경 무시 → silent regression.

**해결: retry 전 worktree를 base 최신으로 rebase**

```bash
prepare_retry() {
  local task_id="$1"
  local wt=$(get_worktree "$task_id")
  local branch=$(get_branch "$task_id")

  if [ -d "$wt" ]; then
    # 1) base 최신화
    git -C "$REPO_ROOT" fetch origin "$BASE_BRANCH" 2>/dev/null || true

    # 2) worktree에서 rebase
    git -C "$wt" fetch origin "$BASE_BRANCH" 2>/dev/null || true
    if ! git -C "$wt" rebase "origin/$BASE_BRANCH" 2>/dev/null; then
      # rebase 충돌 → 이전 작업 폐기하고 clean start
      git -C "$wt" rebase --abort 2>/dev/null || true
      git -C "$wt" reset --hard "origin/$BASE_BRANCH" 2>/dev/null
      echo "  ⚠️ ${task_id}: rebase 충돌 → clean retry (이전 작업 폐기)"
    fi
  fi
}
```

---

### 최종 방어 계층 요약

```
Layer 0  OS 레벨      pgrep hard limit + RSS 트리 워치독 + memory_pressure
Layer 1  Dispatch      semaphore lock + reservation + staggered interval
Layer 2  Runtime       adjust_reservation(실측 보정) + emergency_check
Layer 3  Recovery      recover_running_state + idempotent merge + healthcheck
Layer 4  Maintenance   daily_cleanup + log rotation + pool validation
Layer 5  Retry         rebase before retry + repeated failure detection + context reset
```

> 참고: [memory-leak-analysis.md](./memory-leak-analysis.md)

orchestration 재설계와 함께 프론트엔드 OOM 원인도 같이 수정한다.
워커 병렬 실행으로 인한 메모리 문제 + 프론트엔드 폴링 폭주가 동시에 발생하면 시스템이 버틸 수 없다.

### 재설계와 함께 수정할 항목

| 순위 | 대상 | 현재 문제 | 수정 내용 | 관련 마이그레이션 단계 |
|------|------|----------|----------|---------------------|
| 1 | useMonitor + /api/monitor | 1초마다 execSync 4회 (분당 240회 프로세스 생성) | interval 10s + 페이지 visible일 때만 + execSync 1회로 통합 | 단계 1과 동시 |
| 2 | orchestrationStore 자동 폴링 | 모듈 import 시 즉시 폴링 시작, HMR 시 중복 | useEffect 기반 명시적 시작/정지로 변경 | 단계 2와 동시 |
| 3 | tasksStore SSE 무한 재연결 | onerror 시 2초 고정 재연결 → 무한루프 | exponential backoff (2s→4s→8s→max 30s) | 단계 2와 동시 |
| 4 | tasks/[id] interval 3중 중첩 | 페이지 하나에 setInterval 3개 동시 | L230 제거 (store 구독으로 대체), LiveLogPanel SSE 전환 | 단계 3과 동시 |
| 5 | SSE 로그 스트림 타임아웃 | cancel() 미호출 시 영원히 폴링 | 최대 10분 타임아웃 추가 | 단계 4와 동시 |
| 6 | node-pty 좀비 프로세스 | WebSocket close에서만 kill | idle 5분 타임아웃 + onExit 양방향 정리 | 단계 4와 동시 |
| 7 | 파서 무캐싱 | 매 API 호출마다 전체 디스크 스캔 | TTL 캐시 (3초) 또는 fs.watch 무효화 | 단계 5와 동시 |

### 왜 같이 해야 하는가

```
현재 OOM 원인 = 워커 메모리 + 프론트엔드 폴링 폭주

워커만 개선:  9GB → 3GB  (프론트 폴링이 남은 3GB도 잡아먹음)
둘 다 개선:   9GB → 1.5GB (안정)
```

워커 재설계만으로는 부족하다. useMonitor의 초당 execSync 폭탄 하나만으로도 OOM이 발생할 수 있다.

### 수정 파일 목록

```
프론트엔드 (재설계와 동시 수정):
  src/frontend/src/hooks/useMonitor.ts
  src/frontend/src/app/api/monitor/route.ts
  src/frontend/src/store/orchestrationStore.ts
  src/frontend/src/store/tasksStore.ts
  src/frontend/src/app/tasks/[id]/page.tsx
  src/frontend/src/app/api/orchestrate/logs/route.ts
  src/frontend/server.ts
  src/frontend/src/lib/parser.ts

스크립트 (재설계 대상):
  scripts/orchestrate.sh → 리팩토링
  scripts/run-worker.sh  → job-task.sh + job-review.sh 분리
```
