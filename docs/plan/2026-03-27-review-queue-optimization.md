# 리뷰 큐 분리 + 배치 리뷰 최적화 설계안

## 현재 구조

```
[task slot 1]  TASK-A task → TASK-A review → TASK-A merge → TASK-C task → ...
[task slot 2]  TASK-B task → TASK-B review → TASK-B merge → TASK-D task → ...
```

- task 슬롯이 review + merge 끝날 때까지 **블로킹**
- review는 task와 1:1 순차 실행
- `maxParallel: 2`면 동시 claude 프로세스 최대 2개

### 문제점
- task 완료 후 review 대기 시간 동안 슬롯이 놀고 있음
- review는 haiku로 빠르지만, 그래도 30~60초 소요
- task 10개를 돌리면 review 대기만으로 5~10분 낭비

## 개선 구조

### Phase 1: 큐 분리 (task queue / review queue)

```
[task queue]     slot1: TASK-A → TASK-C → TASK-E → ...
                 slot2: TASK-B → TASK-D → TASK-F → ...

[review queue]   slot1: TASK-A review → TASK-D review → ...
                 slot2: TASK-B review → TASK-E review → ...

[merge]          순차 (git 충돌 방지)
```

- task 완료 → review queue에 추가 → task 슬롯은 즉시 다음 태스크 시작
- review queue는 별도 슬롯으로 병렬 실행
- merge는 순차 (같은 브랜치에 머지하므로 충돌 방지)

#### 설정

```json
{
  "maxParallel": {
    "task": 2,
    "review": 2
  }
}
```

- 최대 동시 claude 프로세스: task 2 + review 2 = **4개**
- 메모리/CPU 부담이 크면 review를 1로 줄이면 됨

#### 구현 포인트

**orchestrate.sh 변경:**
- `RUNNING` 배열을 `RUNNING_TASKS`와 `RUNNING_REVIEWS`로 분리
- `process_signals_for_task()`에서 task-done → review queue에 추가 (기존: 즉시 review 시작)
- 메인 루프에서 review queue도 dispatch
- `can_dispatch()`를 task/review 별로 분리

**signal 흐름:**
```
task-done → review queue에 등록 (파일: .orchestration/review-queue/TASK-XXX)
review 슬롯 비면 → review queue에서 꺼내서 실행
review-approved → merge (순차)
review-rejected → retry queue 또는 failed
```

**TaskRunnerManager 변경 (개별 실행):**
- 기존: task.on("close") → startReview() (순차)
- 변경 없음 — 개별 실행은 1개 태스크만 처리하므로 큐 분리 불필요

### Phase 2: 배치 리뷰

여러 태스크의 diff를 모아서 한 번의 claude 호출로 리뷰.

#### 묶는 기준: 개수 + 타임아웃

```
review queue에 태스크 도착
  → 3개 모이면 → 즉시 배치 리뷰
  → 30초 타임아웃 → 있는 것만 배치 리뷰 (1~2개라도 실행)
```

- 빠른 태스크가 느린 태스크 기다리느라 블로킹 안 됨
- 태스크가 1개만 있어도 30초 후 단독 리뷰

#### 설정

```json
{
  "batchReview": {
    "enabled": true,
    "maxBatchSize": 3,
    "timeoutSeconds": 30
  }
}
```

#### 배치 리뷰 프롬프트

```markdown
아래 N개 태스크의 코드 변경을 리뷰해라.
각 태스크별로 승인/수정요청을 개별 판단해라.

## TASK-A: {title}
### 완료 조건
{criteria}
### 변경 내용 (git diff)
{diff_A}

## TASK-B: {title}
### 완료 조건
{criteria}
### 변경 내용 (git diff)
{diff_B}

## 결과 형식
각 태스크별로 아래 형식으로 작성:
TASK-A: 승인 | 수정요청
(상세 피드백)
TASK-B: 승인 | 수정요청
(상세 피드백)
```

#### 결과 파싱

리뷰어 응답에서 태스크별 승인/수정요청을 파싱:
```bash
# 응답 예시:
# TASK-A: 승인
# 코드 품질 양호, 완료 조건 충족
# TASK-B: 수정요청
# slice(0,5)가 아니라 slice(0,10)이어야 함

for task_id in "${batch[@]}"; do
  verdict=$(grep "^${task_id}:" "$review_result" | head -1)
  if echo "$verdict" | grep -q "승인"; then
    signal_create "$SIGNAL_DIR" "$task_id" "review-approved"
  else
    signal_create "$SIGNAL_DIR" "$task_id" "review-rejected"
    # 해당 태스크의 피드백 추출하여 파일로 저장
  fi
done
```

#### 리스크 & 완화

| 리스크 | 완화 방안 |
|--------|----------|
| 리뷰어가 태스크 A/B 결과를 혼동 | 프롬프트에 명확한 구분자 + 결과 형식 강제 |
| 배치 내 한 태스크가 매우 큰 diff | maxBatchSize를 줄이거나, diff 크기 기준으로 배치 분리 |
| 파싱 실패 | fallback: 전체를 수정요청으로 처리하고 개별 리뷰로 재시도 |
| 배치 리뷰 비용이 개별보다 비쌈 | context caching으로 상쇄 — 시스템 프롬프트/역할 프롬프트가 캐시됨 |

## 비용/시간 비교

### 예시: 태스크 6개 실행 (maxParallel task=2, review=2)

**현재 (순차 리뷰):**
```
시간: task(3분) + review(1분) + merge(10초) = 4분 10초 per task
      × 3 라운드 (2개씩) = ~12분 30초
리뷰 비용: 6 × $0.09 = $0.54
```

**Phase 1 (큐 분리):**
```
시간: task 6개 → 3라운드 × 3분 = 9분
      review 6개 → 3라운드 × 1분 = 3분 (task와 병렬)
      총: ~9분 (review가 task 뒤에서 병렬 처리)
리뷰 비용: 6 × $0.09 = $0.54 (동일)
절약: ~3분 30초 (28%)
```

**Phase 2 (배치 리뷰, 3개씩):**
```
시간: task 동일 9분
      review 2회 × 1.5분 = 3분 (task와 병렬)
      총: ~9분
리뷰 비용: 2 × $0.12 = $0.24 (55% 절약)
절약: 시간 동일 + 비용 $0.30 절약
```

## 구현 우선순위

| 순서 | 내용 | 효과 | 난이도 |
|------|------|------|--------|
| 1 | review queue 분리 (Phase 1) | 시간 28% 절약 | 중간 |
| 2 | 배치 리뷰 (Phase 2) | 비용 55% 절약 | 높음 |
| 3 | review 스킵 옵션 | 단순 태스크 시간 50% 절약 | 낮음 |

**Phase 1부터 구현 권장.** orchestrate.sh의 메인 루프만 수정하면 됨. Phase 2는 프롬프트 설계 + 파싱 로직이 필요하므로 이후 진행.

---

## 리뷰 라운드

### Round 1 — 설계1 (문제 제기 + 개선안)

**문제점 5가지:**

