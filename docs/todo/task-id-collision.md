# TASK-ID 충돌 방지

## 문제 (2026-04-13 발견)

`src/frontend/src/lib/task-id.ts:7` `generateNextTaskId`:

```typescript
export function generateNextTaskId(dir: string): string {
  const existingFiles = fs.readdirSync(dir).filter(...);
  let maxNum = 0;
  for (const f of existingFiles) { ... if (num > maxNum) maxNum = num; }
  return `TASK-${String(maxNum + 1).padStart(3, "0")}`;
}
```

**파일 시스템만 스캔**하고 DB, git 히스토리, 동시 요청은 고려하지 않음.

## 실제 발견된 충돌

2026-04-13 사고 조사 중, 동일 ID로 title이 다른 두 파일이 존재하는 케이스 4건 발견 (TASK-332/333/343/357):

```
TASK-357-task-log-parser-unknown-타입-조건식-타입-안전성.md     ← title: ...unknown-타입-조건식
TASK-357-task-log-parser-논리-오류-괄호-추가.md                  ← title: ...논리-오류-괄호-추가
```

두 파일의 title이 **완전히 다름** — ID만 같을 뿐 실제로는 별개 작업 2개. DB에는 title이 나중 것이 남고(`ON CONFLICT DO UPDATE`) 파일은 둘 다 남는 꼬인 상태.

## 충돌 발생 경로

### 경로 1: 파일 삭제 후 재사용
1. TASK-NNN이 생성되고 파일/DB에 기록됨
2. 파일만 `rm`으로 삭제 (DB row는 남음)
3. `generateNextTaskId`가 다시 호출되면 삭제된 NNN을 고려하지 못함 → 이미 쓰인 ID 재할당 가능
4. ON CONFLICT로 DB는 덮어써지고 파일만 2개 남음 (이전 삭제가 안 됐거나)

### 경로 2: 동시 요청 race
1. 두 요청이 같은 타이밍에 `/api/tasks` POST
2. 둘 다 `readdirSync`로 같은 maxNum을 읽고 +1
3. 같은 ID로 두 파일이 저장됨 (slug가 다르면 파일명은 달라 공존)
4. ON CONFLICT로 DB row 하나는 유실

### 경로 3: 엔진 자동 생성 vs UI 수동 생성
엔진이 분석 결과로 태스크를 자동 생성할 때와 사용자가 UI로 생성할 때 타이밍이 겹치면 경로 2와 동일.

## 개선 옵션

### 옵션 A (권장) — DB + 파일 union 기준
```typescript
export function generateNextTaskId(dir: string): string {
  const fileIds = scanFileIds(dir);
  const dbIds = getDb()?.prepare("SELECT id FROM tasks WHERE id LIKE 'TASK-%'").all() ?? [];
  const maxNum = Math.max(0, ...fileIds, ...dbIds.map(parseId));
  return `TASK-${String(maxNum + 1).padStart(3, "0")}`;
}
```

### 옵션 B — 시퀀스 테이블
DB에 `CREATE TABLE task_id_sequence (next_id INTEGER)` 두고 `UPDATE ... RETURNING`으로 원자적 할당. SQLite 3.35+ 필요.

### 옵션 C — 파일명에 UUID / timestamp suffix
ID 자체를 `TASK-NNN-{short-hash}`로 바꿔 충돌 가능성 제거. 기존 파일/DB 마이그레이션 비용이 큼.

## 권장 순서

1. **옵션 A 먼저** (최소 변경, 삭제/재사용 경로 차단)
2. 필요 시 **락 추가**: `generateNextTaskId` 호출부터 `writeFileSync` + `syncTaskFileToDb`까지 파일락 또는 모듈 레벨 mutex로 원자화 (race 차단)

## 관련 파일

- `src/frontend/src/lib/task-id.ts` — 함수 본체
- `src/frontend/src/app/api/tasks/route.ts:84` — UI에서 호출
- `src/frontend/src/app/api/requests/route.ts:105` — request→task 변환에서 호출
- `src/frontend/src/lib/task-db-sync.ts` — ON CONFLICT 로직 (덮어쓰기 발생 지점)

## 부가 제안: 주기적 drift 점검

DB와 파일이 다시 어긋나지 않도록, 관리자 액션 또는 startup 훅에서 한 번씩 실행할 drift detector가 필요:

- DB에 있지만 파일 없는 태스크 목록
- 파일에 있지만 DB 없는 태스크 목록
- 같은 ID로 파일이 2개 이상인 케이스
- DB title과 파일 title이 다른 케이스

지금 사고는 수동 조사로 찾아냈지만, 이걸 자동화하는 API 엔드포인트(`/api/debug/drift`) 하나가 있으면 재발 감지가 쉬워집니다.
