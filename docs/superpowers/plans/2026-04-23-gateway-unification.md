# Gateway Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엔진 **코어** 디렉터리를 `packages/engine/src/orchestrate`로 두고 HTTP·WS **호스트**는 `packages/gateway`로 구분한다. 패키지 3분할(engine/gateway/dashboard), SSE 완전 제거 + `/ws/gateway`(이벤트 멀티플렉스 + WS-RPC) 도입, origin 검증 + zod 스키마 검증, 프로덕션 부팅 한 포트 유지.

**Architecture:** `packages/engine`는 순수 코어(브라우저/Next 의존 금지). `packages/gateway`가 HTTP + Next + WS upgrade 호스트. `packages/dashboard`는 Next 앱만. 이벤트 버스는 `packages/engine/src/bus`로 rename되고 링버퍼 기반 event store가 `lastSeq` replay를 지원.

**Tech Stack:** Node.js ≥18, TypeScript, Next.js 16, React 19, ws, zod, tsx. 기존 `better-sqlite3`, `node-pty` 유지.

**설계 결정 근거**: `docs/architecture/gateway-unified-architecture-plan.md` §10 (2026-04-23 확정 7개 결정).

---

## 사전 주의사항

- **브랜치**: 이 플랜은 단일 장기 브랜치(`feat/gateway-unification`)에서 Phase 단위로 커밋하며 진행한다. Phase 3는 SSE 제거+WS 도입을 한 PR로 묶는 결정(§10 결정 5)에 따라 중간 커밋은 깨져도 PR 단위에서 통합된다.
- **포트**: 테스트는 3001번 포트 사용(CLAUDE.md).
- **macOS bash 3.x**: shell 스크립트에서 `declare -A`/`mapfile`/`readarray` 금지. `cli.js`는 node 기반이므로 해당 없음.
- **포맷**: TS 변경 후 `prettier --check`, 타입체크 `tsc --noEmit` 필수.
- **엔진 파일 이중 존재**: `packages/engine/src/orchestrate/orchestration-manager.ts`(루트)와 `orchestrate/managers/orchestration-manager.ts` 등이 공존할 수 있음. Phase 1 rename 시 둘 다 그대로 옮겨간 뒤 Phase 6에서 unused 제거 여부 검토.

---

## Phase 1 — Rename engine 코어 → `orchestrate`, extract gateway

### Task 1.1: `engine` → `orchestrate` 디렉터리 이동

**Files:**

- Rename: `packages/engine/src/engine/`** → `packages/engine/src/orchestrate/`**  
*(이미 `src/gateway`인 경우: `git mv packages/engine/src/gateway packages/engine/src/orchestrate`.)*
- **Step 1: git mv 수행**

```bash
git mv packages/engine/src/engine packages/engine/src/orchestrate
```

- **Step 2: 디렉터리 검증**

```bash
ls packages/engine/src/orchestrate
```

Expected: 기존 코어 하위 파일들이 모두 존재(`core/`, `jobs/`, `ops/`, `runner/`, `claude/`, `managers/`, `logging/`, `orchestrate-engine.ts`, `orchestration-manager.ts`, `workflow.ts`, `workflow.test.ts`, 기타).

- **Step 3: 커밋(이동만)**

```bash
git commit -m "refactor(runtime): rename src/engine → src/orchestrate (move only)"
```

---

### Task 1.2: runtime 내부 import 경로 치환

**Files:**

- Modify: `packages/engine/src/orchestrate/**/*.ts` 내 `../engine`, `../../engine`, `./engine/` 참조
- **Step 1: 내부 상대경로 `engine` 검색**

```bash
grep -rn "engine" packages/engine/src/orchestrate --include="*.ts" | grep -v "// " | head -40
```

- **Step 2: `/engine/` → `/orchestrate/` 치환 (runtime 내부만)**

```bash
# 내부 문자열에 'engine'이 들어간 경우(주석/로그 메시지)는 제외, import 경로만 치환
find packages/engine/src/orchestrate -name "*.ts" -print0 | \
  xargs -0 sed -i '' -e 's|from "\.\./engine|from "../orchestrate|g' \
                     -e 's|from "\.\./\.\./engine|from "../../orchestrate|g' \
                     -e 's|from "\./engine|from "./orchestrate|g'
```

- **Step 3: CLI 엔트리 경로 갱신**

```bash
grep -rn "engine" packages/engine/src/cli --include="*.ts"
```

`run-engine.ts`가 `../engine/...`를 import하면 `../orchestrate/...`로 치환.

- **Step 4: runtime tsconfig paths 갱신**

```bash

```

Edit `packages/engine/tsconfig.json`:

```json
{
  "paths": {
    "@/constants/*": ["./src/constants/*"],
    "@/types/*": ["./src/types/*"],
    "@/parser/*": ["./src/parser/*"],
    "@/lib/*": ["./src/lib/*"],
    "@/service/*": ["./src/service/*"],
    "@/orchestrate/*": ["./src/orchestrate/*"]
  }
}
```

(`@/engine/*` 항목 제거, `@/orchestrate/*` 추가.)

- **Step 5: runtime 타입체크**

```bash
cd packages/engine && npx tsc --noEmit
```

Expected: 에러 없음. `src/engine/...` 경로 잔여 참조 없음.

- **Step 6: 커밋**

```bash
git commit -am "refactor(runtime): update imports engine → orchestrate (internal)"
```

---

### Task 1.3: dashboard tsconfig alias 갱신

**Files:**

- Modify: `packages/dashboard/tsconfig.json` (paths).
- **Step 1: paths 수정**

`packages/dashboard/tsconfig.json`의 paths에서 `@/engine/`* 키를 `@/orchestrate/`*로 변경:

```json
"@/orchestrate/*": [
  "../../packages/engine/src/orchestrate/*"
],
```

`@/engine/*` 항목은 제거.

- **Step 2: 커밋하지 않음 — 다음 태스크에서 import까지 고치고 한 번에 커밋**

---

### Task 1.4: dashboard 전 import `@/engine` → `@/orchestrate` 치환

**Files:**

- Modify: `packages/dashboard/src/**/*.{ts,tsx}` 중 `@/engine` 사용처.
- **Step 1: 치환 대상 확인**

```bash
grep -rln "@/engine" packages/dashboard/src
```

- **Step 2: 일괄 치환**

```bash
find packages/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | \
  xargs -0 sed -i '' -e 's|@/engine/|@/orchestrate/|g'
```

- **Step 3: dashboard 타입체크**

```bash
cd packages/dashboard && npx tsc --noEmit
```

Expected: 에러 없음.

- **Step 4: 커밋**

```bash
git commit -am "refactor(dashboard): @/engine → @/orchestrate alias and imports"
```

---

### Task 1.5: `packages/gateway` 패키지 신설(스켈레톤)

**Files:**

- Create: `packages/gateway/package.json`
- Create: `packages/gateway/tsconfig.json`
- Create: `packages/gateway/src/server.ts` (placeholder)
- **Step 1: `package.json` 작성**