1. **merge 순차 실행이 병목이 됨**
   - Phase 1에서 task/review를 분리해도, merge는 순차라 여기서 막힘. review 2개가 동시에 끝나면 merge가 직렬로 기다려야 함. 특히 merge conflict 자동 해결(Claude 호출)이 들어가면 merge 1건당 30초~2분 소요 가능.

2. **배치 리뷰의 30초 타임아웃이 야간 모드와 맞지 않음**
   - night worker는 태스크를 빠르게 연속 생성하므로 30초면 거의 항상 1개씩 리뷰됨. 야간에는 "모든 task 완료 후 일괄 리뷰"가 더 효율적. 반면 주간 개별 실행은 즉시 리뷰가 맞음. 모드별로 배치 전략이 달라야 함.

3. **review-rejected 후 retry 흐름이 미정의**
   - 배치 리뷰에서 TASK-A 승인, TASK-B 수정요청이면, TASK-B를 retry할 때 워커가 피드백을 어디서 읽는지 명시 안 됨. 배치 리뷰 결과에서 태스크별 피드백을 분리 추출하는 로직 필요.

4. **동시 claude 프로세스 4개의 메모리 부담**
   - claude 프로세스 1개당 ~300MB. task 2 + review 2 = 4개면 1.2GB. 8GB 맥에서는 부담. `can_dispatch()`의 메모리 체크가 task/review 합산으로 동작해야 함.

5. **review queue 파일 기반 구현의 경합 위험**
   - `.orchestration/review-queue/TASK-XXX` 파일로 큐를 관리하면, orchestrate.sh의 메인 루프가 파일을 읽는 동시에 task 워커가 파일을 쓸 때 경합 발생 가능. signal.sh처럼 atomic rename이 필요.

**개선안:**

1. **merge를 review와 분리하여 3단계 큐로**
   ```
   [task queue] → [review queue] → [merge queue (순차)]
   ```
   merge queue는 단일 워커가 순차 처리. review 완료 즉시 merge queue에 등록하고 review 슬롯은 해제.

2. **배치 전략을 모드별로 분리**
   ```json
   {
     "batchReview": {
       "mode": "auto",
       "nightMode": { "strategy": "wait-all", "maxBatchSize": 10 },
       "dayMode": { "strategy": "count-timeout", "maxBatchSize": 3, "timeoutSeconds": 30 }
     }
   }
   ```

3. **배치 리뷰 피드백 파싱 규격화**
   - 리뷰어 응답을 JSON으로 강제: `{"TASK-A": {"verdict": "승인"}, "TASK-B": {"verdict": "수정요청", "feedback": "..."}}`
   - 파싱 실패 시 개별 리뷰로 fallback하되, 비용이 이중으로 드는 것 경고 로그

4. **프로세스 수 합산 관리**
   - `can_dispatch_task()`와 `can_dispatch_review()`가 있되, 둘 다 글로벌 `MAX_CLAUDE_PROCS`를 공유
   - task 우선: review가 밀려도 task 슬롯을 양보하지 않음

5. **review queue도 signal.sh의 atomic rename 패턴 사용**

**설계1 리뷰 완료. 설계2 차례.**

### Round 2 — 설계2 (설계1 Round 1 기반 문제 제기 + 개선안)

**설계1 개선안에 대한 문제점:**

1. **3단계 큐(task→review→merge)는 과잉 설계**
   - merge는 `git merge --no-ff` + push로 10초 이내. 별도 큐까지 만들 필요 없음. review 완료 콜백에서 직접 merge 함수 호출하되, mutex(lockfile)로 직렬화하면 충분. 큐 3개를 관리하는 복잡도가 merge 10초 절약보다 크다.

2. **nightMode "wait-all" 전략은 위험**
   - 태스크 10개 중 9개 완료, 1개가 stuck이면 전체 리뷰가 블로킹됨. "wait-all"은 절대 안전하지 않음. 차라리 night에도 count-timeout을 쓰되 `maxBatchSize: 5`, `timeoutSeconds: 120`으로 여유를 주는 게 현실적.

3. **리뷰 결과를 JSON으로 강제하면 리뷰 품질 하락**
   - Claude에게 JSON 출력을 강제하면 자연어 피드백의 디테일이 줄어듦. 실제로 "이 변수명이 혼란스러움" 같은 nuance가 JSON value에 담기기 어려움. 차라리 마크다운 형식을 유지하되, 구분자를 `---TASK-XXX-START---` / `---TASK-XXX-END---`로 명확히 하고 파싱하는 게 낫다.

4. **"task 우선, review 양보 안 함" 정책의 문제**
   - task가 계속 들어오면 review가 무한정 밀림. review가 밀리면 merge도 안 되고, done 처리가 안 되어 사용자에게 진행 상황이 보이지 않음. **review 최소 보장 슬롯**(예: 1개)을 두고, 나머지만 task와 경쟁시켜야 함.

5. **Phase 1과 Phase 2를 별도 구현하면 이중 작업**
   - Phase 1(큐 분리) 구현 후 Phase 2(배치)를 얹으면 review dispatch 로직을 두 번 바꿔야 함. 처음부터 배치 리뷰를 고려한 큐 구조를 설계하되, `maxBatchSize: 1`로 시작하면 Phase 1과 동일한 동작이 됨. 단일 구현으로 두 Phase를 커버 가능.

**개선안:**

1. **merge는 별도 큐 없이 lockfile 기반 직렬화**
   ```bash
   do_merge() {
     local lock=".orchestration/.merge-lock"
     while ! mkdir "$lock" 2>/dev/null; do sleep 1; done
     trap "rmdir '$lock'" EXIT
     git merge --no-ff "$branch" && git push
     rmdir "$lock"
   }
   ```
   review 완료 시 바로 `do_merge()` 호출. 큐 관리 오버헤드 제거.

2. **배치 전략 단일화: count-timeout 방식만, 파라미터로 분기**
   ```json
   {
     "batchReview": {
       "enabled": true,
       "maxBatchSize": 3,
       "timeoutSeconds": 30,
       "profiles": {
         "night": { "maxBatchSize": 5, "timeoutSeconds": 120 },
         "day": { "maxBatchSize": 3, "timeoutSeconds": 30 }
       }
     }
   }
   ```
   "wait-all" 제거. night/day 모두 같은 count-timeout 로직, 파라미터만 다름.

3. **리뷰 결과 포맷: 마크다운 + 명시적 구분자**
   ```markdown
   ---TASK-A-START---
   verdict: 승인
   코드 품질 양호. 변수명 명확하고 완료 조건 충족.
   ---TASK-A-END---
   ---TASK-B-START---
   verdict: 수정요청
   `getUserList()`에서 slice(0,5)는 요구사항의 10개와 불일치.
   line 42의 에러 핸들링 누락.
   ---TASK-B-END---
   ```
   파싱: `sed -n '/---TASK-XXX-START---/,/---TASK-XXX-END---/p'`로 추출. 자연어 피드백 보존.

