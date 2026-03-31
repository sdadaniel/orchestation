# 파일-DB 동기화 누락으로 태스크 생성/상태변경이 UI에 반영 안 되는 문제 (2026-03-31)

## 요약
태스크 생성 및 상태 변경 시 `.orchestration/tasks/*.md` 파일과 SQLite DB가 어긋나면서, 대시보드 UI에서 새 태스크가 보이지 않거나 상태 변경이 늦게 반영되던 문제.

2026-03-31 기준으로 Next.js API 및 Node 엔진 경로에는 파일→DB 동기화 보강이 적용되었다. 다만 bash 기반 경로는 여전히 파일 우선 구조라, 완전한 실시간 양방향 동기화 문제는 남아 있다.

## 증상

### 증상 1: 새 태스크가 목록에 안 보임
- `/tasks/new`에서 태스크 생성 (TASK-295, 296, 297)
- `.orchestration/tasks/` 에 파일은 정상 생성됨
- 대시보드 태스크 목록(`/tasks`)에 표시 안 됨
- 기존 원인: `POST /api/requests`가 파일만 생성하고 DB에 INSERT 하지 않음
- 현재 상태: `POST /api/requests`, `POST /api/tasks`는 파일 저장 직후 DB sync 수행
- 현재 잔여 리스크: bash가 만든/수정한 파일은 목록 API 호출 전까지 DB 반영이 지연될 수 있음

### 증상 2: 상태 변경이 UI에 반영 안 됨
- orchestrate.sh가 태스크를 `pending` → `in_progress` → `failed`로 전이
- 파일의 `status:`, `updated:` 필드는 정상 변경됨
- DB의 `status`, `updated` 컬럼은 그대로 → UI에 이전 상태 표시
- 사이드바에서 최근 변경된 태스크가 위로 올라오지 않음
- 현재 상태: Node 엔진(`orchestrate-engine.ts`) 및 API 수정 경로는 파일 변경 직후 DB sync 수행
- 현재 잔여 리스크: `orchestrate.sh`, `job-task.sh`, `job-review.sh` 같은 bash 경로는 여전히 직접 DB를 보장하지 않음

### 증상 3: 수동으로 pending 복구해도 즉시 덮어씌워짐
- DB에서 status를 수동 수정해도 orchestrate.sh가 파일 기준으로 다시 변경
- 파일에서 status를 수동 수정해도 DB에는 반영 안 됨
- 파일과 DB 사이에 양방향 동기화가 없음
- 현재 상태: 목록 조회 시 파일 기준 DB self-heal이 들어가 DB 수동 수정은 더 쉽게 덮어씌워질 수 있음
- 결론: 현재 구조에서는 DB 직접 수정이 안전한 운영 방식이 아님. 파일 또는 API 경로를 통해 수정해야 함

## 영향 받는 경로

### 파일 → DB 동기화 상태

| 동작 | 파일 수정 | DB 수정 | 현재 상태 |
|------|----------|---------|------|
| `GET /api/requests` | - | 조회 전 sync | 수정 완료. 파일 기준으로 DB 보정 후 조회 |
| `GET /api/tasks` | - | 조회 전 sync | 수정 완료. 파일 기준으로 DB 보정 후 조회 |
| `POST /api/requests` (태스크 생성) | ✅ | ✅ | 수정 완료 |
| `PUT /api/requests/:id` | ✅ | ✅ | 수정 완료 |
| `DELETE /api/requests/:id` | ✅ | ✅ | 수정 완료 |
| `POST /api/tasks` | ✅ | ✅ | 수정 완료 |
| `PUT /api/tasks/:id` | ✅ | ✅ | 수정 완료 |
| `DELETE /api/tasks/:id` | ✅ | ✅ | 수정 완료 |
| orchestrate-engine.ts `setTaskStatus()` | ✅ | ✅ | 수정 완료 |
| orchestrate-engine.ts zombie cleanup | ✅ | ✅ | 수정 완료 |
| orchestrate.sh `_set_status()` | ✅ | 불완전 | sqlite3 CLI 의존. 실패 시 조용히 무시 |
| orchestrate.sh `_merge_and_done()` | ✅ | 불완전 | 같은 이유 |
| orchestrate.sh `_mark_task_failed()` | ✅ | 불완전 | 같은 이유 |
| job-task.sh / job-review.sh | ✅ | 불완전 | bash dual-write 보장 안 됨 |

