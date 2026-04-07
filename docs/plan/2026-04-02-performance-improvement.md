---
title: orchestrate.sh 속도 개선 계획
created: 2026-04-02
status: draft
---

# orchestrate.sh 속도 개선 계획

## 현재 상황

메인 루프 1회 순환이 체감상 느림. 원인 분석 결과 아래 병목이 확인됨.

---

## 1. Notice 파일 폭증 (가장 시급)

**현상**: `.orchestration/notices/`에 2,962개 파일(12MB) 누적. git status, find, glob 등 모든 파일시스템 작업이 느려짐.

**원인**: notice 생성만 있고 자동 정리(rotation/purge)가 없음.

**개선안**:
- notice 파일 자동 정리: 최근 N개(예: 100개) 또는 최근 7일 이외 파일 삭제
- 오래된 notice는 아카이브 파일 1개로 병합 (`.orchestration/notices/archive.log`)
- `post_notice()` 호출 시 자동 rotation 체크 추가
- **즉시 조치**: 현재 누적된 notice 일괄 삭제

```bash
# 예시: 최근 50개 제외 삭제
ls -1t .orchestration/notices/NOTICE-*.md | tail -n +51 | xargs rm -f
```

**예상 효과**: git status ~3초 → <0.5초, 모든 파일시스템 작업 개선

---

## 2. 메인 루프 매 순환마다 반복되는 비싼 연산

### 2-1. `get_task_ids()` 매 루프 전체 스캔

**현상**: 매 루프마다 `find` + 파일별 `get_field` x 4회 (id, priority, status, sort_order) 호출. 태스크 10개면 서브프로세스 40+회 생성.

**개선안**:
- SQLite DB에서 직접 pending/stopped 태스크 목록 쿼리 (이미 DB에 status 동기화됨)
- `sqlite3 "$DB_FILE" "SELECT id FROM tasks WHERE status IN ('pending','stopped') ORDER BY ..."`
- 파일 스캔은 DB 없을 때의 fallback으로만 유지

### 2-2. config.json 핫 리로드 (jq x 2~4회/루프)

**현상**: 매 루프 `jq` 2회 호출 (maxParallel.task, maxParallel.review). jq는 JSON 전체 파싱하므로 무거움.

**개선안**:
- config 파일의 mtime 비교 → 변경 시에만 리로드
- `stat -f %m` 한 번으로 변경 여부 판단, 변경 없으면 skip

```bash
_config_mtime=$(stat -f %m "$CONFIG_FILE" 2>/dev/null || echo 0)
if [ "$_config_mtime" != "$_last_config_mtime" ]; then
  # jq 호출은 여기서만
  _last_config_mtime="$_config_mtime"
fi
```

### 2-3. `can_dispatch()` — pgrep + memory_pressure 매번 호출

**현상**: `pgrep -f "claude.*--dangerously-skip-permissions"` 매 dispatch 시도마다 호출. `memory_pressure`도 매번.

**개선안**:
- RUNNING 배열 크기로 프로세스 수 추정 (이미 추적 중이므로 pgrep 불필요)
- memory_pressure는 30초 캐시 (시스템 메모리 상태는 빈번히 변하지 않음)

---

## 3. 서브프로세스 과다 생성

### 3-1. `get_field()` — 매 호출마다 awk 서브프로세스

**현상**: YAML frontmatter 파싱에 `awk` 서브프로세스 1개씩 생성. 한 태스크에 대해 id/status/priority/sort_order/branch/worktree 등 여러 번 호출.

**개선안**:
- `get_fields()` 복수형 함수 추가: 1회 awk 호출로 여러 필드 동시 추출

```bash
# 한 번의 awk로 여러 필드 추출
get_fields() {
  local file="$1"; shift
  awk '
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm { for (i=1; i<=ARGC-1; i++) if ($0 ~ "^"ARGV[i]":") { sub("^"ARGV[i]":[ ]*",""); print ARGV[i]"="$0 } }
  ' "$@" "$file"
}
```