```json
{
  "name": "@orchestration/gateway",
  "version": "0.1.0",
  "private": true,
  "main": "src/server.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "dev": "tsx src/server.ts"
  },
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "ws": "^8.19.0",
    "node-pty": "^1.2.0-beta.12",
    "tsx": "^4.21.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^25.5.0",
    "@types/ws": "^8.18.1",
    "typescript": "^5.9.3"
  },
  "postinstall": "node -e \"const fs=require('fs'),p=require('path');try{const d='node_modules/node-pty/prebuilds';fs.readdirSync(d).forEach(s=>{const f=p.join(d,s,'spawn-helper');try{fs.chmodSync(f,0o755)}catch{}})}catch{}\""
}
```

- **Step 2: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ESNext"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/orchestrate/*": ["../engine/src/orchestrate/*"],
      "@/bus/*":     ["../engine/src/bus/*"],
      "@/lib/*":     ["../engine/src/lib/*"],
      "@/service/*": ["../engine/src/service/*"],
      "@/constants/*": ["../engine/src/constants/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

(주: `@/bus/*`는 Phase 2에서 실제 디렉터리가 생기지만 tsconfig에 미리 선언해도 무방.)

- **Step 3: placeholder `src/server.ts`**

```ts
// Placeholder — Task 1.6에서 packages/dashboard/server.ts 본문 이전.
export {};
```

- **Step 4: 설치**

```bash
cd packages/gateway && npm install
```

- **Step 5: 타입체크**

```bash
cd packages/gateway && npx tsc --noEmit
```

Expected: 에러 없음.

- **Step 6: 커밋**

```bash
git add packages/gateway
git commit -m "feat(gateway): add package skeleton (package.json, tsconfig)"
```

---

### Task 1.6: `server.ts` 본문을 `gateway`로 이전

**Files:**

- Create: `packages/gateway/src/server.ts`(전체 내용)
- Modify: `packages/dashboard/server.ts` → 얇은 shim 또는 제거
- **Step 1: dashboard `server.ts` 읽고 본문 복사**

기존 `packages/dashboard/server.ts` 전체를 `packages/gateway/src/server.ts`로 이전. 다음 변경:

1. Next 앱 디렉터리 해석을 `PACKAGE_DIR`/`PROJECT_ROOT` 우선순위로:

```ts
import path from "path";

const PACKAGE_DIR = path.resolve(__dirname, "..");   // packages/gateway
const WORKSPACE_ROOT = path.resolve(PACKAGE_DIR, "..", "..");  // repo root
const DASHBOARD_DIR =
  process.env.DASHBOARD_DIR ??
  path.resolve(WORKSPACE_ROOT, "apps", "dashboard");
const PROJECT_ROOT = process.env.PROJECT_ROOT ?? WORKSPACE_ROOT;
```

1. `next(...)`에 `dir: DASHBOARD_DIR` 전달:

```ts
const app = next({ dev, hostname, port, dir: DASHBOARD_DIR });
```

1. import 경로 변경: `@/engine/...` → `@/orchestrate/...`, `@/lib/sse` → `@/lib/sse`(Phase 2에서 `@/bus`로 재치환).
2. `OUTPUT_DIR` 등 `PROJECT_ROOT` 기반 경로는 그대로 유지.

- **Step 2: `packages/dashboard/server.ts` 제거**

```bash
git rm packages/dashboard/server.ts
```

- **Step 3: `packages/dashboard/package.json` `dev`/`start` 갱신**

```json
"scripts": {
  "dev": "tsx ../../packages/gateway/src/server.ts",
  "build": "next build",
  "start": "tsx ../../packages/gateway/src/server.ts",
  ...
}
```

(`NODE_ENV=production` 환경에서 `start`가 실행될 때 gateway의 `dev` 플래그가 `false`로 떨어지도록 `server.ts`의 `const dev = process.env.NODE_ENV !== "production"`에 의존.)

- **Step 4: 루트 `cli.js` 갱신**

`cli.js`의 `start` / `dashboard` 커맨드에서 `npm run dev` 호출은 그대로 두되, 로그 문구와 커맨드명을 gateway 기반으로 변경하거나 유지해도 무방(동작 동일). 새 커맨드 추가:

```js
case "gateway": {
  // 동일 동작, 이름만 새로 노출
  // ... (기존 "start" 또는 "dashboard"와 동일 본체 재사용)
}
```

구현 시: 기존 `start` 본체를 함수로 추출한 뒤 `start`, `dashboard`, `gateway` 세 case에서 공통 호출.

- **Step 5: dev 기동 스모크**

```bash
PORT=3001 npm run dev --prefix packages/dashboard
```

브라우저에서 `http://localhost:3001` 접속. 페이지 로딩 확인 후 Ctrl+C.

- **Step 6: 커밋**

```bash
git add -A
git commit -m "refactor(gateway): move server.ts into packages/gateway"
```

---

### Task 1.7: Phase 1 타입체크 · 스모크

- **Step 1: 전 패키지 타입체크**

```bash
cd packages/engine && npx tsc --noEmit && cd -
cd packages/gateway && npx tsc --noEmit && cd -
cd packages/dashboard && npx tsc --noEmit && cd -
```

Expected: 모두 에러 없음.

- **Step 2: 대시보드 기동 + 기본 페이지/WS 스모크**

```bash
PORT=3001 npm run dev --prefix packages/dashboard
```

수동 확인:

- `http://localhost:3001` 로딩
- DevTools Network에서 `/sse`, `/ws/orchestrate`, `/ws/task-logs/*` 등 정상 연결
- 태스크 목록 표시
- **Step 3: Phase 1 커밋(이미 완료된 경우 no-op), 진행 기록**

---

## Phase 2 — `lib/sse` → `bus` rename + event store

### Task 2.1: `lib/sse` → `bus` 이동

**Files:**

- Rename: `packages/engine/src/lib/sse/`** → `packages/engine/src/bus/`**
- **Step 1: git mv**

```bash
git mv packages/engine/src/lib/sse packages/engine/src/bus
```

- **Step 2: 커밋(이동만)**

```bash
git commit -m "refactor(runtime): rename lib/sse → bus (move only)"
```

---

### Task 2.2: import 경로 치환

**Files:**

- Modify: 4개 파일(`gateway/core/orchestrate-engine.ts`, `gateway/runner/task-runner-manager.ts`, `gateway/managers/orchestration-manager.ts`, `packages/dashboard/src/app/sse/route.ts`).
- **Step 1: 치환**

```bash
# runtime 내부
find packages/engine/src -type f -name "*.ts" -print0 | \
  xargs -0 sed -i '' -e 's|\.\./\.\./lib/sse|../../bus|g' \
                     -e 's|\.\./lib/sse|../bus|g'

# dashboard alias (Phase 3에서 /sse route 자체가 제거되지만 일단 컴파일 유지)
find packages/dashboard/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | \
  xargs -0 sed -i '' -e 's|@/lib/sse|@/bus|g'
```

- **Step 2: dashboard tsconfig paths 추가**

`packages/dashboard/tsconfig.json`에 `@/bus/`* 추가:

```json
"@/bus/*": [
  "../../packages/engine/src/bus/*"
],
```

- **Step 3: 타입체크**

```bash
cd packages/engine && npx tsc --noEmit && cd -
cd packages/dashboard && npx tsc --noEmit && cd -
```

- **Step 4: 커밋**

```bash
git commit -am "refactor: update imports lib/sse → bus"
```

---

### Task 2.3: event store — 링버퍼 + seq 재설계

**Files:**

- Create: `packages/engine/src/bus/event-store.ts` (신규)
- Modify: `packages/engine/src/bus/bus.ts` (publish 시 링버퍼 write-through)
- Modify: `packages/engine/src/bus/index.ts` (export)
- Modify: `packages/engine/src/bus/types.ts` (envelope에 seq 필드 확인)

기존 `store/file-event-store.ts`는 유지하되(디스크 영속성), 재연결 replay 경로는 새 인메모리 **링버퍼**로 일원화. 파일 스토어는 디버깅/감사 로그 용도로만 남겨둠.

- **Step 1: `event-store.ts` 작성**

```ts
import type { BusEventEnvelope, BusEventType } from "./types";

const DEFAULT_CAPACITY = 5000;

export interface EventStore {
  append<T>(type: BusEventType, data: T): BusEventEnvelope<T>;
  readAfter(lastSeq: number): BusEventEnvelope[];
  head(): number; // latest seq
  tail(): number; // oldest retained seq
}

export function createRingEventStore(capacity = DEFAULT_CAPACITY): EventStore {
  const buf: BusEventEnvelope[] = [];
  let seqCounter = 0;

  return {
    append<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
      seqCounter += 1;
      const env: BusEventEnvelope<T> = {
        id: seqCounter,
        atIso: new Date().toISOString(),
        type,
        data,
      };
      buf.push(env as BusEventEnvelope);
      if (buf.length > capacity) buf.shift();
      return env;
    },
    readAfter(lastSeq: number): BusEventEnvelope[] {
      if (buf.length === 0) return [];
      const oldest = buf[0].id;
      if (lastSeq < oldest - 1) return []; // gap: caller must fallback to snapshot
      return buf.filter((e) => e.id > lastSeq);
    },
    head(): number {
      return buf.length === 0 ? 0 : buf[buf.length - 1].id;
    },
    tail(): number {
      return buf.length === 0 ? 0 : buf[0].id;
    },
  };
}

// 기본 인스턴스 (process-wide singleton)
export const eventStore = createRingEventStore();
```

- **Step 2: `bus.ts` write-through 연결**

`publish()`가 파일 스토어 대신(혹은 병행) 인메모리 링버퍼에도 append:

```ts
import type { BusEventEnvelope, BusEventType } from "./types";
import { eventStore } from "./event-store";
// 파일 스토어는 감사 로그 용도 유지
import { fileEventStore } from "./store/file-event-store";

type Listener = (env: BusEventEnvelope) => void;
const listeners = new Set<Listener>();

export function publish<T>(type: BusEventType, data: T): BusEventEnvelope<T> {
  const env = eventStore.append(type, data);
  // 파일 저장은 best-effort
  try { fileEventStore.append(type, data, new Date(env.atIso)); } catch { /* ignore */ }
  for (const l of listeners) {
    try { l(env); } catch { /* ignore */ }
  }
  return env;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// replay는 인메모리에서만
export function replayAfter(lastSeq: number): BusEventEnvelope[] {
  return eventStore.readAfter(lastSeq);
}

export function snapshotSeq(): { head: number; tail: number } {
  return { head: eventStore.head(), tail: eventStore.tail() };
}
```

주: `file-event-store.ts`의 `append`는 기존 시그니처가 `(type, data, at)`이므로 두 곳에서 seq를 각기 발급하게 됨. 링버퍼의 seq를 단일 진실원으로 삼고, 파일 쪽은 타임스탬프만 보관하도록 `file-event-store.ts`의 `nextId` 호출을 제거하고 외부에서 envelope를 받아 그대로 JSON 직렬화하는 방식으로 단순화한다. 이 정리는 후속 작업에서 해도 무방(파일 측 seq가 정합 안 맞아도 브라우저 replay는 링버퍼만 사용).

- **Step 3: `index.ts` 업데이트**

```ts
export * from "./types";
export * from "./bus";
export * from "./event-store";
export * from "./logging/log-format";
```

- **Step 4: `replayAfter` 구 시그니처 사용처 확인**

```bash
grep -rn "replayAfter" packages/engine packages/dashboard
```

기존은 `replayAfter(afterId, limit)` 시그니처. `packages/dashboard/src/app/sse/route.ts`만 사용. Phase 3에서 해당 파일 자체를 제거하므로 호환 시그니처(두 번째 인자 무시) 유지:

```ts
export function replayAfter(lastSeq: number, _limit?: number): BusEventEnvelope[] {
  return eventStore.readAfter(lastSeq);
}
```

- **Step 5: 타입체크 + 커밋**

```bash
cd packages/engine && npx tsc --noEmit && cd -
cd packages/dashboard && npx tsc --noEmit && cd -
git add -A
git commit -m "feat(bus): add in-memory ring event store with seq-based replay"
```

---

### Task 2.4: DB 폴링 제거 대비 — task-store 쓰기 경로 publish 확인

`packages/dashboard/src/app/sse/route.ts`의 DB 폴링(1초 주기 `MAX(updated)`)을 제거하려면 task-store 변경 경로 전부가 `publish("task-changed", ...)`를 호출해야 한다.

**Files:**

- Inspect: `packages/engine/src/service/task-store.ts`
- Modify: 필요 시 task-store write 메서드에 `publish("task-changed", ...)` 호출 추가
- **Step 1: task-store 쓰기 메서드 조사**

```bash
grep -n "UPDATE\|INSERT\|DELETE" packages/engine/src/service/task-store.ts
```

- **Step 2: 각 쓰기 메서드 직후 `publish("task-changed", ...)` 누락 여부 확인**

이미 publish하는 곳이 있으면 그대로 두고, 누락만 추가. 모든 insert/update/delete가 `publish("task-changed", { taskId, status?, priority?, title?, full?, deleted? })` 또는 최소 `{ full: true }`를 호출해야 한다.

(대량 변경 시 task-store 안에 공통 `notifyChanged()` 헬퍼 도입.)

- **Step 3: 추가/수정 후 커밋**

```bash
git commit -am "fix(task-store): emit task-changed on all write paths"
```

(변경 없었다면 skip.)

---

## Phase 3 — `/ws/gateway` + SSE 제거 (단일 PR)

이 Phase의 커밋들은 중간에 dashboard가 부분적으로 깨질 수 있다. **Phase 3의 모든 태스크가 끝난 뒤** PR 하나로 묶어 머지한다(결정 5).

### Task 3.1: RPC 레지스트리 타입과 구조

**Files:**

- Create: `packages/gateway/src/rpc/registry.ts`
- Create: `packages/gateway/src/rpc/types.ts`
- **Step 1: `types.ts` 작성**

```ts
import type { z } from "zod";

export interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export interface RpcMethodDef<P = unknown, R = unknown> {
  name: string;
  idempotent: boolean;
  paramsSchema: z.ZodType<P>;
  handler: (params: P) => Promise<R> | R;
}
```

- **Step 2: `registry.ts` 작성**

```ts
import type { RpcMethodDef } from "./types";

const methods = new Map<string, RpcMethodDef>();

export function registerRpc<P, R>(def: RpcMethodDef<P, R>): void {
  if (methods.has(def.name)) {
    throw new Error(`RPC method already registered: ${def.name}`);
  }
  methods.set(def.name, def as RpcMethodDef);
}

export function getRpc(name: string): RpcMethodDef | undefined {
  return methods.get(name);
}

export function listRpc(): { name: string; idempotent: boolean }[] {
  return Array.from(methods.values()).map((m) => ({
    name: m.name,
    idempotent: m.idempotent,
  }));
}
```

- **Step 3: 커밋**

```bash
git add packages/gateway/src/rpc
git commit -m "feat(gateway): add RPC registry skeleton"
```

---

### Task 3.2: `orchestrate.start` / `orchestrate.stop` 메서드 등록

**Files:**

- Create: `packages/gateway/src/rpc/methods/orchestrate.ts`
- **Step 1: 메서드 파일 작성**

```ts
import { z } from "zod";
import orchestrationManager from "@/orchestrate/orchestration-manager";
import { registerRpc } from "../registry";

registerRpc({
  name: "orchestrate.start",
  idempotent: false,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    if (orchestrationManager.isRunning()) {
      throw { code: "ALREADY_RUNNING", message: "orchestration is already running" };
    }
    const result = orchestrationManager.start();
    if (!result.success) {
      throw { code: "START_FAILED", message: result.error ?? "start-failed" };
    }
    return { status: orchestrationManager.getStatus() };
  },
});

registerRpc({
  name: "orchestrate.stop",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    // idempotent: 이미 멈춘 상태여도 성공 응답
    if (!orchestrationManager.isRunning()) {
      return { status: orchestrationManager.getStatus(), alreadyStopped: true };
    }
    const result = orchestrationManager.stop();
    if (!result.success) {
      throw { code: "STOP_FAILED", message: result.error ?? "stop-failed" };
    }
    return { status: orchestrationManager.getStatus() };
  },
});
```

- **Step 2: 커밋**

```bash
git add packages/gateway/src/rpc/methods
git commit -m "feat(gateway): register orchestrate.start (non-idempotent) and orchestrate.stop (idempotent)"
```

---

### Task 3.3: `/ws/gateway` 채널 핸들러

**Files:**

- Create: `packages/gateway/src/ws/gateway-channel.ts`
- **Step 1: 핸들러 작성**

```ts
import type { WebSocket, WebSocketServer } from "ws";
import { publish, subscribe, replayAfter, snapshotSeq } from "@/bus";
import orchestrationManager from "@/orchestrate/orchestration-manager";
import { getRpc } from "../rpc/registry";
import type { RpcRequest, RpcResponse } from "../rpc/types";

interface HelloMsg {
  type: "hello";
  lastSeq?: number;
}

type Incoming = HelloMsg | RpcRequest | { type: "ping" };

function sendSafe(ws: WebSocket, obj: unknown) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function buildSnapshot() {
  const state = orchestrationManager.getState();
  return {
    orchestration: {
      status: orchestrationManager.getStatus(),
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      exitCode: state.exitCode,
      taskResults: state.taskResults,
    },
    // tasks full refetch는 클라이언트가 스냅샷 수신 후 REST로 보강
    tasksFullHint: true,
  };
}

export function attachGatewayChannel(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket) => {
    // 연결 직후 snapshot (브로드캐스트 이벤트와 seq 기준 정합)
    const { head } = snapshotSeq();
    sendSafe(ws, {
      type: "snapshot",
      seq: head,
      data: buildSnapshot(),
    });

    const unsubscribe = subscribe((env) => {
      // 링버퍼 append 직후 listener 호출. seq는 env.id.
      sendSafe(ws, { type: "event", seq: env.id, event: env.type, data: env.data });
    });

    ws.on("message", async (raw: Buffer | string) => {
      let msg: Incoming;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        sendSafe(ws, { type: "error", message: "bad-json" });
        return;
      }

      if (msg.type === "ping") {
        sendSafe(ws, { type: "pong" });
        return;
      }

      if (msg.type === "hello") {
        // 재연결 replay
        const lastSeq = typeof msg.lastSeq === "number" ? msg.lastSeq : 0;
        const missed = replayAfter(lastSeq);
        const { tail } = snapshotSeq();
        if (lastSeq > 0 && lastSeq < tail - 1) {
          sendSafe(ws, { type: "replay-gap", head: snapshotSeq().head });
          return;
        }
        sendSafe(ws, {
          type: "replay",
          events: missed.map((env) => ({
            seq: env.id,
            event: env.type,
            data: env.data,
          })),
        });
        return;
      }

      if (msg.type === "req") {
        const req = msg as RpcRequest;
        const def = getRpc(req.method);
        if (!def) {
          const res: RpcResponse = {
            type: "res",
            id: req.id,
            ok: false,
            error: { code: "UNKNOWN_METHOD", message: req.method },
          };
          sendSafe(ws, res);
          return;
        }

        // params 스키마 검증은 Phase 4에서 추가. 임시로 통과.
        try {
          const parsed = def.paramsSchema.safeParse(req.params ?? {});
          if (!parsed.success) {
            sendSafe(ws, {
              type: "res",
              id: req.id,
              ok: false,
              error: {
                code: "INVALID_PARAMS",
                message: parsed.error.message,
                details: parsed.error.flatten(),
              },
            } satisfies RpcResponse);
            return;
          }
          const payload = await def.handler(parsed.data);
          sendSafe(ws, { type: "res", id: req.id, ok: true, payload } satisfies RpcResponse);
        } catch (err) {
          const e = err as { code?: string; message?: string };
          sendSafe(ws, {
            type: "res",
            id: req.id,
            ok: false,
            error: {
              code: e?.code ?? "INTERNAL",
              message: e?.message ?? String(err),
            },
          } satisfies RpcResponse);
        }
        return;
      }

      sendSafe(ws, { type: "error", message: "unknown-type" });
    });

    ws.on("close", () => {
      unsubscribe();
    });
    ws.on("error", (err) => {
      console.error("[ws:gateway] error:", err.message);
    });
  });
}
```

- **Step 2: 커밋**

```bash
git add packages/gateway/src/ws/gateway-channel.ts
git commit -m "feat(gateway): add /ws/gateway channel handler (events + RPC + replay)"
```

---

### Task 3.4: server.ts에서 `/ws/gateway` upgrade 라우팅, `/ws/orchestrate` 제거

**Files:**

- Modify: `packages/gateway/src/server.ts`
- **Step 1: `/ws/orchestrate` 블록 제거 및 `/ws/gateway`로 교체**

`server.ts`에서:

1. `const wssOrchestrate = new WebSocketServer({ noServer: true });` → `const wssGateway = new WebSocketServer({ noServer: true });`
2. upgrade 라우팅에서 `if (req.url === "/ws/orchestrate")` → `if (req.url === "/ws/gateway")`, `wssOrchestrate` → `wssGateway`.
3. 기존 `wssOrchestrate.on("connection", ...)` 블록 전체 **삭제**.
4. RPC 메서드 등록 import + 채널 attach:

```ts
import "./rpc/methods/orchestrate"; // side-effect register
import { attachGatewayChannel } from "./ws/gateway-channel";
// ...
attachGatewayChannel(wssGateway);
```

- **Step 2: 타입체크**

```bash
cd packages/gateway && npx tsc --noEmit
```

- **Step 3: 커밋**

```bash
git commit -am "refactor(gateway): replace /ws/orchestrate with /ws/gateway channel"
```

---

### Task 3.5: 클라이언트 WS 래퍼(`GatewayClient`)

**Files:**

- Create: `packages/dashboard/src/gateway-ws/client.ts`
- **Step 1: 클라이언트 작성**

```ts
"use client";

type AnyObject = Record<string, unknown>;

type EventHandler = (event: string, data: unknown, seq: number) => void;
type SnapshotHandler = (data: AnyObject) => void;
type GapHandler = () => void;

interface PendingRpc {
  resolve: (payload: unknown) => void;
  reject: (err: unknown) => void;
  method: string;
  idempotent: boolean;
  timeout: ReturnType<typeof setTimeout>;
}

export interface GatewayClientOpts {
  url: string;
  onEvent: EventHandler;
  onSnapshot: SnapshotHandler;
  onReplayGap: GapHandler;
  // Client supplies idempotency decision by method name.
  isIdempotent: (method: string) => boolean;
  rpcTimeoutMs?: number;
}

export interface GatewayClient {
  call<P extends AnyObject, R>(method: string, params?: P): Promise<R>;
  close(): void;
  getLastSeq(): number;
}

const BACKOFF_MIN = 500;
const BACKOFF_MAX = 30_000;

export function createGatewayClient(opts: GatewayClientOpts): GatewayClient {
  let ws: WebSocket | null = null;
  let closed = false;
  let lastSeq = Number(localStorage.getItem("gateway.lastSeq") ?? "0") || 0;
  let backoff = BACKOFF_MIN;
  const pending = new Map<string, PendingRpc>();
  const rpcTimeoutMs = opts.rpcTimeoutMs ?? 30_000;

  function scheduleReconnect() {
    if (closed) return;
    const jitter = Math.random() * backoff * 0.2;
    setTimeout(connect, Math.min(BACKOFF_MAX, backoff + jitter));
    backoff = Math.min(BACKOFF_MAX, backoff * 2);
  }

  function persistSeq(seq: number) {
    if (seq > lastSeq) {
      lastSeq = seq;
      localStorage.setItem("gateway.lastSeq", String(seq));
    }
  }

  function connect() {
    if (closed) return;
    try {
      ws = new WebSocket(opts.url);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      backoff = BACKOFF_MIN;
      ws?.send(JSON.stringify({ type: "hello", lastSeq }));
    });

    ws.addEventListener("message", (e: MessageEvent) => {
      let msg: AnyObject;
      try { msg = JSON.parse(String(e.data ?? "")); } catch { return; }

      if (msg.type === "snapshot") {
        persistSeq(Number(msg.seq) || 0);
        opts.onSnapshot(msg.data as AnyObject);
        return;
      }

      if (msg.type === "replay" && Array.isArray(msg.events)) {
        for (const ev of msg.events as Array<{ seq: number; event: string; data: unknown }>) {
          opts.onEvent(ev.event, ev.data, ev.seq);
          persistSeq(ev.seq);
        }
        return;
      }

      if (msg.type === "replay-gap") {
        opts.onReplayGap();
        return;
      }

      if (msg.type === "event") {
        opts.onEvent(String(msg.event), msg.data, Number(msg.seq) || 0);
        persistSeq(Number(msg.seq) || 0);
        return;
      }

      if (msg.type === "res" && typeof msg.id === "string") {
        const p = pending.get(msg.id);
        if (!p) return;
        pending.delete(msg.id);
        clearTimeout(p.timeout);
        if (msg.ok) p.resolve(msg.payload);
        else p.reject(msg.error ?? { code: "ERROR", message: "unknown" });
        return;
      }
    });

    ws.addEventListener("close", () => {
      // cancel non-idempotent in-flight RPCs
      for (const [id, p] of pending) {
        if (!p.idempotent) {
          pending.delete(id);
          clearTimeout(p.timeout);
          p.reject({ code: "DISCONNECTED", message: "ws closed" });
        }
      }
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      try { ws?.close(); } catch { /* ignore */ }
    });
  }

  connect();

  return {
    call<P extends AnyObject, R>(method: string, params?: P): Promise<R> {
      return new Promise<R>((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const idempotent = opts.isIdempotent(method);
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject({ code: "TIMEOUT", message: "rpc timeout" });
        }, rpcTimeoutMs);
        pending.set(id, { resolve: resolve as (p: unknown) => void, reject, method, idempotent, timeout });

        const trySend = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "req", id, method, params: params ?? {} }));
          } else if (idempotent) {
            setTimeout(trySend, 100);
          } else {
            pending.delete(id);
            clearTimeout(timeout);
            reject({ code: "DISCONNECTED", message: "ws not open" });
          }
        };
        trySend();
      });
    },
    close() {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
      ws = null;
    },
    getLastSeq() { return lastSeq; },
  };
}
```

- **Step 2: 커밋**

```bash
git add packages/dashboard/src/gateway-ws/client.ts
git commit -m "feat(dashboard): GatewayClient — ws wrapper with backoff, seq, RPC, idempotent policy"
```

---

### Task 3.6: 이벤트 핸들러 포팅 (`useSseHandlers` → `handlers.ts`)

**Files:**

- Create: `packages/dashboard/src/gateway-ws/handlers.ts`
- **Step 1: 기존 `useSseHandlers.ts` 로직을 WS 이벤트 기준으로 포팅**

```ts
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useOrchestrationStore } from "@/store/orchestrationStore";
import { useTasksStore } from "@/store/tasksStore";
import type { OrchestrationStatusData } from "@/orchestrate/orchestration-manager";

export function createEventHandlers(queryClient: QueryClient) {
  const invalidateTasksAndRequests = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
  };

  return {
    onEvent(event: string, data: unknown, _seq: number) {
      if (event === "task-changed") {
        const d = data as { full?: boolean; deleted?: boolean; taskId?: string; status?: string; priority?: string; title?: string };
        if (d.full || d.deleted) {
          invalidateTasksAndRequests();
          useTasksStore.getState().fetchAll();
          return;
        }
        if (d.taskId) {
          const patch: Record<string, string> = {};
          if (d.status) patch.status = d.status;
          if (d.priority) patch.priority = d.priority;
          if (d.title) patch.title = d.title;
          const store = useTasksStore.getState();
          const exists = store.requests.some((r) => r.id === d.taskId);
          if (exists) store.patchRequest(d.taskId, patch);
          else store.fetchAll();
          invalidateTasksAndRequests();
        }
        return;
      }

      if (event === "orchestration-status") {
        const statusData = data as OrchestrationStatusData;
        const store = useOrchestrationStore.getState();
        const prevStatus = store.data.status;
        const justFinished =
          prevStatus === "running" &&
          (statusData.status === "completed" ||
            statusData.status === "failed" ||
            statusData.status === "idle");

        useOrchestrationStore.setState(
          {
            data: statusData,
            isRunning: statusData.status === "running",
            justFinished: justFinished ? true : store.justFinished,
          },
          false,
          "orchestration/ws-update",
        );

        if (justFinished) {
          queryClient.invalidateQueries({ queryKey: queryKeys.costs.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.runHistory.all });
        }
        return;
      }
    },

    onSnapshot(snapshot: unknown) {
      const s = snapshot as {
        orchestration?: OrchestrationStatusData;
        tasksFullHint?: boolean;
      };
      if (s.orchestration) {
        useOrchestrationStore.setState(
          {
            data: s.orchestration,
            isRunning: s.orchestration.status === "running",
          },
          false,
          "orchestration/ws-snapshot",
        );
      }
      if (s.tasksFullHint) {
        useTasksStore.getState().fetchAll();
        invalidateTasksAndRequests();
      }
    },

    onReplayGap() {
      // gap: snapshot으로 fallback
      invalidateTasksAndRequests();
      useTasksStore.getState().fetchAll();
    },
  };
}
```

- **Step 2: 커밋**

```bash
git add packages/dashboard/src/gateway-ws/handlers.ts
git commit -m "feat(dashboard): port SSE handlers to WS event dispatcher"
```

---

### Task 3.7: `GatewayWsProvider` + 레이아웃 교체

**Files:**

- Create: `packages/dashboard/src/gateway-ws/provider.tsx`
- Create: `packages/dashboard/src/gateway-ws/context.tsx` (RPC 호출용 context)
- Modify: `packages/dashboard/src/app/layout.tsx`
- **Step 1: provider 작성**

```tsx
"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createGatewayClient, type GatewayClient } from "./client";
import { createEventHandlers } from "./handlers";

const IDEMPOTENT_METHODS = new Set<string>(["orchestrate.stop"]);

interface Ctx {
  client: GatewayClient | null;
}

const GatewayCtx = createContext<Ctx>({ client: null });

export function useGatewayClient(): GatewayClient {
  const { client } = useContext(GatewayCtx);
  if (!client) throw new Error("GatewayClient not ready");
  return client;
}

export function GatewayWsProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [client, setClient] = useState<GatewayClient | null>(null);
  const handlersRef = useRef<ReturnType<typeof createEventHandlers> | null>(null);

  useEffect(() => {
    const h = createEventHandlers(queryClient);
    handlersRef.current = h;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws/gateway`;
    const c = createGatewayClient({
      url,
      onEvent: (event, data, seq) => h.onEvent(event, data, seq),
      onSnapshot: (snap) => h.onSnapshot(snap),
      onReplayGap: () => h.onReplayGap(),
      isIdempotent: (m) => IDEMPOTENT_METHODS.has(m),
    });
    setClient(c);
    return () => { c.close(); };
  }, [queryClient]);

  return (
    <GatewayCtx.Provider value={{ client }}>
      {children}
    </GatewayCtx.Provider>
  );
}
```

- **Step 2: layout.tsx 교체**

```tsx
import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/toast";
import { QueryProvider } from "@/providers/QueryProvider";
import { GatewayWsProvider } from "@/gateway-ws/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestration Dashboard",
  description: "오케스트레이션 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="h-screen overflow-hidden">
        <QueryProvider>
          <GatewayWsProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </GatewayWsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