### DB → 파일 동기화 상태

| 동작 | DB 수정 | 파일 수정 | 비고 |
|------|---------|----------|------|
| 수동 DB 수정 (sqlite3) | ✅ | ❌ | 여전히 파일은 그대로 |
| API 경유 수정 | ✅ | ✅ | API가 파일을 먼저/함께 갱신 |

## 근본 원인
데이터 소스가 **파일과 DB 두 곳**에 분산되어 있고, 실행 경로마다 동기화 방식이 다르다.

- **파일**: orchestrate.sh, job-task.sh, job-review.sh가 직접 수정
- **DB**: Next.js API route와 일부 Node 경로에서 조회/수정
- **동기화**: 현재는 "API 조회 시 파일→DB 보정" + "API/Node 수정 시 dual-write" 수준
- **미해결 핵심**: bash 실행 경로까지 포함한 단일한 authoritative source가 아직 없다

## 발견된 추가 문제

### `getDb()`가 읽기 전용 연결이었음
- 기존 구현은 `better-sqlite3`를 `readonly: true`로 열고 있었다
- 따라서 API에서 INSERT/UPDATE 코드를 추가해도 write 경로로 재사용하기 어려웠음
- 수정 후 read/write 연결을 분리함

### bash 경로의 SQLite 반영은 여전히 신뢰하기 어려움
- `orchestrate.sh`에는 `_db_set_status()` 등 SQLite 호출이 존재함
- 하지만 `sqlite3` CLI 의존이며, 실패 시 `2>/dev/null || true`로 조용히 무시됨
- 즉 bash dual-write는 "시도" 수준이지 "보장"이 아님

### 현재 구조는 조회 시 self-heal 방식
- `/api/requests`, `/api/tasks`는 조회 직전 전체 task file을 DB로 upsert 한다
- 장점: 기존 bash 구조를 크게 바꾸지 않고 UI 불일치를 줄일 수 있음
- 단점: 이벤트 발생 즉시 DB가 맞춰지는 구조는 아니며, 조회 전까지는 stale 상태가 가능함

## 현재 적용된 수정 (2026-03-31)
- `src/frontend/src/lib/task-db-sync.ts` 추가
- API 생성/수정/삭제 시 파일 저장 후 DB sync 수행
- `GET /api/requests`, `GET /api/tasks` 조회 전 전체 파일→DB sync 수행
- `orchestrate-engine.ts`에서 상태 변경 및 zombie cleanup 후 DB sync 수행
- `db.ts`에 writable DB 연결 추가

## 현재 남은 문제
- `orchestrate.sh`, `job-task.sh`, `job-review.sh`는 여전히 파일 기반이며 DB 반영이 완전 보장되지 않음
- `task_events`, `token_usage` 등 부가 테이블은 file state와 완전히 동기화하지 않음
- 수동 DB 수정은 파일에 반영되지 않으므로 운영 절차상 안전하지 않음
- 조회 시 sync는 되지만, strict한 실시간 consistency는 아님

## 해결 방안

### 방안 1: DB를 Single Source of Truth로 통일
- orchestrate-engine.ts(Node)에서 DB를 직접 수정
- orchestrate.sh 제거 후 Node 엔진만 사용 (Option B 완료 시)
- 파일은 백업/호환 용도로만 유지

### 방안 2: 파일 → DB 주기적 동기화
- 별도 워치어 또는 API 호출 시 파일 기준으로 DB를 갱신
- 현재 부분 적용됨
- 장점: 현재 구조에서 가장 적은 변경으로 적용 가능
- 단점: 실시간성 부족, 동기화 타이밍 이슈

### 방안 3: orchestrate-engine.ts에서 DB 직접 수정
- Node 엔진의 `setTaskStatus()` 등에서 파일 + DB 동시 수정
- 현재 부분 적용됨
- 단점: orchestrate.sh 병행 사용 시 여전히 파일-DB 불일치 가능

## 권장 후속 조치
- `orchestrate.sh`와 bash worker가 공용 Node sync 스크립트를 호출하도록 통일
- 가능하면 Node 엔진으로 완전 전환하고 bash는 worker 실행 전용으로 축소
- 장기적으로는 DB를 단일 source of truth로 두고 파일은 export/cache로만 사용