### 3-2. `_set_status()` — sed_inplace 2회 호출

**현상**: status 변경 시 `sed_inplace` 2회 (status + updated). sed는 파일 전체를 읽고 다시 씀.

**개선안**:
- 1회 awk 호출로 status + updated 동시 변경

---

## 4. Signal 대기 최적화

**현상**: fswatch 사용 중이지만 내부에서 0.3초 간격 polling loop + glob 패턴 매칭 반복.

**개선안**:
- fswatch가 이벤트를 감지하면 즉시 break (현재는 이벤트 후에도 glob 체크)
- fswatch의 stdout을 read로 직접 받아 파일명 기반 판단

```bash
wait_for_signal() {
  # 이미 도착한 시그널 즉시 체크
  for sf in "$SIGNAL_DIR"/*; do
    [ -f "$sf" ] && return 0
  done

  if command -v fswatch &>/dev/null; then
    # fswatch 이벤트를 직접 read (polling 없음)
    timeout 10 fswatch -1 --event Created "$SIGNAL_DIR" 2>/dev/null || true
    return 0
  fi
  sleep 1
}
```

---

## 5. find_file() 캐시 개선

**현상**: 60초마다 전체 캐시 리빌드 (`rm -f` + 전체 디렉토리 순회). 캐시 미스 시 `find` 호출.

**개선안**:
- 캐시 갱신 주기를 mtime 기반으로 변경 (디렉토리 mtime 변경 시에만 리빌드)
- 캐시 히트율이 높으므로 리빌드 주기를 300초로 늘려도 됨

---

## 6. Git 연산 최소화

**현상**: 태스크 상태 변경마다 `git add`, 머지 시 `git stash/merge/pop`. 이미 배치 commit을 하고 있지만 `git add`는 여전히 개별 호출.

**개선안**:
- `git add`도 배치로: 변경된 파일 목록을 변수에 모아서 루프 끝에 한 번에 `git add`
- `git diff --quiet` 체크도 캐시 (같은 루프 내 중복 호출 방지)

---

## 7. scope_not_conflicting() 이중 루프

**현상**: O(running * new_scope * running_scope) 비교. scope 패턴이 많으면 느림.

**개선안**:
- 실행 중 scope를 flat set으로 관리 (실행 시 추가, 완료 시 제거)
- 새 태스크의 scope만 set에서 prefix match 체크 → O(new_scope) 로 축소

---

## 우선순위 요약

| # | 항목 | 난이도 | 효과 | 우선순위 |
|---|------|--------|------|----------|
| 1 | Notice 파일 정리 + rotation | 낮음 | 높음 | **P0** |
| 2-1 | get_task_ids() → DB 쿼리 | 중간 | 높음 | **P1** |
| 2-2 | config 리로드 mtime 캐시 | 낮음 | 중간 | **P1** |
| 2-3 | can_dispatch() 캐시 | 낮음 | 중간 | **P1** |
| 3-1 | get_fields() 복수 추출 | 중간 | 높음 | **P1** |
| 4 | Signal 대기 개선 | 중간 | 중간 | **P2** |
| 5 | find_file 캐시 mtime 기반 | 낮음 | 낮음 | **P2** |
| 6 | git add 배치화 | 낮음 | 낮음 | **P2** |
| 7 | scope 충돌 검사 최적화 | 중간 | 낮음 | **P3** |
| 3-2 | _set_status 단일 호출 | 낮음 | 낮음 | **P3** |

---

## 즉시 실행 가능한 조치

1. `.orchestration/notices/` 내 오래된 파일 일괄 삭제
2. config 리로드에 mtime 캐시 적용 (5줄 변경)
3. `can_dispatch()`에서 pgrep 대신 RUNNING 배열 크기 사용 (3줄 변경)

이 3가지만으로도 체감 속도 대폭 개선 예상.

---

## 후기 (2026-04-02 설계1 검토)

### 문서 품질