- **Step 3: 커밋(SSE 제거 전)**

```bash
git add packages/dashboard/src/gateway-ws packages/dashboard/src/app/layout.tsx
git commit -m "feat(dashboard): GatewayWsProvider (replaces SseProvider in layout)"
```

---

### Task 3.8: AutoImproveControl을 `useGatewayClient`로 이전

**Files:**

- Modify: `packages/dashboard/src/components/AutoImproveControl.tsx`

기존 구현은 자체 WebSocket을 생성해 `/ws/orchestrate`로 연결하고 `run`/`stop`을 보냄. 이를 `useGatewayClient().call("orchestrate.start" | "orchestrate.stop")`로 교체.

- **Step 1: import 변경 + WS 직접 생성 로직 제거**

```tsx
import { useGatewayClient } from "@/gateway-ws/provider";
// 기존 new WebSocket(url) 블록 삭제, start/stop 핸들러에서 client.call 사용
```

- **Step 2: start/stop 핸들러 교체**

```tsx
const gateway = useGatewayClient();

async function startOrchestration() {
  try {
    await gateway.call("orchestrate.start");
    // UI 상태 갱신은 orchestration-status 이벤트로 반영
  } catch (err) {
    // 토스트
  }
}

async function stopOrchestration() {
  try {
    await gateway.call("orchestrate.stop");
  } catch (err) {
    // 토스트
  }
}
```