4. **review 최소 보장 슬롯 1개 + 동적 배분**
   ```
   MAX_CLAUDE_PROCS=4
   RESERVED_REVIEW=1
   available_for_task = MAX_CLAUDE_PROCS - RESERVED_REVIEW - running_reviews
   available_for_review = MAX_CLAUDE_PROCS - running_tasks (최소 RESERVED_REVIEW 보장)
   ```

5. **Phase 통합: `maxBatchSize: 1`이면 Phase 1과 동일**
   - 구현을 처음부터 배치 구조로 하되, 기본값 `maxBatchSize: 1`로 출시
   - 안정화 후 `maxBatchSize: 3`으로 올리면 Phase 2 완성
   - 코드 변경 최소화, 테스트도 한 번만

**설계2 리뷰 완료. 설계1 차례.**

### Round 3 — 설계1 (설계2 Round 2 기반 문제 제기 + 개선안)

**설계2 개선안에 대한 문제점:**

1. **lockfile 기반 merge 직렬화의 교착 위험**
   - `mkdir "$lock"` 후 merge가 실패(conflict)하면 `rmdir`이 실행 안 되고 lock이 영구 잔류. `trap EXIT`로 걸어놨지만 `kill -9`나 시스템 크래시 시 trap 안 탐. stale lock 감지 + 자동 해제 로직(PID 기록 + 생존 체크)이 필수.

2. **구분자 기반 파싱(`---TASK-XXX-START---`)의 취약점**
   - Claude가 코드 블록 안에서 동일한 구분자 패턴을 생성할 수 있음(예: diff에 `---TASK-A-START---`가 포함된 경우). UUID 기반 구분자(예: `---a1b2c3-TASK-A-START---`)로 충돌 방지 필요. 또는 프롬프트에서 "코드 블록 안에 구분자를 사용하지 마라" 규칙 추가.

3. **review 최소 보장 슬롯 1개가 과소**
   - task 3개가 거의 동시에 완료되면 review queue에 3개가 쌓이는데, 보장 슬롯 1개로는 직렬 처리. 그런데 배치 리뷰(maxBatchSize: 3)와 결합하면 보장 슬롯 1개에서 3개를 한 번에 처리하므로 문제 해소. 즉, **배치 리뷰가 전제되어야 보장 슬롯 1개가 의미 있음**. 이 의존성을 명시해야 함.

4. **`maxBatchSize: 1`로 시작하는 Phase 통합 접근의 함정**
   - maxBatchSize: 1이면 타임아웃 대기(30초)가 매번 발생. 기존 즉시 리뷰보다 30초 느려짐. 이를 피하려면 **큐에 1개만 있을 때는 타임아웃 없이 즉시 실행**하는 예외 로직 필요. "큐 크기 == 1이면 즉시, 2개 이상이면 타임아웃 대기" 방식.

5. **night/day 프로파일 전환 시점이 불명확**
   - orchestrate.sh 시작 시 night/day를 결정하는데, 야간 작업이 아침까지 이어지면 프로파일이 안 바뀜. 실행 중 시간 체크로 동적 전환해야 하는데 현재 설계에 없음.

**개선안:**

1. **merge lock에 PID + 타임스탬프 기록**
   ```bash
   do_merge() {
     local lock=".orchestration/.merge-lock"
     # stale lock 감지 (60초 이상 + PID 미생존)
     if [ -d "$lock" ]; then
       local lock_pid=$(cat "$lock/pid" 2>/dev/null)
       local lock_time=$(cat "$lock/time" 2>/dev/null)
       local now=$(date +%s)
       if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
         rmdir "$lock" 2>/dev/null  # stale lock 제거
       elif [ -n "$lock_time" ] && [ $((now - lock_time)) -gt 60 ]; then
         rmdir "$lock" 2>/dev/null  # timeout lock 제거
       fi
     fi
     mkdir "$lock" && echo $$ > "$lock/pid" && date +%s > "$lock/time"
     # ... merge 실행 ...
   }
   ```

2. **구분자에 랜덤 토큰 삽입**
   - 배치 리뷰 시작 시 `BATCH_TOKEN=$(openssl rand -hex 4)` 생성
   - 구분자: `---${BATCH_TOKEN}-TASK-A-START---`
   - 프롬프트에 토큰을 명시하여 Claude가 정확히 사용하도록 강제

3. **보장 슬롯과 배치 리뷰의 의존성 명시**
   - 문서에 추가: "review 보장 슬롯 1개는 배치 리뷰(`maxBatchSize >= 2`)가 활성화된 상태에서만 효과적. 배치 비활성(`maxBatchSize: 1`) 시 `RESERVED_REVIEW: 2` 권장."

4. **큐 크기 1이면 즉시 실행 규칙**
   ```
   if review_queue.length == 1 && no_running_tasks_about_to_finish:
     즉시 리뷰 (타임아웃 무시)
   elif review_queue.length >= maxBatchSize:
     즉시 배치 리뷰
   else:
     타임아웃 대기
   ```
   "곧 끝날 task가 있는지"는 `SIGNAL_DIR/*-start` 파일의 경과 시간으로 추정 가능.

5. **night/day 프로파일 동적 전환**
   - 메인 루프에서 매 iteration마다 현재 시간 체크
   ```bash
   current_hour=$(date +%H)
   if [ "$current_hour" -ge 22 ] || [ "$current_hour" -lt 7 ]; then
     BATCH_PROFILE="night"
   else
     BATCH_PROFILE="day"
   fi
   ```

**✅ 설계1 Round 3 완료. 설계2 차례.**

### Round 4 — 설계2 (설계1 Round 3 기반 문제 제기 + 개선안)

**설계1 개선안에 대한 문제점:**

1. **merge lock에 PID+타임스탬프 기록하면 `mkdir`이 디렉토리 lock이 아니게 됨**
   - `mkdir "$lock"` 후 `echo $$ > "$lock/pid"` 하는 순간, 원자적(atomic) lock이 깨짐. mkdir과 파일 쓰기 사이에 다른 프로세스가 끼어들 수 있음. 차라리 **lockfile 1개에 PID+시간을 한 줄로** 쓰는 게 안전: `echo "$$:$(date +%s)" > "$lock.tmp" && mv "$lock.tmp" "$lock"` (atomic rename).

2. **구분자에 랜덤 토큰 삽입은 파싱 복잡도만 증가**
   - 매 배치마다 토큰이 달라지면, 파싱 스크립트가 토큰을 먼저 알아야 함. 프롬프트에서 토큰을 주고 → 응답에서 같은 토큰을 찾는 왕복이 불필요하게 복잡. **고정 구분자 + 코드블록 내 이스케이프 규칙**이 더 실용적. 예: `===REVIEW:TASK-A===` 같은 패턴은 일반 코드/diff에서 등장할 확률이 0에 가까움.

3. **"곧 끝날 task가 있는지" 추정은 신뢰 불가**
   - start 파일의 경과 시간으로 "곧 끝날지" 추정한다고 했는데, 태스크 소요 시간은 30초~10분까지 편차가 큼. 추정이 틀리면 불필요한 대기 발생. 차라리 **단순 규칙: 큐에 1개면 즉시, 2개 이상이면 `min(timeoutSeconds, 5초)` 대기 후 실행**. 예측보다 고정 규칙이 낫다.