분석이 정확하고 우선순위 판단도 합리적이다. 특히 병목의 근본 원인(notice 파일 2,962개)을 P0으로 잡은 것이 맞다. 실제 확인 결과 현재도 **2,962개가 그대로 남아있다** — 아직 아무 조치도 안 된 상태.

### 현재 코드와 대조한 구현 상태

| # | 항목 | 구현 여부 | 비고 |
|---|------|----------|------|
| 1 | Notice 파일 정리 + rotation | ❌ 미구현 | 2,962개 그대로. **가장 시급** |
| 2-1 | get_task_ids() → DB 쿼리 | ❌ 미구현 | 여전히 find + get_field 방식 |
| 2-2 | config 리로드 mtime 캐시 | ❌ 미구현 | mtime 비교 로직 없음 |
| 2-3 | can_dispatch() 캐시 | ❌ 미구현 | pgrep + memory_pressure 매번 호출 |
| 3-1 | get_fields() 복수 추출 | ❌ 미구현 | get_field 개별 호출 12회+ |
| 3-2 | _set_status 단일 호출 | ❌ 미구현 | sed_inplace 2회 |
| 4 | Signal 대기 개선 | 부분 구현 | fswatch 사용 중이나 내부 polling 잔존 |
| 5 | find_file 캐시 mtime 기반 | ❌ 미구현 | 60초 주기 리빌드 방식 |
| 6 | git add 배치화 | ✅ 구현됨 | 배치 commit은 이미 적용 |
| 7 | scope 충돌 검사 최적화 | ❌ 미구현 | 이중 루프 유지 |

### 실행 권고

1. **P0 즉시 실행**: notice 정리 + rotation 추가. 이것 하나로 git status, find 등 모든 FS 연산이 빨라진다. night-worker가 계속 태스크를 생성하면서 notice도 쌓이고 있으므로 방치하면 악화된다.
2. **P1 빠른 승리**: config mtime 캐시(5줄), can_dispatch에서 pgrep 제거(3줄)는 코드 변경량이 극히 적다. 태스크로 만들 필요 없이 바로 적용할 수 있다.
3. **get_task_ids() → DB 쿼리**는 효과가 크지만 fallback 로직 관리가 필요하므로 태스크로 분리 권장.

### 누락된 개선 포인트

- **`git status` 자체의 비용**: notice 파일이 untracked로 2,962개 있으면 git status가 이 모든 파일을 열거한다. `.gitignore`에 `.orchestration/notices/`를 추가하는 것만으로도 git 관련 연산이 즉시 개선된다.
- **`INPROGRESS_TIMEOUT` 체크 비용**: 이번에 추가된 in_progress 타임아웃 로직이 매 시그널 체크마다 `stat` + 파일 읽기를 수행한다. 현재 규모에서는 무시 가능하지만, 향후 RUNNING 태스크가 많아지면 캐싱 고려.
- **orchestrate.sh 자체를 Node로 전환**: 이 문서의 모든 병목은 "bash에서 서브프로세스를 반복 생성"하는 구조적 문제다. 장기적으로 orchestrate-engine.ts로 완전 전환하면 이 문서의 대부분이 자연 해소된다.

---

## 후기 (2026-04-02 설계2 검토)

### 전체 평가

분석 문서의 병목 식별과 우선순위 매기기는 정확하다. 설계1의 코드 대조 리뷰도 동의한다. 아래는 코드를 직접 대조하면서 발견한 추가 지적사항.

### 제안별 코멘트

**1. Notice 파일 정리** — 동의. 다만 제안된 예시 코드 `ls -1t | tail -n +51 | xargs rm -f`는 파일명에 한글이 포함되어 있어 `xargs`가 깨질 수 있다. `find`로 mtime 기반 삭제가 더 안전하다:
```bash
find .orchestration/notices/ -name "NOTICE-*.md" -mtime +7 -delete
```
또한 `post_notice()`에 rotation을 넣으면 매 notice 생성마다 `find`가 도는 오버헤드가 생긴다. rotation은 메인 루프 시작 시 1회만 실행하는 것이 낫다.