- **Step 3: 타입체크 + 커밋**

```bash
cd packages/dashboard && npx tsc --noEmit && cd -
git commit -am "refactor(dashboard): AutoImproveControl uses GatewayClient RPC"
```

---

### Task 3.9: `OrchestrateLogViewer`의 `/sse` 의존 제거

**Files:**

- Modify: `packages/dashboard/src/components/logs/OrchestrateLogViewer.tsx`

기존 `connectSse({ url: "/sse", ... })`로 `log` 이벤트 구독 중. `/ws/gateway`의 `event` 중 `event === "log"`를 구독하도록 변경.

- **Step 1: SSE client 의존 제거 + GatewayClient 구독으로 교체**

로그 뷰어는 Gateway 이벤트 중 `log` 타입을 filter. Provider에서 추가 구독 훅을 노출하는 대신, 컴포넌트 내부에서 별도 WebSocket을 사용할 수도 있으나 **단일 WS 원칙** 유지를 위해 Provider에 이벤트 브로드캐스트(subscribe) API를 추가한다.

**옵션 1(권장)**: Provider를 EventEmitter 기반으로 확장 — `useGatewayEvents(handler)` 훅 추가.

provider.tsx에 추가:

```tsx
type Listener = (event: string, data: unknown, seq: number) => void;
const listeners = new Set<Listener>();

// ... createGatewayClient의 onEvent에서 handlers + listeners 동시 호출
onEvent: (event, data, seq) => {
  h.onEvent(event, data, seq);
  for (const l of listeners) l(event, data, seq);
},
// ... export
export function subscribeGatewayEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
```