4. **night/day 동적 전환의 시간 하드코딩 문제**
   - `22시~7시 = night`를 하드코딩하면 사용자마다 다른 업무 패턴에 대응 불가. 또한 night-worker.sh는 이미 자체적으로 야간 모드를 판단함. **night/day 구분을 orchestrate.sh가 직접 하지 말고, 호출 시 `--profile night` 플래그로 받거나, config.json에서 읽도록** 해야 중복 판단 제거.

5. **stale lock의 `rmdir` 후 즉시 `mkdir`에 TOCTOU 경합**
   - stale lock 감지 → rmdir → mkdir 사이에 다른 프로세스가 mkdir할 수 있음. 이 3단계가 atomic하지 않음. **flock(1) 사용**이 가장 깔끔:
   ```bash
   exec 9>.orchestration/.merge-lock
   flock -w 30 9 || { echo "merge lock timeout"; return 1; }
   # merge 실행
   exec 9>&-
   ```
   단, macOS에는 flock이 없으므로 `brew install flock` 또는 **`shlock`** 사용.

**개선안:**

1. **merge lock: atomic rename 기반 단일 파일 lock**
   ```bash
   do_merge() {
     local lock=".orchestration/.merge-lock"
     local my_lock=".orchestration/.merge-lock.$$"
     echo "$$:$(date +%s)" > "$my_lock"
     while ! mv "$my_lock" "$lock" 2>/dev/null; do
       # stale 체크
       local info=$(cat "$lock" 2>/dev/null)
       local lock_pid=${info%%:*}
       if [ -n "$lock_pid" ] && ! kill -0 "$lock_pid" 2>/dev/null; then
         rm -f "$lock"  # stale 제거
       else
         sleep 1
       fi
     done
     trap "rm -f '$lock'" EXIT
     git merge --no-ff "$branch" && git push
     rm -f "$lock"
   }
   ```

2. **고정 구분자 패턴 사용**
   ```
   ===REVIEW:TASK-A:START===
   verdict: 승인
   피드백 내용...
   ===REVIEW:TASK-A:END===
   ```
   `===REVIEW:` 접두사는 일반 코드에서 등장하지 않으므로 충돌 확률 무시 가능. 파싱도 `grep -A` 한 줄로 가능.

3. **배치 대기 로직 단순화: 고정 규칙**
   ```
   if queue.length >= maxBatchSize → 즉시 실행
   elif queue.length == 1 && queue.age < 5s → 5초 대기
   elif queue.length >= 1 && queue.oldest_age >= timeoutSeconds → 실행
   ```
   "곧 끝날 task" 예측 제거. 5초 grace period면 거의 동시에 끝나는 태스크를 묶을 수 있고, 아니면 바로 실행.

4. **night/day 프로파일은 config.json에서 관리**
   ```json
   {
     "batchReview": {
       "activeProfile": "day",
       "profiles": {
         "night": { "maxBatchSize": 5, "timeoutSeconds": 120 },
         "day": { "maxBatchSize": 3, "timeoutSeconds": 30 }
       }
     }
   }
   ```
   - night-worker.sh가 시작 시 `config.json`의 `activeProfile`을 `"night"`로 설정
   - 종료 시 `"day"`로 복원
   - orchestrate.sh는 매 iteration마다 config를 읽기만 함. 시간 판단 로직 불필요.

5. **macOS 호환 lock: `shlock` 또는 `ln -s` 패턴**
   - flock이 없는 macOS에서는 `ln -s "$$" "$lock"` (symlink는 atomic) 사용 가능
   ```bash
   acquire_lock() {
     while ! ln -s "$$" "$1" 2>/dev/null; do
       local owner=$(readlink "$1" 2>/dev/null)
       if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
         rm -f "$1"
       else
         sleep 1
       fi
     done
   }
   ```

**✅ 설계2 Round 4 완료. 설계1 차례.**

### Round 5 — 설계1 (설계2 Round 4 기반 문제 제기 + 개선안)

**설계2 개선안에 대한 문제점:**

1. **`mv` 기반 lock은 NFS/네트워크 드라이브에서 atomic하지 않음**
   - 이 프로젝트는 로컬 macOS이므로 당장 문제없지만, 향후 CI/CD나 원격 환경으로 확장 시 깨짐. 그런데 현실적으로 **이 프로젝트는 단일 머신에서만 돌리므로 과설계**. `ln -s` 패턴이면 충분하고, NFS 걱정은 그때 가서 해도 됨. lock 방식 논의에 3라운드를 썼는데, 합의점을 정리해야 함.

2. **고정 구분자 `===REVIEW:TASK-A:START===`의 태스크 ID 충돌**
   - TASK-A라는 ID가 실제 코드에 등장할 수 있음 (예: 주석에 "이건 TASK-A에서 추가한 기능"). `===REVIEW:` 접두사로 충분하다고 했지만, **diff 내용에 이전 리뷰 결과가 포함될 수 있음** (리뷰 피드백을 커밋 메시지에 넣는 경우). 하지만 이것도 현실적 확률이 극히 낮으므로 **고정 구분자로 확정하고 넘어가자.**

3. **5초 grace period의 근거가 약함**
   - "거의 동시에 끝나는 태스크를 묶기 위해 5초"라고 했는데, task 실행 시간이 30초~10분이면 5초 차이로 동시에 끝날 확률이 낮음. grace period가 의미 있으려면 최소 10~15초는 되어야 함. 하지만 이건 **실측 데이터 기반으로 튜닝**해야 할 영역이지 설계 단계에서 확정할 게 아님.

4. **config.json `activeProfile` 동적 변경의 파일 쓰기 충돌**
   - night-worker.sh가 config.json을 수정하고, orchestrate.sh가 동시에 읽으면 partial write를 읽을 수 있음. atomic write(tmp + mv)로 config를 갱신해야 함. 또는 **config.json은 읽기 전용으로 두고, 프로파일 전환은 별도 signal 파일로**.

5. **`ln -s` lock에서 stale symlink의 readlink 실패 케이스**
   - 프로세스가 죽으면서 symlink target(PID)이 의미 없어지는 건 맞지만, `readlink`가 빈 문자열을 반환하면 `kill -0 ""`가 에러. `[ -n "$owner" ]` 체크가 있지만, **symlink가 깨진 상태(dangling)일 때** readlink 동작이 OS마다 다를 수 있음. 실용적으로는 문제없지만 방어 코드 추가 권장.

**개선안 (합의점 정리):**

이제 5라운드째이므로, 지금까지의 논의를 **합의된 결정 사항**으로 정리:

#### 확정 사항

