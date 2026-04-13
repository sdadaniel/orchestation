# task-db-sync CASE WHEN 보호 로직 재설계

## 문제 (2026-04-13 발견)

`src/frontend/src/lib/task-db-sync.ts:40`:

```sql
status=CASE WHEN tasks.status IN ('in_progress','reviewing','done','failed','rejected','stopped')
       THEN tasks.status         -- DB 값 유지
       ELSE excluded.status END  -- 파일 값 사용
```

보호 대상이 사실상 **`pending`을 제외한 모든 상태**라, 한 번 non-pending으로 박히면 파일을 수정해도 DB가 절대 갱신되지 않음.

### 실제 사고 사례

1. 엔진 실행 중 TASK-348/349/350이 DB+파일에 `in_progress`로 기록
2. 엔진 프로세스 크래시 → DB `in_progress` 잔존
3. 파일을 수동으로 `rejected`로 수정
4. 파일→DB sync 호출 → CASE WHEN이 DB의 `in_progress` 방어 → **영구 고착**
5. 프론트엔드(3000포트)가 DB를 읽으므로 사용자는 계속 `in_progress`로 보게 됨

cleanupZombies()도 소용없음: 파일이 이미 `rejected`라 매치되지 않음.

## 원래 의도

UI에서 태스크 폼을 저장할 때 파일도 다시 쓰는데, 이때 파일의 status는 대체로 `pending` 혹은 사용자가 고른 값이 들어감. 엔진이 이미 `in_progress`로 진행 중인 태스크를 UI 저장으로 덮어쓰지 못하게 하려는 방어였을 것.

## 개선 옵션

### 옵션 A (권장) — 터미널 상태는 파일 우선
파일 쪽 status가 `done/failed/rejected` 중 하나면 보호 로직을 우회하고 무조건 덮어쓴다. 터미널 상태는 되돌릴 일이 없으므로 안전.

```sql
status=CASE
  WHEN excluded.status IN ('done','failed','rejected') THEN excluded.status
  WHEN tasks.status IN ('in_progress','reviewing','done','failed','rejected','stopped') THEN tasks.status
  ELSE excluded.status
END
```

### 옵션 B — `updated` 타임스탬프 비교
파일의 `updated`가 DB보다 최신이면 파일을 신뢰. 타임스탬프가 1분 해상도라 동시 업데이트 시 엣지 케이스 존재.

### 옵션 C — 엔진 시작 시 DB rebuild
`start()`에서 `syncAllTaskFilesToDb`를 CASE WHEN 우회 플래그와 함께 1회 호출. 엔진이 "지금부터 나의 진실이 파일이다" 하고 선언하는 셈.

### 옵션 D — 쓰기 경로 분리
UI 저장 경로와 엔진 상태 업데이트 경로를 완전히 분리. 엔진은 직접 DB 업데이트, UI는 `ON CONFLICT DO NOTHING` 같은 비파괴 업데이트. 구조 변경이 크다.

## 권장 순서

1. **옵션 A**부터 적용 (4줄 SQL 수정, 가장 즉시 효과)
2. 그래도 안 잡히는 케이스가 나오면 **옵션 C** 추가

## 관련 파일

- `src/frontend/src/lib/task-db-sync.ts:40` — CASE WHEN 본체
- `src/frontend/src/lib/orchestrate-engine.ts:822` — cleanupZombies (파일 기준으로만 동작, DB는 못 풀음)
- `src/frontend/src/lib/orchestrate-engine.ts:131-162` — `start()`, 옵션 C의 hook 지점

## 부수 이슈: TASK-349 파일 frontmatter 중복

사고 조사 중 `.orchestration/tasks/TASK-349-*.md` 파일이 본문 안에 `---` 블록이 한 번 더 들어간 corrupt 상태였음. 2026-04-13에 수동 정리. 어느 경로에서 본문에 frontmatter를 재삽입했는지 확인 필요:

- `src/frontend/src/lib/orchestrate-engine.ts:577-580` `setTaskStatus()` — frontmatter 없는 파일에 삽입하는 경로
- 프론트엔드 태스크 수정 API의 쓰기 경로

재현 조건을 알아내지 못하면 방어적으로 "frontmatter 파싱 시 첫 블록만 사용하고 나머지는 본문으로 취급" 정도는 이미 되어있으리라 추정.