- **Step 2: OrchestrateLogViewer 재구현**

```tsx
import { useEffect } from "react";
import { subscribeGatewayEvent } from "@/gateway-ws/provider";

// 기존 connectSse useEffect 블록을 아래로 교체
useEffect(() => {
  const off = subscribeGatewayEvent((event, data) => {
    if (event !== "log") return;
    const d = data as { line?: string; scope?: string };
    if (d?.scope === "orchestration" && typeof d.line === "string") {
      appendLine(d.line); // 기존 헬퍼 이름에 맞춰 조정
    }
  });
  return off;
}, []);
```

- **Step 3: 타입체크 + 커밋**

```bash
cd packages/dashboard && npx tsc --noEmit && cd -
git commit -am "refactor(dashboard): OrchestrateLogViewer subscribes to gateway 'log' events"
```

---

### Task 3.10: SSE 제거 — 라우트/클라이언트/프로바이더 삭제

**Files:**

- Delete: `packages/dashboard/src/app/sse/route.ts`
- Delete: `packages/dashboard/src/providers/SseProvider.tsx`
- Delete: `packages/dashboard/src/providers/useSseHandlers.ts`
- Delete: `packages/dashboard/src/sse/client.ts` (+ 빈 디렉터리)
- **Step 1: 삭제**