| 항목 | 결정 | 근거 |
|------|------|------|
| 큐 구조 | task queue + review queue (2단) | merge는 lockfile 직렬화, 별도 큐 불필요 (R2) |
| merge lock | `ln -s "$$" lock` symlink 방식 | macOS 호환, atomic, stale 감지 가능 (R4) |
| 배치 리뷰 구분자 | `===REVIEW:TASK-XXX:START/END===` 고정 | 충돌 확률 무시 가능, 파싱 단순 (R4) |
| 배치 전략 | count-timeout 단일 방식 | night/day는 파라미터만 다름, wait-all 제거 (R2) |
| night/day 전환 | config.json의 별도 필드 또는 signal 파일 | 시간 하드코딩 제거 (R4) |
| Phase 통합 | 처음부터 배치 구조, `maxBatchSize:1`로 시작 | 이중 구현 방지 (R2) |
| 프로세스 관리 | 글로벌 `MAX_CLAUDE_PROCS` + review 최소 보장 1슬롯 | task 우선이되 review 기아 방지 (R2, R3) |

#### 미확정 (실측 후 튜닝)

| 항목 | 초기값 | 튜닝 기준 |
|------|--------|----------|
| grace period | 5초 | 실제 태스크 완료 간격 분포 |
| day maxBatchSize | 3 | 리뷰 품질 vs 속도 트레이드오프 |
| night maxBatchSize | 5 | 야간 태스크 수 기반 |
| day timeoutSeconds | 30 | 사용자 체감 지연 |
| night timeoutSeconds | 120 | 야간 태스크 생성 속도 |
| MAX_CLAUDE_PROCS | 4 | 메모리 사용량 모니터링 |

#### 남은 논의 사항

1. **review-rejected 후 retry 시 배치 피드백 분리 추출 로직** — 아직 구체화 안 됨
2. **config.json 동시 접근 안전성** — atomic write 또는 별도 signal 파일 중 택 1
3. **개별 실행(TaskRunnerManager)에서 배치 리뷰 적용 여부** — 현재는 불필요하나 향후 다중 실행 시 필요

**✅ 설계1 Round 5 완료. 설계2 차례.**

### Round 6 — 설계2 (설계1 Round 5 합의 기반 + 남은 사항 해결)

설계1이 Round 5에서 합의점을 잘 정리했다. 확정 사항에 동의하며, **남은 논의 사항 3건**을 해결하고 추가 문제를 제기한다.

**남은 논의 사항 해결:**

#### 1. review-rejected 후 retry 시 배치 피드백 분리 추출 로직

**문제:** 배치 리뷰에서 TASK-A 승인, TASK-B 수정요청일 때, TASK-B의 피드백만 추출하여 retry 워커에게 전달해야 함.

**제안:**
```bash
extract_feedback() {
  local task_id="$1" review_output="$2"
  sed -n "/===REVIEW:${task_id}:START===/,/===REVIEW:${task_id}:END===/p" \
    "$review_output" | grep -v "===REVIEW:" > ".orchestration/feedback/${task_id}.md"
}

# 배치 결과 처리
for task_id in "${batch[@]}"; do
  local section=$(sed -n "/===REVIEW:${task_id}:START===/,/===REVIEW:${task_id}:END===/p" "$review_output")
  if echo "$section" | grep -q "^verdict: 승인"; then
    signal_create "$SIGNAL_DIR" "$task_id" "review-approved"
  else
    extract_feedback "$task_id" "$review_output"
    signal_create "$SIGNAL_DIR" "$task_id" "review-rejected"
  fi
done
```

retry 워커는 `.orchestration/feedback/TASK-XXX.md`를 읽어서 프롬프트에 포함:
```markdown
## 이전 리뷰 피드백
{feedback 내용}

위 피드백을 반영하여 코드를 수정해라.
```

#### 2. config.json 동시 접근 안전성

**결정: 별도 signal 파일 방식 채택**

config.json을 런타임에 수정하는 건 위험. 대신:
```
.orchestration/profile-active  → 내용: "night" 또는 "day"
```

- night-worker.sh 시작 시: `echo "night" > .orchestration/profile-active.tmp && mv .orchestration/profile-active.tmp .orchestration/profile-active`
- 종료 시: 같은 방식으로 `"day"` 기록
- orchestrate.sh: `BATCH_PROFILE=$(cat .orchestration/profile-active 2>/dev/null || echo "day")`
- config.json은 프로파일 **정의만** 담고, 어떤 프로파일이 활성인지는 signal 파일이 결정

#### 3. 개별 실행(TaskRunnerManager)에서 배치 리뷰 적용 여부

**결정: 적용하지 않음. 단, 인터페이스는 통일.**

- TaskRunnerManager는 1개 태스크만 처리하므로 배치가 무의미
- 하지만 리뷰 결과 포맷은 동일하게 `===REVIEW:TASK-XXX:START/END===` 사용
- 이유: 리뷰 결과 파싱 로직을 공유하기 위해. 개별이든 배치든 같은 `extract_feedback()` 함수로 처리

---

**추가 문제 제기:**

1. **배치 리뷰 실패(Claude 응답 불완전) 시 부분 성공 처리 미정의**
   - 3개 태스크 배치에서 TASK-A, TASK-B는 구분자가 있는데 TASK-C 구분자가 없으면? 현재 fallback은 "전체를 수정요청으로 처리"인데, A/B는 정상 파싱되었으므로 **파싱 성공한 것만 처리하고 실패한 것만 개별 리뷰로 재시도**가 더 효율적.

2. **review queue가 비어있을 때 review 보장 슬롯이 낭비됨**
   - review 큐가 빈 상태에서 RESERVED_REVIEW=1이면, task는 `MAX_CLAUDE_PROCS - 1 = 3`개만 쓸 수 있음. review 큐가 비어있을 때는 보장 슬롯을 task에 양보해야 함.

**개선안:**

1. **부분 성공 처리 로직**
   ```bash
   process_batch_result() {
     local parsed=0 failed=()
     for task_id in "${batch[@]}"; do
       if grep -q "===REVIEW:${task_id}:START===" "$review_output"; then
         # 정상 파싱 → 개별 처리
         process_single_verdict "$task_id" "$review_output"
         ((parsed++))
       else
         failed+=("$task_id")
       fi
     done
     # 파싱 실패한 것만 개별 리뷰 큐에 재등록
     for task_id in "${failed[@]}"; do
       enqueue_review "$task_id"  # 다음 배치 또는 개별 리뷰로
       log_warn "배치 파싱 실패: $task_id → 재큐잉"
     done
   }
   ```

2. **review 보장 슬롯의 동적 양보**
   ```bash
   can_dispatch_task() {
     local review_queue_size=$(ls .orchestration/review-queue/ 2>/dev/null | wc -l)
     local effective_reserved=$RESERVED_REVIEW
     if [ "$review_queue_size" -eq 0 ]; then
       effective_reserved=0  # 큐가 비면 양보
     fi
     local available=$((MAX_CLAUDE_PROCS - effective_reserved - running_reviews))
     [ "$running_tasks" -lt "$available" ]
   }
   ```

**✅ 설계2 Round 6 완료. 설계1 차례.**

### Round 7 — 설계1 (설계2 Round 6 기반 문제 제기 + 개선안)

설계2가 남은 3건을 잘 해결했고, 추가 문제 2건도 합리적이다. 부분 성공 처리와 동적 양보 모두 동의.

**설계2 개선안에 대한 문제점:**

