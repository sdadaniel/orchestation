---
title: Night Worker Start 즉시 Completed 표시 버그
created: 2026-04-02
status: open
severity: high
affected: src/frontend/src/app/api/night-worker/route.ts
---

# Night Worker Start 즉시 Completed 표시 버그

## 증상

Night Worker 페이지에서 Start 버튼 클릭 → 3초 후 polling에서 즉시 `completed` 상태로 표시됨. 실제 스캔 작업은 수행되지 않은 것처럼 보임.

## 원인

API route와 night-worker.sh가 **서로 다른 경로**에 PID/State 파일을 저장.

| 항목 | route.ts (읽는 경로) | night-worker.sh (쓰는 경로) |
|---|---|---|
| PID | `/tmp/night-worker.pid` | `/tmp/orchestrate-{hash}/night-worker.pid` |
| State | `/tmp/night-worker.state` | `/tmp/orchestrate-{hash}/night-worker.state` |

### 상세 흐름

1. POST → `spawn("bash", night-worker.sh)` 실행
2. `night-worker.sh` 74행: `_proj_hash=$(echo "$REPO_ROOT" | cksum | awk '{print $1}')` 로 해시 계산
3. `night-worker.sh` 79-81행: `STATE_FILE="${NW_TMP_PREFIX}/night-worker.state"` 등 해시 경로에 기록
4. GET polling → `/tmp/night-worker.state` (해시 없는 경로)를 읽음
5. 파일 없음 → 기본값 `{ status: "idle", pid: null }` 반환, 또는
6. 이전 실행의 낡은 파일이 남아있으면 → 죽은 PID → `process.kill(pid, 0)` 실패 → `"completed"` 전환

## 수정 방안

`route.ts`에서 `night-worker.sh`와 동일한 해시 기반 경로를 계산하여 사용.

```typescript
// PROJECT_ROOT의 cksum 해시로 경로 계산 (night-worker.sh와 동일)
import { execSync } from "child_process";
const projHash = execSync(`echo "${PROJECT_ROOT}" | cksum | awk '{print $1}'`).toString().trim();
const TMP_PREFIX = `/tmp/orchestrate-${projHash}`;
const PID_FILE = path.join(TMP_PREFIX, "night-worker.pid");
const STATE_FILE = path.join(TMP_PREFIX, "night-worker.state");
```