```bash
git rm packages/dashboard/src/app/sse/route.ts
git rm packages/dashboard/src/providers/SseProvider.tsx
git rm packages/dashboard/src/providers/useSseHandlers.ts
git rm -r packages/dashboard/src/sse
```

- **Step 2: 잔여 참조 확인**

```bash
grep -rn "SseProvider\|useSseHandlers\|connectSse\|@/sse\|/sse" packages/dashboard/src
```

Expected: 빈 결과(모두 제거됨). 만약 `/sse` 문자열 주석이 남았으면 정리.

- **Step 3: 타입체크 + 커밋**

```bash
cd packages/dashboard && npx tsc --noEmit && cd -
git commit -am "refactor(dashboard): remove SSE route, provider, handlers, client"
```

---

### Task 3.11: Phase 3 스모크

- **Step 1: dev 기동**

```bash
PORT=3001 npm run dev --prefix packages/dashboard
```

- **Step 2: 수동 검증 체크리스트**
- 브라우저 접속(`http://localhost:3001`), 초기 태스크 목록 표시
- DevTools Network에 `/ws/gateway` 연결 확인, `snapshot` 메시지 도착
- 태스크 상태 변화(예: task 생성) 시 `event`(`task-changed`) 수신
- Orchestration run 버튼 → `orchestrate.start` RPC 성공 응답
- Orchestration stop 버튼 → `orchestrate.stop` RPC 성공 응답
- DevTools Network에서 WebSocket `/ws/gateway` 강제 close 후 재연결, `hello` + `replay` 수신, UI 정합 유지
- `/sse`, `/ws/orchestrate` 연결 없음 확인
- 태스크 로그 뷰어, 태스크 터미널 정상(기존 엔드포인트 유지되므로 무영향)
- **Step 3: 커밋(스모크 문서 업데이트 있을 시)**