1. **`extract_feedback`의 `sed` 파싱이 verdict 줄을 포함함**
   - `sed -n "/START/,/END/p"` 후 `grep -v "===REVIEW:"`로 구분자만 제거하는데, `verdict: 승인` 줄도 피드백 파일에 들어감. retry 워커가 "verdict: 수정요청"이라는 줄을 보고 혼란할 수 있음. verdict 줄도 제거하거나, 피드백 파일 포맷을 `verdict`와 `feedback`으로 분리해야 함.

2. **부분 성공 시 재큐잉된 태스크가 다시 배치에 묶일 수 있음**
   - TASK-C가 파싱 실패로 재큐잉 → 다음 배치에서 TASK-D, TASK-E와 묶임 → 또 TASK-C만 파싱 실패. 무한 재큐잉 가능. **재큐잉 횟수 제한(max 1회)** 후 개별 리뷰로 강제 전환해야 함.

3. **`.orchestration/profile-active` signal 파일이 없을 때의 초기 상태**
   - 첫 실행 시 파일이 없으면 `cat` 실패 → fallback `"day"`. 문제없지만, orchestrate.sh가 시작 시 명시적으로 파일을 생성하는 게 깔끔. 또한 **profile 파일이 night인 채로 night-worker가 크래시**하면 영구 night 모드. 타임스탬프 기반 자동 만료 필요.

4. **review 보장 슬롯 동적 양보에서 race condition**
   - `review_queue_size` 체크 → 0이라 양보 → task dispatch → 그 사이에 task가 완료되어 review queue에 추가. task가 MAX까지 차있어서 review 실행 불가. 하지만 이건 다음 iteration에서 해소되므로 **실질적 문제는 아님**. 메인 루프 주기(~2초)면 충분.

5. **리뷰 결과 포맷 통일(개별/배치 모두 `===REVIEW:===`)이 개별 리뷰에서 불필요한 오버헤드**
   - 개별 리뷰(1개)인데 구분자를 강제하면 리뷰어에게 불필요한 포맷 지시. 개별일 때는 기존대로 `"승인"` / `"수정요청"` 키워드 파싱으로 충분. **배치일 때만 구분자 사용**으로 분기.

**개선안:**

1. **피드백 파일에서 verdict 줄 분리**
   ```bash
   extract_feedback() {
     local task_id="$1" review_output="$2"
     local section
     section=$(sed -n "/===REVIEW:${task_id}:START===/,/===REVIEW:${task_id}:END===/p" "$review_output")
     # verdict 추출
     local verdict=$(echo "$section" | grep "^verdict:" | head -1 | sed 's/^verdict: *//')
     # 피드백만 추출 (구분자 + verdict 줄 제거)
     echo "$section" | grep -v "===REVIEW:" | grep -v "^verdict:" \
       > ".orchestration/feedback/${task_id}.md"
     echo "$verdict"  # 반환값으로 승인/수정요청 전달
   }
   ```

2. **재큐잉 최대 1회, 이후 개별 리뷰 강제**
   ```bash
   enqueue_review() {
     local task_id="$1"
     local retry_file=".orchestration/review-queue/${task_id}"
     local retry_count=0
     [ -f "$retry_file" ] && retry_count=$(cat "$retry_file")
     if [ "$retry_count" -ge 1 ]; then
       # 개별 리뷰로 강제 (배치에 안 묶음)
       echo "1" > "$retry_file.solo"  # solo 마커
     fi
     echo $((retry_count + 1)) > "$retry_file"
   }

   # dispatch 시 solo 마커 있으면 배치에서 제외
   ```

3. **profile 파일 자동 만료**
   ```bash
   # orchestrate.sh에서 profile 읽을 때
   read_active_profile() {
     local pf=".orchestration/profile-active"
     if [ -f "$pf" ]; then
       local age=$(( $(date +%s) - $(stat -f %m "$pf") ))
       if [ "$age" -gt 43200 ]; then  # 12시간 이상이면 stale
         echo "day"
         rm -f "$pf"
         return
       fi
       cat "$pf"
     else
       echo "day"
     fi
   }
   ```

4. **race condition은 수용** — Round 7에서 확인, 실질적 문제 아님으로 합의.

5. **리뷰 포맷 분기: 배치면 구분자, 개별이면 기존 키워드**
   ```bash
   if [ "${#batch[@]}" -eq 1 ]; then
     # 개별 리뷰: 기존 프롬프트 + "승인"/"수정요청" 키워드 파싱
     start_review_single "${batch[0]}"
   else
     # 배치 리뷰: 구분자 프롬프트
     start_review_batch "${batch[@]}"
   fi
   ```

**✅ 설계1 Round 7 완료. 설계2 차례.**

### Round 8 — 설계2 (설계1 Round 7 기반 문제 제기 + 개선안)

설계1의 피드백 분리, 재큐잉 제한, profile 자동만료 모두 합리적. 대부분 동의하되 일부 보완.

**설계1 개선안에 대한 문제점:**

1. **`extract_feedback()`에서 echo로 verdict 반환하는 패턴이 서브셸 의존적**
   - `verdict=$(extract_feedback "$task_id" "$output")` 형태인데, 함수 안에서 파일 쓰기 + echo 반환을 동시에 하면 가독성이 떨어지고, 파일 쓰기 실패 시에도 verdict가 반환됨. **verdict와 feedback을 모두 파일로 분리**하는 게 더 명확:
   ```
   .orchestration/feedback/TASK-XXX.verdict  → "승인" 또는 "수정요청"
   .orchestration/feedback/TASK-XXX.md       → 피드백 본문
   ```
   파일 기반이면 signal 시스템과도 일관성 있음.

2. **`retry_count`를 review-queue 파일 내용으로 관리하면 큐 파일의 역할이 이중화**
   - review-queue 파일은 "리뷰 대기 중"을 의미하는 마커인데, 내용에 retry count를 넣으면 파일의 존재=대기, 내용=메타데이터로 역할이 섞임. `.solo` 마커 파일도 추가되어 파일이 3개(큐 마커, 카운트, solo)로 늘어남. **단순화: review-queue 파일 내용을 JSON-like로 통합**:
   ```
   .orchestration/review-queue/TASK-XXX → "retry:0" 또는 "retry:1:solo"
   ```
   한 파일로 상태 관리. 파싱은 `IFS=: read` 한 줄.

3. **리뷰 포맷 분기(개별 vs 배치)가 코드 경로를 2개로 만듦**
   - `start_review_single`과 `start_review_batch`가 각각 다른 프롬프트와 파싱 로직을 가지면, 버그 수정이나 프롬프트 개선 시 두 곳을 동기화해야 함. 차라리 **항상 구분자 포맷 사용, 개별이어도 구분자 1개**. 오버헤드는 구분자 2줄뿐이고, 코드 경로 통일의 이점이 큼.

4. **profile 자동만료 12시간이 night-worker 실행 시간과 맞지 않을 수 있음**
   - night-worker가 22시에 시작하면 12시간 후 10시에 만료. 이건 합리적. 하지만 night-worker가 02시에 시작하면 14시에 만료되어, 오후까지 night 모드가 유지됨. **만료 시간을 고정 시간(예: 07:00)으로 설정**하는 게 더 직관적. 또는 night-worker 종료 시 반드시 "day"로 복구하는 걸 강제하고, 자동만료는 안전장치로만.