**2-1. get_task_ids() → DB 쿼리** — 동의하지만 주의점 있음. 현재 `get_task_ids()`는 `done|in_progress`를 조기 제외하고 priority/sort_order/status_weight 세 기준으로 정렬한다. DB 쿼리로 전환할 때 이 정렬 로직을 SQL ORDER BY로 정확히 옮겨야 한다. 특히 `stopped`가 `pending`보다 우선하는 status_weight 로직이 빠지면 stopped 태스크 재개가 늦어진다.

**2-2. config mtime 캐시** — 동의. 코드 변경 5줄 미만이고 부작용 없다. 다만 `stat -f %m`은 macOS 전용이다. Linux에서는 `stat -c %Y`이므로 이미 `uname` 분기가 있는 `can_dispatch()` 패턴을 참고하면 된다.

**2-3. can_dispatch() pgrep 제거** — **부분 동의**. RUNNING 배열 크기로 대체하면 좋지만, 워커가 비정상 종료(SIGKILL 등)했을 때 RUNNING에서 제거 안 된 좀비 항목이 남으면 실제 프로세스 수와 괴리가 생긴다. 10회 루프마다 health-sweep(1302행)이 PID 생존을 체크하고 있으므로, pgrep 완전 제거보다는 **평상시에는 RUNNING 크기, N루프마다 pgrep로 보정**하는 2단계가 더 안전하다.

**3-1. get_fields() 복수 추출** — 동의. 현재 `get_task_ids()`에서 태스크 1개당 `get_field` 4회(id, priority, status, sort_order)를 호출한다(319~326행). 태스크 20개면 awk 80회. 제안된 `get_fields()` 코드는 동작하지만, ARGV 사용 방식이 비표준이다. 아래가 더 portable:
```bash
get_fields() {
  local file="$1"; shift
  awk -v fields="$*" '
    BEGIN { n=split(fields, keys) }
    NR==1 && /^---$/ { in_fm=1; next }
    in_fm && /^---$/ { exit }
    in_fm { for (i=1;i<=n;i++) if ($0 ~ "^"keys[i]":") { sub("^"keys[i]":[ ]*",""); print keys[i]"="$0 } }
  ' "$file"
}
```

**4. Signal 대기** — 현재 코드(255~279행)를 보면 fswatch를 백그라운드로 띄우고 0.3초 sleep + glob 체크 polling을 돌리고 있다. 제안된 `fswatch -1 ... | timeout` 방식이 맞지만, 현재 코드의 `waited` 카운터가 정수 단위(`waited=$((waited + 1))`)인데 sleep은 0.3초라서 실제 타임아웃이 10×0.3=3초다. 10초가 의도였으면 버그다.

**7. scope 충돌 검사** — flat set 제안은 좋으나, bash 3.x에서 `declare -A` 불가(344행 주석 참고). 파일 기반 set(find_file 캐시처럼)이나 구분자 join 문자열로 구현해야 한다.

### 추가 발견

- **`get_task_ids()` 내 `local` 남용**: 310행~341행의 파이프 `while read` 루프 안에서 `local` 선언을 하고 있는데, 서브쉘에서 `local`은 의미가 없다. bash 3.x에서는 경고를 억제하기 위해 `2>/dev/null || true`를 붙이고 있지만(318행), 이 자체가 코드 냄새다.
- **`count_claude_procs()`가 자기 자신도 카운트**: `pgrep -f "claude.*--dangerously-skip-permissions"`는 grep 자체의 프로세스도 잡을 수 있다. `pgrep -f` 구현에 따라 다르지만, 과다 카운트 시 dispatch가 불필요하게 블록된다.

### 우선순위 의견

설계1과 동일. P0(notice 정리)은 태스크 없이 즉시 실행. P1 중 config mtime은 5줄 변경이므로 같이 묶어서 즉시 적용 가능. 나머지는 태스크로 분리.