---

## Phase 4 — 보안 레이어

### Task 4.1: origin 검증 유틸

**Files:**

- Create: `packages/gateway/src/ws/verify-origin.ts`
- **Step 1: 유틸 작성**

```ts
import type { IncomingMessage } from "http";

function allowedOrigins(port: number): Set<string> {
  return new Set([
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]);
}

export function verifyOrigin(req: IncomingMessage, port: number): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    // 같은 출처 HTML이 직접 WS 생성 시 브라우저는 origin을 반드시 보냄.
    // null/undefined는 비브라우저 클라이언트(curl 등) — dev에선 허용, prod에서는 차단.
    return process.env.NODE_ENV !== "production";
  }
  return allowedOrigins(port).has(origin);
}
```

- **Step 2: 커밋**

```bash
git add packages/gateway/src/ws/verify-origin.ts
git commit -m "feat(gateway): origin verification utility"
```

---

### Task 4.2: server.ts upgrade 핸들러에 origin 검증 적용

**Files:**

- Modify: `packages/gateway/src/server.ts`
- **Step 1: upgrade 핸들러 수정**

```ts
import { verifyOrigin } from "./ws/verify-origin";

server.on("upgrade", (req, socket, head) => {
  if (!verifyOrigin(req, port)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  if (req.url === "/ws/terminal") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else if (req.url === "/ws/gateway") {
    wssGateway.handleUpgrade(req, socket, head, (ws) => wssGateway.emit("connection", ws, req));
  } else if (req.url?.startsWith("/ws/task-terminal/")) {
    wssTaskTerminal.handleUpgrade(req, socket, head, (ws) => wssTaskTerminal.emit("connection", ws, req));
  } else if (req.url?.startsWith("/ws/task-logs/")) {
    wssTaskLogs.handleUpgrade(req, socket, head, (ws) => wssTaskLogs.emit("connection", ws, req));
  }
  // 나머지는 Next의 upgrade로 통과
});
```

- **Step 2: 스모크 — 다른 origin 차단 확인**

수동: 브라우저 콘솔에서 `new WebSocket("ws://localhost:3001/ws/gateway")`는 같은 origin이므로 OK. 별도 포트(예: `http://localhost:3002`에 간단한 HTML)에서 접속 시 403 차단 확인.

- **Step 3: 커밋**

```bash
git commit -am "feat(gateway): apply origin verification to all WS upgrades"
```

---

### Task 4.3: RPC params 스키마 검증(이미 Task 3.3에서 포함)

Task 3.3의 gateway-channel.ts에서 `safeParse`를 이미 호출하므로 추가 작업 없음. 다만 각 메서드가 실제로 zod 스키마를 제공하는지 확인.

- **Step 1: 레지스트리 스키마 존재 확인**

```bash
grep -n "paramsSchema" packages/gateway/src/rpc/methods/*.ts
```

Expected: 모든 메서드 파일에 `paramsSchema: z.object(...)` 존재.

- **Step 2: 잘못된 params 보내기 수동 테스트**

DevTools 콘솔:

```js
// 잘못된 RPC params 시도
const ws = new WebSocket("ws://localhost:3001/ws/gateway");
ws.onopen = () => ws.send(JSON.stringify({ type: "req", id: "x", method: "orchestrate.start", params: { unknown: 1 } }));
ws.onmessage = (e) => console.log(e.data);
```