5. **`stat -f %m`은 macOS 전용 문법**
   - Linux에서는 `stat -c %Y`. 이 프로젝트는 macOS지만, 스크립트 이식성을 위해 `date` 기반으로 계산하거나, common.sh에 `file_age()` 헬퍼를 두는 게 좋다.

**개선안:**

1. **verdict + feedback 모두 파일 기반**
   ```bash
   process_verdict() {
     local task_id="$1" review_output="$2"
     local section
     section=$(sed -n "/===REVIEW:${task_id}:START===/,/===REVIEW:${task_id}:END===/p" "$review_output")

     local verdict=$(echo "$section" | grep "^verdict:" | head -1 | sed 's/^verdict: *//')
     echo "$verdict" > ".orchestration/feedback/${task_id}.verdict"

     echo "$section" | grep -v "===REVIEW:" | grep -v "^verdict:" \
       > ".orchestration/feedback/${task_id}.md"

     if [ "$verdict" = "승인" ]; then
       signal_create "$SIGNAL_DIR" "$task_id" "review-approved"
     else
       signal_create "$SIGNAL_DIR" "$task_id" "review-rejected"
     fi
   }
   ```

2. **review-queue 파일 내용 통합**
   ```bash
   # 초기 등록
   echo "retry:0" > ".orchestration/review-queue/${task_id}"

   # 재큐잉 시
   enqueue_review() {
     local task_id="$1"
     local qf=".orchestration/review-queue/${task_id}"
     local count=0
     [ -f "$qf" ] && count=$(cut -d: -f2 "$qf")
     if [ "$count" -ge 1 ]; then
       echo "retry:$((count+1)):solo" > "$qf"
     else
       echo "retry:$((count+1))" > "$qf"
     fi
   }

   # dispatch 시
   is_solo() {
     grep -q ":solo$" ".orchestration/review-queue/$1"
   }
   ```

3. **리뷰 포맷 항상 통일 (구분자 사용)**
   - 개별 리뷰에서도 `===REVIEW:TASK-XXX:START/END===` 사용
   - 파싱 함수 `process_verdict()`를 공유
   - 프롬프트 템플릿도 1개로 통일, 태스크 수만 다름

4. **profile 만료를 절대 시각 기반으로**
   ```bash
   read_active_profile() {
     local pf=".orchestration/profile-active"
     if [ -f "$pf" ]; then
       local current_hour=$(date +%H)
       local profile=$(cat "$pf")
       # night인데 7시 이후면 자동 day 복귀
       if [ "$profile" = "night" ] && [ "$current_hour" -ge 7 ] && [ "$current_hour" -lt 22 ]; then
         echo "day" > "$pf.tmp" && mv "$pf.tmp" "$pf"
         echo "day"
         return
       fi
       echo "$profile"
     else
       echo "day"
     fi
   }
   ```

5. **`file_age()` 헬퍼를 common.sh에 추가**
   ```bash
   file_age() {
     local file="$1"
     if [ "$(uname)" = "Darwin" ]; then
       echo $(( $(date +%s) - $(stat -f %m "$file") ))
     else
       echo $(( $(date +%s) - $(stat -c %Y "$file") ))
     fi
   }
   ```

**✅ 설계2 Round 8 완료. 설계1 차례.**

### Round 9 — 설계1 (최종 합의 + 구현 명세)

설계2의 Round 8 개선안에 전부 동의한다. 특히:
- verdict/feedback 파일 분리 ✅
- review-queue 파일 내용 통합(`retry:N:solo`) ✅
- 리뷰 포맷 항상 구분자 사용 (코드 경로 통일) ✅
- profile 만료를 절대 시각(7시~22시) 기반 ✅
- `file_age()` 크로스플랫폼 헬퍼 ✅

9라운드이므로 **최종 합의 정리 + 구현 명세**를 작성한다.

---

## 최종 설계 명세 (Round 1~8 합의)

### 아키텍처

```
┌─────────────────────────────────────────────────┐
│                orchestrate.sh 메인 루프           │
│                                                   │
│  ┌──────────┐    task-done     ┌──────────────┐  │
│  │task queue │ ──────────────→ │ review queue  │  │
│  │ slot 1~N  │                 │ (배치 수집)    │  │
│  └──────────┘                 └──────┬───────┘  │
│                                       │          │
│                           count≥max   │ timeout  │
│                           ───────────┤──────────│
│                                       ▼          │
│                              ┌──────────────┐    │
│                              │ batch review  │    │
│                              │ (1~N개 묶음)   │    │
│                              └──────┬───────┘    │
│                                      │           │
│                          approved    │ rejected   │
│                          ┌───────────┤──────┐    │
│                          ▼           ▼      │    │
│                   ┌───────────┐  ┌────────┐ │    │
│                   │merge(lock)│  │retry/  │ │    │
│                   │ 순차 실행  │  │ failed │ │    │
│                   └───────────┘  └────────┘ │    │
└─────────────────────────────────────────────────┘
```

### 파일 구조

```
.orchestration/
├── signals/              # 기존 signal 시스템 (변경 없음)
│   ├── TASK-XXX-task-done
│   ├── TASK-XXX-task-failed
│   └── ...
├── review-queue/         # [신규] 리뷰 대기 큐
│   ├── TASK-XXX          # 내용: "retry:0" 또는 "retry:1:solo"
│   └── TASK-YYY
├── feedback/             # [신규] 리뷰 피드백 저장
│   ├── TASK-XXX.verdict  # "승인" 또는 "수정요청"
│   └── TASK-XXX.md       # 피드백 본문
├── profile-active        # [신규] "night" 또는 "day"
├── .merge-lock           # [신규] symlink lock (PID)
└── config.json           # 기존 + batchReview 설정 추가
```

### config.json 추가 필드

```json
{
  "maxParallel": {
    "task": 2,
    "review": 2
  },
  "batchReview": {
    "enabled": true,
    "gracePeriodSeconds": 5,
    "profiles": {
      "night": { "maxBatchSize": 5, "timeoutSeconds": 120 },
      "day": { "maxBatchSize": 3, "timeoutSeconds": 30 }
    }
  },
  "reservedReviewSlots": 1
}
```

### 핵심 함수 명세

| 함수 | 파일 | 역할 |
|------|------|------|
| `enqueue_review()` | orchestrate.sh | review-queue에 태스크 등록 |
| `dispatch_reviews()` | orchestrate.sh | 배치 수집 + 리뷰 실행 판단 |
| `start_review_batch()` | orchestrate.sh | 배치 리뷰 프롬프트 생성 + job-review.sh 호출 |
| `process_verdict()` | orchestrate.sh | 구분자 파싱 → verdict/feedback 파일 생성 → signal |
| `process_batch_result()` | orchestrate.sh | 부분 성공 처리 + 실패 태스크 재큐잉 |
| `acquire_merge_lock()` | lib/merge-task.sh | `ln -s` 기반 lock 획득 |
| `release_merge_lock()` | lib/merge-task.sh | lock 해제 |
| `read_active_profile()` | orchestrate.sh | profile-active 읽기 + 7시 자동 day 복귀 |
| `file_age()` | lib/common.sh | 크로스플랫폼 파일 age 계산 |
| `can_dispatch_task()` | orchestrate.sh | task 슬롯 가용 판단 (review 큐 비면 양보) |
| `can_dispatch_review()` | orchestrate.sh | review 슬롯 가용 판단 (최소 1슬롯 보장) |

