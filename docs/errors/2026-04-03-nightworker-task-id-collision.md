# Night Worker 태스크 ID 충돌 및 DB Sync 누락 (2026-04-03)

## 요약

Night Worker가 동시 또는 연속 실행될 때 동일한 TASK ID로 파일이 2개 생성되며, 일부 태스크가 대시보드에 표시되지 않는 문제.

## 발생 일시
2026-04-03

## 증상

### 증상 1: 같은 TASK ID로 파일이 2개 존재
`.orchestration/tasks/` 에 동일 ID의 파일이 slug만 다르게 2개씩 생성됨:

```
TASK-332-orchestrate-engine-하드코딩-상수-추출-및-기능-제안.md         → status: failed
TASK-332-orchestrate-engine-하드코딩-상수-추출-및-신규-기능-제안-문서화.md → status: pending

TASK-333-hooks-error-handling-중복-geterrormessage-유틸-통합.md       → (slug 소문자)
TASK-333-hooks-error-handling-중복-getErrorMessage-통합.md           → (slug 대소문자 혼용)

TASK-338, TASK-339, TASK-340도 동일 패턴
```

총 5개 ID에서 충돌 발생: TASK-332, 333, 338, 339, 340

### 증상 2: 파일 291개 vs API 270개 (21개 누락)
- `.orchestration/tasks/`에 파일 291개 존재
- `GET /api/tasks` 응답은 270개
- DB sync 시 같은 ID의 두 번째 파일이 첫 번째를 덮어쓰거나, 하나만 sync됨

### 증상 3: 대시보드에서 pending 태스크 일부 미표시
- 파일에는 pending 15개 존재
- API는 pending 11개 반환
- 4개가 ID 충돌로 인해 누락

## 근본 원인

### 원인 1: `next_task_id()` 경쟁 조건

`night-worker.sh`의 `next_task_id()` (line 142-164):

```bash
next_task_id() {
  local lock_file="$REPO_ROOT/.orchestration/task-id.lock"
  while ! mkdir "$lock_file" 2>/dev/null; do
    sleep 1
  done
  trap "rmdir '$lock_file' 2>/dev/null" RETURN

  local max_num=0
  for f in "$TASK_DIR"/TASK-*.md; do
    [ -f "$f" ] || continue
    local num
    num=$(basename "$f" | grep -o 'TASK-[0-9]*' | grep -o '[0-9]*')
    if [ -n "$num" ] && [ "$num" -gt "$max_num" ]; then
      max_num="$num"
    fi
  done
  local next_id
  next_id=$(printf "TASK-%03d" $((max_num + 1)))
  touch "$TASK_DIR/${next_id}-reserved.md"
  echo "$next_id"
}
```

**문제점:**
- lock은 `mkdir` 기반이지만, `trap RETURN`으로 함수 리턴 시 해제됨
- Night Worker가 **여러 인스턴스 동시 실행**되면 (대시보드 Start 연타, CLI 수동 실행 등):
  - 인스턴스 A가 lock 획득 → TASK-332 reserved → lock 해제
  - Claude 스캔 중 (수분 소요)
  - 인스턴스 B가 lock 획득 → `TASK-332-reserved.md` 존재하지만, max_num 계산 시 `-reserved` 파일의 ID를 파싱 → 다시 TASK-332 반환
  - 두 인스턴스가 같은 ID로 다른 slug의 파일 생성

- **Reserved 파일 패턴**: `${next_id}-reserved.md`는 `TASK-332-reserved.md`로 생성되는데, 다음 `next_task_id()` 호출 시 `grep -o 'TASK-[0-9]*'`가 이 파일에서 `TASK-332`를 추출 → max_num=332 → next=333.
  - 하지만 reserved 파일이 실제 태스크 파일(TASK-332-실제제목.md)로 rename되기 **전에** 다른 인스턴스가 스캔하면, reserved 파일은 있지만 max_num 계산에는 포함됨 → 이 경우는 충돌 안 됨
  - **실제 충돌 시나리오**: Claude가 태스크 내용을 생성하는 동안 reserved 파일이 삭제되고 실제 파일이 생성되는 타이밍에 다른 인스턴스가 끼어드는 경우

### 원인 2: Night Worker 다중 인스턴스 방지 미흡

- `POST /api/night-worker`에서 PID 파일로 중복 실행을 체크하지만, PID 파일이 생성되지 않는 버그가 있었음 (이번 세션에서 수정됨)
- CLI로 직접 `bash scripts/night-worker.sh`를 실행하면 PID 체크를 우회
- 대시보드 Start 버튼을 빠르게 연타하면 API 요청이 중복 전송될 수 있음

### 원인 3: DB Sync가 같은 ID 중복 파일을 처리 못함

`syncAllTaskFilesToDb()`는 파일을 순회하며 `INSERT ... ON CONFLICT(id) DO UPDATE`를 실행. 같은 ID의 파일이 2개이면:
- 먼저 읽힌 파일이 INSERT됨
- 두 번째 파일이 같은 ID로 UPDATE → 첫 번째 내용을 덮어씀
- 결과: 2개 파일 중 1개만 DB에 반영, 다른 1개는 유실

## 영향

- pending 태스크가 대시보드에 표시 안 됨
- orchestrate.sh가 파일 기반으로 태스크를 찾으므로 같은 ID 파일 2개 중 하나만 처리 → 나머지 방치
- ID 충돌한 태스크의 실행 결과가 뒤섞일 위험

## 재발 방지 제안

### 단기
1. **ID 생성 시 파일 존재 여부 추가 검증**: reserved 파일뿐 아니라 같은 prefix의 실제 파일이 있는지도 체크
2. **Night Worker 단일 인스턴스 강제**: PID 파일 + flock 기반 배타적 실행 보장
3. **중복 ID 파일 감지 스크립트**: 배치 실행 전 같은 ID 파일 존재 여부 검사

### 중기
4. **ID를 DB 시퀀스로 관리**: 파일 시스템 스캔 대신 `SELECT MAX(id)` + `INSERT`로 원자적 ID 생성
5. **프론트엔드 Start 버튼 debounce**: POST 요청 후 응답 올 때까지 버튼 비활성화

### 장기
6. **ID 충돌 자동 감지 + 경고**: `syncAllTaskFilesToDb()` 시 같은 ID 파일이 2개 이상이면 Notice 발행

## 현재 충돌 목록

| ID | 파일 1 (status) | 파일 2 (status) |
|----|----------------|----------------|
| TASK-332 | 하드코딩-상수-추출-및-기능-제안 (failed) | 하드코딩-상수-추출-및-신규-기능-제안-문서화 (pending) |
| TASK-333 | 중복-geterrormessage-유틸-통합 | 중복-getErrorMessage-통합 |
| TASK-338 | 배열-인덱스-접근-타입-안전성-추가 | 배열-인덱스-타입-안전성-추가 |
| TASK-339 | crypto-randomuuid-교체-및-신규-기능-제 (잘림) | crypto-randomuuid-교체-및-신규-기능-제안 |
| TASK-340 | json-error-response-중복-유틸-추출 | json-에러-응답-중복-유틸-추출 |