Expected: `{ ok: false, error: { code: "INVALID_PARAMS", ... } }` (strict schema가 unknown key 거부).

- **Step 3: 기록(문서 갱신 불필요)**

---

## Phase 5 — 프로덕션 부팅

### Task 5.1: `start` 스크립트를 gateway 기반으로

(Phase 1.6 Step 3에서 이미 `start`를 gateway tsx로 바꿔둔 상태라면 이 Task는 검증만.)

**Files:**

- Confirm: `packages/dashboard/package.json` `start` 스크립트
- **Step 1: `packages/dashboard/package.json` 확인**

```json
"start": "NODE_ENV=production tsx ../../packages/gateway/src/server.ts",
```

(또는 `cross-env` 사용. macOS bash에서는 `NODE_ENV=production ...` 직접 prefix 가능.)

- **Step 2: `server.ts`의 `dev` 플래그 확인**

```bash
grep -n "process.env.NODE_ENV" packages/gateway/src/server.ts
```

Expected: `const dev = process.env.NODE_ENV !== "production";`

- **Step 3: 프로덕션 빌드 + 부팅 스모크**

```bash
cd packages/dashboard && npm run build && cd -
PORT=3001 NODE_ENV=production npm --prefix packages/dashboard start &
sleep 3
curl -s http://localhost:3001 | head -20
```

Expected: HTML 반환.

- **Step 4: WS 스모크**

브라우저에서 `http://localhost:3001` 접속, `/ws/gateway` 연결 확인. 태스크 목록·로그 등 정상.

- **Step 5: 서버 정리 + 커밋**

```bash
# 위에서 백그라운드 서버 종료
kill %1 2>/dev/null
git commit -am "feat(dashboard): use gateway for production start (one-port)" --allow-empty
```

---

## Phase 6 — 문서 · 최종 검증

### Task 6.1: `orchestrator-node-architecture.md` 재작성

**Files:**

- Rewrite: `docs/architecture/orchestrator-node-architecture.md`
- **Step 1: 본문을 게이트웨이 기반으로 재작성**

변경 포인트:

- 제목/기준 문장: "gateway"로 용어 통일
- §1 프로세스 경계: `Next.js 서버 프로세스` → `gateway 단일 프로세스`
- §2 내부 레이어: 경로 `packages/engine/src/orchestrate/`**로 갱신
- §4 UI↔서버 이벤트: SSE 섹션 전면 교체 — `/ws/gateway` snapshot/event/RPC 흐름
- §5 소스 경로 테이블: gateway 경로 + bus/event-store 추가, `/ws/orchestrate` 제거

전면 rewrite라 diff 대신 새로 작성. (구현 세부는 이 플랜의 scope 밖이므로 실행 담당자가 작성 후 커밋.)

- **Step 2: 마이그레이션 고지 배너 제거**

상단 `⚠ 마이그레이션 중` 블록 삭제.

- **Step 3: 커밋**

```bash
git commit -am "docs(arch): rewrite orchestrator-node-architecture for gateway + ws"
```

---

### Task 6.2: 전 패키지 타입체크

- **Step 1: runtime**

```bash
cd packages/engine && npx tsc --noEmit && cd -
```

- **Step 2: gateway**

```bash
cd packages/gateway && npx tsc --noEmit && cd -
```

- **Step 3: dashboard**

```bash
cd packages/dashboard && npx tsc --noEmit && cd -
```

Expected: 모두 에러 없음.

---

### Task 6.3: Storybook / Playwright 회귀

- **Step 1: Storybook**

```bash
cd packages/dashboard && npm run build-storybook
```

Expected: 에러 없음.

- **Step 2: Playwright e2e**

```bash
cd packages/dashboard && npx playwright install --with-deps chromium
cd packages/dashboard && npm run test:e2e
```

Expected: 기존 그린 테스트 유지. WS 관련 테스트는 `/ws/gateway` 경로로 업데이트 필요 시 별도 PR.

- **Step 3: 이슈 기록(있을 경우)**

---

### Task 6.4: 재연결 · seq · gap 스모크

- **Step 1: 시나리오 1 — WS 강제 close → replay**

1. dev 서버 기동
2. 브라우저 접속, DevTools에서 `/ws/gateway` 커넥션 확인
3. `event` 몇 번 발생시킴(태스크 상태 변경)
4. DevTools Network에서 WS abort
5. 자동 재연결 후 `replay` 메시지에 직전 seq 이후 이벤트 포함 확인
6. UI 정합(태스크 목록, orchestration-status) 유지 확인

- **Step 2: 시나리오 2 — 서버 재시작 → replay-gap → snapshot fallback**

1. 이벤트 다수 발생
2. gateway 프로세스 kill 후 재시작(링버퍼 초기화됨, seq 0부터)
3. 클라이언트 `hello`의 `lastSeq`는 이전 값 → 서버 tail보다 훨씬 큼(혹은 반대): `replay-gap` 회신
4. 클라이언트가 `tasksStore.fetchAll()` 등으로 fallback 수행, UI 정합 회복

- **Step 3: 시나리오 3 — run/idle 전환 중 WS 유지**

1. `orchestrate.start` 호출
2. running 상태 확인
3. `orchestrate.stop` 호출
4. idle 전환 동안 WS 커넥션 유지(close 이벤트 발생하지 않음) 확인

- **Step 4: 기록**

결과를 간단히 PR description에 첨부.

---

### Task 6.5: Prompt Feedback 기록

- **Step 1: PR description 끝에 Prompt Feedback 섹션 추가**

(CLAUDE.md 규칙 — 작업 완료 후 상위 프롬프트 피드백)

- **Step 2: 최종 PR 생성**

```bash
gh pr create --title "feat: gateway unification (rename, 3-pkg split, ws /ws/gateway, sse removed)" --body "..."
```

---

## 완료 기준(Definition of Done)

- `packages/engine/src/engine` 경로 없음(전부 `src/orchestrate`)
- `packages/engine/src/lib/sse` 경로 없음(전부 `src/bus`)
- `packages/gateway` 패키지 존재, `src/server.ts`가 dev/prod 단일 엔트리
- `packages/dashboard/server.ts` 부재(얇은 shim도 없음)
- `/sse` 라우트 404, `/ws/orchestrate` 404, `/ws/gateway` 200 upgrade
- 레이아웃에 `SseProvider` 없음, `GatewayWsProvider` 존재
- `AutoImproveControl`, `OrchestrateLogViewer` 모두 GatewayClient 의존
- `orchestrate.start`는 non-idempotent, `orchestrate.stop`은 idempotent로 등록
- 전 패키지 tsc --noEmit 그린
- dev/prod 모두 한 포트(`PORT`)에서 페이지 + WS 동작
- Origin 검증 작동(다른 origin 403)
- `orchestrator-node-architecture.md` 재작성 완료(마이그레이션 배너 삭제)
- 재연결 시나리오 3건 수동 검증 통과

