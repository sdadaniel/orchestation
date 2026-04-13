# 오류: task-db-sync CASE WHEN 보호 로직으로 DB 고착 + 인덱스 손상

## 발생일
2026-04-13

## 증상
1. 프론트엔드(3000포트)에서 TASK-348/349/350이 계속 `in_progress`로 표시
2. 실제 `.orchestration/tasks/*.md` 파일은 `rejected` 상태
3. 수동으로 파일을 편집해도 DB가 갱신되지 않음
4. 복구 시도 중 DB 인덱스 손상 발견:
   ```
   wrong # of entries in index idx_tasks_status
   wrong # of entries in index sqlite_autoindex_tasks_1
   ```
5. 프론트엔드 `/api/tasks` GET이 500 에러 반환 → 태스크 조회 전면 불가

## 근본 원인

### 원인 1: CASE WHEN 보호 로직이 터미널 상태도 잠가버림

`src/frontend/src/lib/task-db-sync.ts`의 ON CONFLICT 업데이트 구문:

```sql
status=CASE WHEN tasks.status IN ('in_progress','reviewing','done','failed','rejected','stopped')
       THEN tasks.status         -- DB 값 유지
       ELSE excluded.status END  -- 파일 값 사용
```

보호 대상이 **`pending`을 제외한 모든 상태**라 실질적으로 영구 잠금.

원래 의도: "UI 파일 저장이 엔진의 `in_progress` 상태를 덮어쓰지 못하게 방어". 하지만 엔진 크래시로 DB가 `in_progress`에 고착되면 어느 경로로도 풀 수 없음.

### 원인 2: WAL 동시 쓰기로 인한 인덱스 손상

복구 시도 과정에서 세 writer가 동시에 DB에 접근:
1. Next.js dev server(better-sqlite3 WAL 연결)
2. `sqlite3` CLI UPDATE
3. 일회성 Node 스크립트(better-sqlite3)

SQLite는 단일 writer를 보장하지만, 파일 시스템 레벨 경합과 WAL 체크포인트 타이밍이 맞물리면서 `idx_tasks_status` 인덱스의 엔트리 카운트가 실제 행과 어긋남.

### 트리거 시나리오

1. 과거 엔진 실행이 TASK-348/349/350을 `in_progress`로 DB+파일에 기록
2. 엔진 프로세스 비정상 종료 (크래시/kill)
3. 누군가 파일을 `rejected`로 수동 정리
4. 파일→DB sync 경로가 실행될 때마다 CASE WHEN이 DB의 `in_progress`를 방어 → 영구 고착
5. cleanupZombies는 파일이 이미 `rejected`라 매치 안 되어 무력화
6. 복구 시도 중 동시 writer 충돌로 인덱스 손상

## 수정 내용

### Fix A: CASE WHEN 재설계 (task-db-sync.ts:40-47)

파일이 터미널 상태(`done/failed/rejected`)면 DB 방어를 우회하고 항상 반영:

```sql
status=CASE
  WHEN excluded.status IN ('done','failed','rejected') THEN excluded.status
  WHEN tasks.status IN ('in_progress','reviewing','done','failed','rejected','stopped') THEN tasks.status
  ELSE excluded.status
END
```

터미널 상태는 되돌릴 일이 없으므로 우회가 안전하고, 파일 수동 정리 경로가 살아남음.

### Fix B: DB 덤프·복원

1. dev server 종료 후 `.orchestration/orchestration.db*` 백업 (`.orchestration/backup/`)
2. `sqlite3 .dump > /tmp/orch-dump.sql` — 4377 라인 추출, 말미 `ROLLBACK; -- due to errors`
3. `ROLLBACK`을 `COMMIT`으로 치환
4. 손상 DB 삭제 후 덤프 restore
5. `PRAGMA integrity_check` = `ok` 확인 (tasks 280건, conversations 2454건, docs 209건 등 보존)

### Fix C: TASK-348/349/350 파일 정리

- 3건 모두 frontmatter `status`를 `failed`로 통일, `updated`를 2026-04-13으로 갱신
- TASK-349 파일 본문에 중복된 frontmatter 블록이 있어 정리 (별도 corruption — 발생 경로 미확인)
- DB에는 dev server 재시작 후 `/api/tasks` GET이 호출하는 `syncAllTaskFilesToDb()`로 자동 재삽입 (새 CASE WHEN 덕분에 `failed`가 정상 반영)

## 재발 방지

- **CASE WHEN 재설계** (Fix A 적용 완료) — 터미널 상태 잠금 해제
- **관련 TODO**: `docs/todo/task-db-sync-case-when-bug.md`에 추가 개선 옵션 기록
  - 옵션 B: `updated` 타임스탬프 비교로 파일 우선 결정
  - 옵션 C: 엔진 start 시 파일 기준 DB rebuild 경로 추가
- **WAL 충돌 방지**: 운영 중 DB에 여러 writer가 직접 쓰지 않도록 주의. 디버깅 시 dev server를 먼저 종료하고 작업

## 교훈

1. 방어적 SQL 로직도 역방향(정리 경로)을 반드시 고려해야 함 — "보호"가 "영구 잠금"이 되지 않도록 escape hatch 필요
2. 디스크 상태(파일)와 DB 상태가 진실 소스로 경쟁할 때, 명시적인 우선순위 규칙이 없으면 사고 시 복구 불가
3. SQLite WAL 모드에서 CLI와 애플리케이션이 동시 쓰기를 하면 인덱스가 손상될 수 있음