### 배치 수집 로직 (dispatch_reviews)

```bash
dispatch_reviews() {
  local profile=$(read_active_profile)
  local max_batch=$(jq -r ".batchReview.profiles.${profile}.maxBatchSize" "$CONFIG")
  local timeout=$(jq -r ".batchReview.profiles.${profile}.timeoutSeconds" "$CONFIG")
  local grace=$( jq -r ".batchReview.gracePeriodSeconds" "$CONFIG")

  local queue_files=(.orchestration/review-queue/*)
  local queue_size=${#queue_files[@]}
  [ "$queue_size" -eq 0 ] && return

  # solo 마커 태스크는 배치에서 제외, 개별 즉시 실행
  for qf in "${queue_files[@]}"; do
    if grep -q ":solo$" "$qf"; then
      local tid=$(basename "$qf")
      start_review_batch "$tid"  # 1개짜리 배치 = 개별
      rm -f "$qf"
      return
    fi
  done

  # 배치 판단
  local oldest_age=$(file_age "${queue_files[0]}")

  if [ "$queue_size" -ge "$max_batch" ]; then
    # 최대 크기 도달 → 즉시 배치
    collect_and_review "${queue_files[@]:0:$max_batch}"
  elif [ "$queue_size" -eq 1 ] && [ "$oldest_age" -lt "$grace" ]; then
    # 1개 + grace period 미경과 → 대기
    return
  elif [ "$oldest_age" -ge "$timeout" ]; then
    # 타임아웃 경과 → 있는 만큼 배치
    collect_and_review "${queue_files[@]}"
  fi
}
```

### 리뷰 프롬프트 템플릿 (통일)

```markdown
아래 태스크의 코드 변경을 리뷰해라.
각 태스크별로 아래 형식으로 결과를 작성해라.

===REVIEW:{task_id}:START===
verdict: 승인 | 수정요청
(상세 피드백)
===REVIEW:{task_id}:END===

{{#each tasks}}
## {{task_id}}: {{title}}
### 완료 조건
{{criteria}}
### 변경 내용 (git diff)
{{diff}}
{{/each}}
```

### 구현 순서

| 단계 | 내용 | 예상 |
|------|------|------|
| 1 | `file_age()`, `acquire/release_merge_lock()` 헬퍼 추가 | 30분 |
| 2 | orchestrate.sh에 `RUNNING_TASKS`/`RUNNING_REVIEWS` 분리 | 1시간 |
| 3 | `enqueue_review()` + `dispatch_reviews()` (maxBatchSize:1) | 1시간 |
| 4 | review 프롬프트 구분자 포맷 + `process_verdict()` | 1시간 |
| 5 | `process_batch_result()` 부분 성공 + 재큐잉 | 30분 |
| 6 | profile-active 시스템 + night-worker 연동 | 30분 |
| 7 | maxBatchSize:3으로 올려서 배치 리뷰 활성화 | 테스트 |
| 8 | E2E 테스트 | 1시간 |

**✅ 설계1 Round 9 완료. 설계2 차례 (최종 Round 10).**

### Round 10 — 설계2 (최종 리뷰 + 보완 + 서명)

설계1의 최종 명세에 대체로 동의한다. 아키텍처, 파일 구조, 함수 명세, 구현 순서 모두 잘 정리됨. **마지막 라운드이므로 최종 보완 사항만 짚고 승인한다.**

**보완 사항 3건:**

1. **`dispatch_reviews()`에서 bash 배열 슬라이싱 `${queue_files[@]:0:$max_batch}` 사용**
   - CLAUDE.md에 명시된 대로 macOS bash 3.x에서 배열 슬라이싱은 동작하지만, `mapfile`/`readarray`는 금지. 현재 코드에선 문제없으나 리마인더: **향후 구현 시 `mapfile` 절대 사용 금지**. 배열 구성은 `while read` 루프로.
   ```bash
   local queue_files=()
   while IFS= read -r f; do
     queue_files+=("$f")
   done < <(ls -t .orchestration/review-queue/ 2>/dev/null)
   ```

2. **구현 순서에 "롤백 계획" 누락**
   - 큐 분리는 orchestrate.sh의 메인 루프를 크게 바꿈. 배포 후 문제 발생 시 **기존 순차 로직으로 즉시 복귀할 수 있는 플래그**가 필요:
   ```json
   {
     "reviewQueueEnabled": true
   }
   ```
   `false`이면 기존 동작(task-done → 즉시 review → merge). 새 로직이 안정화될 때까지 유지.

3. **E2E 테스트 시나리오 구체화 필요**
   - 구현 순서 8번 "E2E 테스트"가 추상적. 최소 검증 시나리오:

   | 시나리오 | 검증 포인트 |
   |---------|-----------|
   | task 2개 동시 완료 → 배치 리뷰 | 2개가 하나의 리뷰로 묶이는지 |
   | task 1개 완료 → timeout 후 단독 리뷰 | grace period + timeout 동작 |
   | 배치 리뷰 중 1개 파싱 실패 | 부분 성공 + 재큐잉 동작 |
   | 재큐잉된 태스크 → solo 개별 리뷰 | solo 마커 동작 |
   | merge 2개 동시 요청 | lockfile 직렬화 |
   | night-worker 시작/종료 | profile-active 전환 |
   | night 모드에서 7시 경과 | 자동 day 복귀 |
   | `reviewQueueEnabled: false` | 기존 순차 로직 동작 |

---

**최종 합의 확인 (설계2 서명):**

Round 1~9에서 논의한 모든 확정 사항에 동의한다:

- ✅ 2단 큐 (task → review) + merge lockfile 직렬화
- ✅ `ln -s` symlink 기반 merge lock (macOS 호환)
- ✅ `===REVIEW:TASK-XXX:START/END===` 고정 구분자 (항상 사용)
- ✅ count-timeout 단일 배치 전략 (night/day 파라미터만 분기)
- ✅ profile-active signal 파일 + 절대 시각 자동만료
- ✅ `maxBatchSize: 1`부터 시작하는 Phase 통합 구현
- ✅ 글로벌 `MAX_CLAUDE_PROCS` + review 최소 보장 1슬롯 + 동적 양보
- ✅ verdict/feedback 파일 분리
- ✅ 부분 성공 처리 + 재큐잉 최대 1회 → solo 강제
- ✅ `file_age()` 크로스플랫폼 헬퍼

**추가 확정:**
- ✅ `reviewQueueEnabled` 플래그로 롤백 가능
- ✅ E2E 테스트 시나리오 8건

**✅ 설계2 Round 10 완료. 10라운드 리뷰 프로세스 종료.**
