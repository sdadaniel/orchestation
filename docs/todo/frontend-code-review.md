# 프론트엔드 코드 점검 보고서

> 작성일: 2026-03-25
> 대상: `src/frontend/src/**`
> 분석 범위: 성능 최적화, 타입 안정성, 접근성, 번들 최적화, 중복 코드, 에러 처리

---

## 목차

1. [성능 최적화 이슈](#1-성능-최적화-이슈)
2. [타입 안정성 문제](#2-타입-안정성-문제)
3. [에러 처리 개선](#3-에러-처리-개선)
4. [접근성(a11y) 이슈](#4-접근성a11y-이슈)
5. [중복 코드](#5-중복-코드)
6. [번들 최적화](#6-번들-최적화)
7. [기타 코드 품질 이슈](#7-기타-코드-품질-이슈)

---

## 1. 성능 최적화 이슈

### PERF-001 — SSE 연결 중복 생성
**심각도**: 높음
**위치**: `src/hooks/useTasks.ts:81`, `src/hooks/useRequests.ts:80`

**문제 설명**
`useTasks`와 `useRequests` 두 훅이 각각 독립적으로 `/api/tasks/watch` SSE 엔드포인트에 연결한다. `AppShell.tsx`에서 두 훅을 모두 사용하므로, 페이지 로드 시 동일한 엔드포인트에 EventSource가 2개 동시 생성된다.

```typescript
// useTasks.ts:81
es = new EventSource("/api/tasks/watch");

// useRequests.ts:80 — 완전히 동일한 코드
es = new EventSource("/api/tasks/watch");
```

**개선 방안**
SSE 연결을 단일 Context 또는 공유 훅(`useTaskWatch`)으로 추출하여 하나의 연결만 유지한다.

---

### PERF-002 — 컴포넌트 메모이제이션 부재
**심각도**: 중간
**위치**: `src/components/TaskRow.tsx`, `src/components/RequestCard.tsx`, `src/components/waterfall/TaskBar.tsx`

**문제 설명**
리스트를 렌더링하는 핵심 컴포넌트들에 `React.memo`가 적용되지 않았다. 부모 컴포넌트 상태(예: `isSelected`, 필터 값)가 변경될 때마다 모든 행이 불필요하게 리렌더링된다.

```typescript
// TaskRow.tsx — memo 없음
export function TaskRow({ task, isSelected, onClick }: TaskRowProps) {
  ...
}
```

**개선 방안**
```typescript
export const TaskRow = React.memo(function TaskRow({ task, isSelected, onClick }: TaskRowProps) {
  ...
}, (prev, next) => prev.task.id === next.task.id && prev.isSelected === next.isSelected);
```

---

### PERF-003 — DAGCanvas 내부 dummy 상태를 통한 강제 리렌더링
**심각도**: 중간
**위치**: `src/components/DAGCanvas.tsx:224`

**문제 설명**
줌 비율 표시를 위해 숫자를 증가시키는 dummy 상태를 사용해 전체 컴포넌트를 강제 리렌더링한다. SVG 요소는 `apply()` 함수로 직접 조작하면 충분한데, 단순 퍼센트 표시 때문에 컴포넌트 전체가 재실행된다.

```typescript
const [, kick] = useState(0);
// ...
tf.current = { ... };
apply(); kick((n) => n + 1);  // 전체 재렌더링 트리거
```

**개선 방안**
줌 비율용 `zoomPercent` 상태를 별도 분리하거나, 퍼센트 표시 영역을 `useRef`로 직접 DOM 업데이트한다.

---

### PERF-004 — DAGCanvas 내 settings API 페치에 abort 미처리
**심각도**: 낮음
**위치**: `src/components/DAGCanvas.tsx:223`

**문제 설명**
컴포넌트 마운트 시 `/api/settings` 페치가 발생하지만, cleanup 함수에서 AbortController를 사용하지 않아 언마운트 후 응답이 와도 상태 업데이트를 시도할 수 있다.

```typescript
useEffect(() => {
  fetch("/api/settings")
    .then((r) => { ... })
    .then((d) => { if (d.maxParallel) setMaxParallel(d.maxParallel); })
    .catch(() => {});
}, []);  // cleanup 없음
```

**개선 방안**
```typescript
useEffect(() => {
  const controller = new AbortController();
  fetch("/api/settings", { signal: controller.signal })
    .then(...)
    .catch((err) => { if (err.name !== "AbortError") console.error(err); });
  return () => controller.abort();
}, []);
```

---

### PERF-005 — TaskDetailPage 복수의 독립 폴링 타이머
**심각도**: 중간
**위치**: `src/app/tasks/[id]/page.tsx:207-264`

**문제 설명**
태스크 상세 페이지에서 3개의 독립적인 `setInterval` 폴링이 동시 실행된다:
1. 오케스트레이션 상태 폴링 (5초)
2. 개별 태스크 실행 상태 폴링 (2초)
3. LiveLogPanel 내부 로그 폴링 (1.5초)

**개선 방안**
공통 폴링 훅(`usePolling`)을 만들어 중복을 제거하고, 태스크가 `in_progress` 상태일 때만 로그 폴링을 활성화하도록 한다. 또한 SSE를 통해 실시간으로 받을 수 있다면 폴링을 대체한다.

---

### PERF-006 — OrchestrationManager 로그 배열 무제한 증가
**심각도**: 중간
**위치**: `src/lib/orchestration-manager.ts:178`

**문제 설명**
`this.state.logs` 배열이 오케스트레이션 실행 동안 무제한으로 증가한다. 장시간 실행 시 메모리 누수로 이어질 수 있다.

```typescript
private appendLog(line: string) {
  this.state.logs.push(line);  // 최대 개수 제한 없음
}
```

**개선 방안**
```typescript
private readonly MAX_LOGS = 10000;

private appendLog(line: string) {
  this.state.logs.push(line);
  if (this.state.logs.length > this.MAX_LOGS) {
    this.state.logs = this.state.logs.slice(-this.MAX_LOGS);
  }
}
```

---

### PERF-007 — hasLogSources()가 전체 파일을 읽어 문자열 포함 여부 검사
**심각도**: 낮음
**위치**: `src/lib/task-log-parser.ts:226-235`

**문제 설명**
`hasLogSources()`는 `token-usage.log` 파일 전체를 읽어 특정 taskId가 포함되어 있는지 확인한다. 이 파일이 커질수록 비효율적이다.

```typescript
const content = fs.readFileSync(TOKEN_LOG, "utf-8");
if (content.includes(taskId)) return true;
```

**개선 방안**
`fs.createReadStream()`으로 스트리밍 방식으로 읽거나, 파일 존재 여부만 먼저 체크한 뒤 필요할 때만 전체 파싱한다.

---

### PERF-008 — stop() 타임아웃이 프로세스 정상 종료 시에도 해제되지 않음
**심각도**: 중간
**위치**: `src/lib/orchestration-manager.ts:163-173`

**문제 설명**
`stop()` 메서드에서 설정한 5초 후 SIGKILL 타이머가 프로세스가 자연스럽게 종료되어도 취소되지 않는다.

```typescript
const proc = this.process;
setTimeout(() => {           // 이 타이머는 절대 취소되지 않음
  if (proc && !proc.killed) {
    try { proc.kill("SIGKILL"); } catch { }
  }
}, 5000);
```

**개선 방안**
`proc.on("close", ...)` 핸들러에서 타이머를 취소하도록 `clearTimeout`을 호출한다.

---

## 2. 타입 안정성 문제

### TYPE-001 — `any` 타입 명시적 사용
**심각도**: 높음
**위치**: `src/app/tasks/[id]/page.tsx:33-35`

**문제 설명**
`TaskDetail` 인터페이스의 두 필드가 `any` 타입으로 선언되어 있다. ESLint disable 주석까지 달려 있어 의도적으로 우회한 것으로 보인다.

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
executionLog: Record<string, any> | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
reviewResult: Record<string, any> | null;
```

**개선 방안**
Claude API 결과 JSON 구조를 분석하여 구체적인 타입 정의를 작성한다.

```typescript
interface ExecutionLog {
  subtype?: "success" | "error" | string;
  num_turns?: number;
  duration_ms?: number;
  total_cost_usd?: number;
  result?: string;
  is_error?: boolean;
}
```

---

### TYPE-002 — TaskFrontmatter의 status, priority가 `string` 타입
**심각도**: 높음
**위치**: `src/lib/parser.ts:8-9`

**문제 설명**
`TaskFrontmatter` 인터페이스의 `status`와 `priority`가 좁은 유니온 타입 대신 `string`으로 선언되어 있다. 이로 인해 하위 컴포넌트에서 타입 단언(`as TaskStatus`)이 필요해진다.

```typescript
export interface TaskFrontmatter {
  status: string;   // "pending" | "in_progress" | ... 이어야 함
  priority: string; // "high" | "medium" | "low" 이어야 함
```

**개선 방안**
```typescript
import type { WaterfallTaskStatus } from "@/types/waterfall";

export interface TaskFrontmatter {
  status: WaterfallTaskStatus | "unknown";
  priority: "critical" | "high" | "medium" | "low";
```

---

### TYPE-003 — `waterfall.ts`의 VALID_STATUSES가 불완전
**심각도**: 높음
**위치**: `src/lib/waterfall.ts:14-19`

**문제 설명**
`WaterfallTaskStatus` 유니온 타입에는 `"stopped"`, `"reviewing"`, `"rejected"`가 포함되어 있지만, `VALID_STATUSES` Set에서 누락되어 있다. 이 상태들은 기본값 `"pending"`으로 변환되어 실제 상태가 소실된다.

```typescript
const VALID_STATUSES: Set<string> = new Set([
  "pending",
  "in_progress",
  "in_review",
  "done",
  // "stopped", "reviewing", "rejected" 누락!
]);
```

**개선 방안**
```typescript
const VALID_STATUSES = new Set<WaterfallTaskStatus>([
  "pending", "stopped", "in_progress", "in_review",
  "reviewing", "done", "rejected",
]);
```

---

### TYPE-004 — RequestData와 RequestItem 인터페이스 중복
**심각도**: 중간
**위치**: `src/lib/request-parser.ts:4-16`, `src/hooks/useRequests.ts:5-15`

**문제 설명**
동일한 태스크 파일을 표현하는 두 개의 거의 동일한 인터페이스가 존재한다. `RequestData`에는 `depends_on`, `branch`가 있고, `RequestItem`에는 없다. API 경계에서의 타입 불일치를 유발한다.

```typescript
// request-parser.ts
export interface RequestData {
  depends_on: string[];
  branch: string;
  // ...
}

// useRequests.ts
export interface RequestItem {
  // depends_on, branch 없음
  // ...
}
```

**개선 방안**
`RequestData`를 공유 타입 파일(`src/types/task.ts`)로 이동하고, `RequestItem`을 제거하거나 `RequestData`의 별칭으로 처리한다.

---

### TYPE-005 — 안전하지 않은 타입 단언
**심각도**: 중간
**위치**: `src/components/TaskRow.tsx:20-22`, `src/components/TaskEditSheet.tsx`

**문제 설명**
`task.status as TaskStatus`, `task.priority as TaskPriority` 형태의 단언이 다수 존재한다. 런타임에 예상치 못한 값이 들어올 경우 `undefined`로 인한 렌더링 오류가 발생할 수 있다.

```typescript
const statusStyle = STATUS_STYLES[task.status as TaskStatus];
// statusStyle이 undefined일 경우 .dot 접근 시 오류
```

**개선 방안**
타입 가드 함수 또는 optional chaining + 기본값을 사용한다.

```typescript
const statusStyle = STATUS_STYLES[task.status as TaskStatus] ?? STATUS_STYLES.pending;
```

---

## 3. 에러 처리 개선

### ERR-001 — `alert()` 사용
**심각도**: 중간
**위치**: `src/app/tasks/[id]/page.tsx:272-273, 278`

**문제 설명**
사용자 대면 에러 피드백에 브라우저 기본 `alert()`를 사용한다. UX를 방해하고 일관성을 해친다.

```typescript
alert(data.error || "실행 실패");
alert("실행 요청 실패");
```

**개선 방안**
이미 `AppShell`에서 `useToast()` 훅이 사용되고 있다. 태스크 상세 페이지에도 토스트 시스템을 사용한다. 또는 에러 상태를 인라인 배너로 표시한다.

---

### ERR-002 — 에러를 완전히 무시하는 빈 catch 블록
**심각도**: 중간
**위치**: 다수 파일

**문제 설명**
네트워크 오류, 파일 I/O 오류 등이 조용히 무시되어 디버깅이 어렵다.

```typescript
// AppShell.tsx:229
} catch { /* ignore - process may not exist */ }

// app/tasks/[id]/page.tsx:87
} catch {
  // ignore
}
```

**개선 방안**
개발 환경에서는 `console.warn` 또는 `console.error`를 추가하고, 사용자에게 알릴 필요가 있는 경우는 토스트로 안내한다.

---

### ERR-003 — TaskLogModal이 전체 로그를 매번 다시 페치
**심각도**: 낮음
**위치**: `src/components/TaskLogModal.tsx:24`

**문제 설명**
`since=0`으로 고정하여 항상 처음부터 모든 로그를 가져온다. 오케스트레이션이 오래 실행된 경우 매번 전체 로그를 내려받는다.

```typescript
const res = await fetch(`/api/orchestrate/logs?since=0`);
```

**개선 방안**
이미 API가 `since` 파라미터를 지원하므로, 마지막으로 받은 로그 인덱스를 상태로 관리하여 증분 페치를 구현한다.

---

### ERR-004 — React Error Boundary 없음
**심각도**: 중간
**위치**: `src/app/layout.tsx`, 각 페이지

**문제 설명**
전체 애플리케이션에 React Error Boundary가 없다. 컴포넌트 렌더링 중 예외 발생 시 전체 화면이 흰색으로 표시된다.

**개선 방안**
`src/components/ErrorBoundary.tsx`를 작성하고 AppShell 및 각 페이지의 최상위에 적용한다.

---

## 4. 접근성(a11y) 이슈

### A11Y-001 — ChatBot 세션 목록 항목의 키보드 접근 불가
**심각도**: 높음
**위치**: `src/components/ChatBot.tsx:299-314`

**문제 설명**
세션 목록의 각 항목이 `div` + `onClick`으로 구현되어 있어 키보드로 접근하거나 선택할 수 없다. `tabIndex`나 `onKeyDown` 핸들러가 없다.

```tsx
<div
  className={cn("group flex items-center gap-1.5 ...")}
  onClick={() => setActiveSessionId(s.id)}  // 키보드 미지원
>
```

**개선 방안**
`<button>` 요소로 교체하거나 `tabIndex={0}`, `role="option"`, `onKeyDown` 핸들러를 추가한다.

---

### A11Y-002 — 아이콘 전용 버튼의 접근 가능한 레이블 부재
**심각도**: 높음
**위치**: 다수 파일 (ChatBot.tsx, TaskLogModal.tsx, AppShell.tsx 등)

**문제 설명**
아이콘만 표시하는 버튼들(`X`, `Plus`, `Trash2` 등)에 `aria-label`이 없어 스크린 리더 사용자에게 버튼의 목적을 전달할 수 없다.

```tsx
<button type="button" onClick={() => setIsOpen(false)}>
  <X className="h-3.5 w-3.5" />  // 레이블 없음
</button>
```

**개선 방안**
```tsx
<button type="button" onClick={() => setIsOpen(false)} aria-label="챗봇 닫기">
  <X className="h-3.5 w-3.5" />
</button>
```

---

### A11Y-003 — DAGCanvas SVG에 접근성 정보 없음
**심각도**: 중간
**위치**: `src/components/DAGCanvas.tsx:263`

**문제 설명**
SVG 캔버스에 `role`, `aria-label`, `<title>` 요소가 없어 스크린 리더가 내용을 해석할 수 없다.

```tsx
<svg ref={svgRef} className="dag-canvas ...">
  {/* role, aria-label 없음 */}
```

**개선 방안**
```tsx
<svg ref={svgRef} role="img" aria-label={`태스크 의존성 그래프, ${requests.length}개 태스크`} className="dag-canvas ...">
  <title>태스크 의존성 그래프</title>
```

---

### A11Y-004 — 모달의 포커스 트랩 미구현
**심각도**: 중간
**위치**: `src/components/TaskLogModal.tsx`, `src/components/ChatBot.tsx`

**문제 설명**
모달이 열려 있을 때 Tab 키로 포커스가 모달 바깥으로 이동한다. 모달을 닫을 때 이전 포커스 위치로 복원되지 않는다.

**개선 방안**
`focus-trap-react` 라이브러리를 사용하거나, 직접 포커스 트랩 로직을 구현한다. Radix UI의 `Dialog` 컴포넌트(이미 프로젝트에 포함)로 교체하면 자동으로 처리된다.

---

### A11Y-005 — TaskRow의 `div[role="button"]`
**심각도**: 낮음
**위치**: `src/components/TaskRow.tsx:25-28`

**문제 설명**
`role="button"`과 `tabIndex={0}`, `onKeyDown`은 구현되어 있으나, 시맨틱상 `<button>` 요소가 더 적합하다. ARIA role은 네이티브 의미론을 대체하는 용도여야 한다.

```tsx
<div
  role="button"
  tabIndex={0}
  className={cn("task-row", ...)}
  onClick={() => onClick(task)}
  onKeyDown={...}
>
```

**개선 방안**
스타일을 유지하면서 `<button>` 태그로 교체한다.

---

## 5. 중복 코드

### DUP-001 — SSE 연결/재연결 로직 중복
**심각도**: 높음
**위치**: `src/hooks/useTasks.ts:71-99`, `src/hooks/useRequests.ts:67-98`

**문제 설명**
두 훅에 동일한 SSE 연결/재연결/디바운스 패턴이 복사되어 있다. 총 29줄이 거의 동일하다.

```typescript
// useTasks.ts — SSE 섹션
const connect = () => {
  es = new EventSource("/api/tasks/watch");
  es.onmessage = (e) => {
    if (e.data === "changed") debouncedRefetch();
  };
  es.onerror = () => {
    es?.close();
    reconnectTimer = setTimeout(connect, 2000);
  };
};

// useRequests.ts — 완전히 동일
```

**개선 방안**
공유 유틸리티 훅 `useSSEWatch(url, onChanged)` 또는 공통 SSE Context를 추출한다.

---

### DUP-002 — in_progress 스피닝 점 마크업 중복
**심각도**: 중간
**위치**: `src/components/AppShell.tsx:67`, `src/components/DAGCanvas.tsx:287`, `src/app/tasks/[id]/page.tsx:331,440,453`, `src/components/TaskLogModal.tsx`

**문제 설명**
`in_progress` 상태를 나타내는 스피닝 점 마크업이 6곳 이상에 복사되어 있다.

```tsx
// 6곳에서 반복되는 동일 패턴
<span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />
```

**개선 방안**
```tsx
// src/components/ui/StatusDot.tsx
export function StatusDot({ status }: { status: WaterfallTaskStatus }) {
  if (status === "in_progress") {
    return <span className="w-2 h-2 shrink-0 border-[1.5px] border-blue-500 border-t-transparent rounded-full animate-spin" />;
  }
  return <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[status])} />;
}
```

---

### DUP-003 — 상태/우선순위 색상 상수 중복 정의
**심각도**: 중간
**위치**: `src/lib/constants.ts`, `src/app/tasks/constants.ts`, `src/app/tasks/[id]/page.tsx:42-63`

**문제 설명**
`STATUS_DOT`, `STATUS_LABEL`, `PRIORITY_COLORS` 등 동일한 매핑이 3곳에 분산 정의되어 있다. 새 상태 추가 시 모든 파일을 수정해야 한다.

```typescript
// app/tasks/[id]/page.tsx — 로컬 정의 (동일 내용을 constants에서도 정의)
const STATUS_DOT: Record<string, string> = {
  stopped: "bg-violet-500",
  pending: "bg-yellow-500",
  // ...
};
```

**개선 방안**
`src/lib/constants.ts` 또는 `src/types/task.ts`를 단일 소스로 통합하고 모든 파일에서 import하여 사용한다.

---

### DUP-004 — YAML 프론트매터 파싱 이중 구현
**심각도**: 높음
**위치**: `src/lib/parser.ts`, `src/lib/request-parser.ts`

**문제 설명**
`parser.ts`는 `gray-matter` 라이브러리를 사용하여 YAML을 파싱하지만, `request-parser.ts`는 동일한 파일 형식에 대해 정규식 기반 커스텀 파서를 구현하고 있다.

```typescript
// parser.ts — gray-matter 사용
const { data } = matter(content);

// request-parser.ts — 정규식으로 직접 파싱 (52줄)
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
const id = fm.match(/^id:\s*(.+)$/m)?.[1]?.trim() || ...
const status = (fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() || ...) as ...
```

**개선 방안**
`request-parser.ts`도 `gray-matter`를 사용하도록 통일한다. YAML 파싱 관련 버그를 방지하고 코드를 대폭 단순화할 수 있다.

---

### DUP-005 — `displayTaskId` no-op 함수 중복
**심각도**: 낮음
**위치**: `src/components/AppShell.tsx:33`, `src/app/tasks/[id]/page.tsx:65`

**문제 설명**
`(id: string) => id`를 반환하는 아무 동작도 없는 함수가 두 파일에 각각 선언되어 있다.

```typescript
const displayTaskId = (id: string) => id;
```

**개선 방안**
함수를 삭제하고 직접 `task.id`를 사용한다. 향후 포맷팅이 필요해지면 공유 유틸리티로 추출한다.

---

## 6. 번들 최적화

### BUNDLE-001 — 대형 단일 파일 컴포넌트
**심각도**: 중간
**위치**: `src/app/tasks/[id]/page.tsx` (665줄), `src/components/DAGCanvas.tsx` (313줄)

**문제 설명**
태스크 상세 페이지가 665줄의 단일 파일로 구성되어 있으며, `LiveLogPanel`, `BranchBadge`, 탭 콘텐츠 등 분리 가능한 컴포넌트들이 포함되어 있다. DAGCanvas는 레이아웃 계산 로직과 렌더링 컴포넌트가 혼재한다.

**개선 방안**
```
src/app/tasks/[id]/
├── page.tsx         (메인 라우트 컴포넌트, ~150줄)
├── LiveLogPanel.tsx (~60줄)
├── BranchBadge.tsx  (~30줄)
└── TaskMetaBar.tsx  (~80줄)

src/components/
├── DAGCanvas.tsx           (SVG 렌더링만, ~150줄)
└── dag/computeLayout.ts    (레이아웃 계산 순수 함수)
```

---

### BUNDLE-002 — 상대 경로 import 불일치
**심각도**: 낮음
**위치**: `src/components/TaskRow.tsx:10`, `src/components/TaskEditSheet.tsx:15`

**문제 설명**
대부분의 파일이 `@/lib/...` alias를 사용하지만, 일부 파일은 `../../lib/constants` 형태의 상대 경로를 사용한다.

```typescript
// TaskRow.tsx — 상대 경로
import { STATUS_STYLES, ... } from "../../lib/constants";

// 다른 파일들 — alias 사용
import { STATUS_STYLES, ... } from "@/lib/constants";
```

**개선 방안**
모든 import를 `@/` alias로 통일한다.

---

### BUNDLE-003 — 미사용 import 잠재적 포함
**심각도**: 낮음
**위치**: `src/app/tasks/[id]/page.tsx:6`

**문제 설명**
`RotateCcw` 아이콘이 import되어 있지만 컴포넌트 어디서도 사용되지 않는다.

```typescript
import { ArrowLeft, Loader2, FileText, Terminal, ClipboardCheck,
         Play, Square, RotateCcw,  // ← 미사용
         CheckCircle2, GitBranch, Check, Copy, DollarSign, Trash2 } from "lucide-react";
```

**개선 방안**
ESLint `no-unused-vars` 규칙을 활성화하고 미사용 import를 제거한다.

---

## 7. 기타 코드 품질 이슈

### MISC-001 — `generateId()`의 Math.random() 기반 ID 생성
**심각도**: 낮음
**위치**: `src/components/ChatBot.tsx:21`

**문제 설명**
세션/메시지 ID 생성에 `Math.random().toString(36).slice(2, 10)` (8자리)를 사용한다. 낮은 확률이지만 충돌 가능성이 있고, 예측 가능하다.

```typescript
function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
```

**개선 방안**
`crypto.randomUUID()` 또는 `crypto.getRandomValues()`를 사용한다. Next.js 환경에서 Web Crypto API를 사용할 수 있다.

---

### MISC-002 — `parseResultLogs`의 논리 오류
**심각도**: 중간
**위치**: `src/lib/task-log-parser.ts:152`

**문제 설명**
`resultStatus` 판별 로직에 연산자 우선순위 오류가 있다. `data.result || data.is_error`는 `data.result`가 truthy한 경우 항상 `"error"`를 반환한다.

```typescript
const resultStatus = data.result || data.is_error ? "error" : "success";
// 의도: data.result가 있거나, data.is_error가 true이면 "error"
// 실제: (data.result || data.is_error) ? "error" : "success"
//       data.result가 있으면 항상 "error"
```

**개선 방안**
```typescript
const resultStatus = data.is_error ? "error" : "success";
```

---

### MISC-003 — `stop()` 메서드에서 `setTimeout` 클로저 잠재적 문제
**심각도**: 낮음
**위치**: `src/lib/orchestration-manager.ts:163`

**문제 설명**
`const proc = this.process`로 복사한 뒤 타임아웃 콜백에서 사용하고 있다. 하지만 타임아웃 내에서 `!proc.killed` 체크만 하면 충분하지 않다 — 이미 다른 실행의 새 프로세스가 시작되었을 경우 엉뚱한 프로세스를 종료할 수 있다.

**개선 방안**
프로세스 참조와 실행 세션 ID를 함께 확인하여 올바른 프로세스만 종료하도록 방어 로직을 추가한다.

---

### MISC-004 — 날짜 포맷팅 로직의 직접 구현
**심각도**: 낮음
**위치**: `src/lib/request-parser.ts:33-38`

**문제 설명**
날짜 포맷팅을 직접 문자열 조작으로 구현하고 있다. 타임존 처리 없이 로컬 시간을 사용하며, 코드가 장황하다.

```typescript
const mtime = `${mt.getFullYear()}-${String(mt.getMonth()+1).padStart(2,"0")}-...`;
const timeStr = `${String(mt.getHours()).padStart(2,"0")}:${String(mt.getMinutes()).padStart(2,"0")}`;
```

**개선 방안**
`Intl.DateTimeFormat` 또는 프로젝트에서 이미 사용 가능한 간단한 포맷 유틸을 작성하여 재사용한다.

---

## 요약 테이블

| ID | 카테고리 | 심각도 | 파일 위치 | 요약 |
|----|----------|--------|-----------|------|
| PERF-001 | 성능 | 높음 | hooks/useTasks.ts, hooks/useRequests.ts | SSE 연결 중복 생성 |
| PERF-002 | 성능 | 중간 | components/TaskRow.tsx 등 | React.memo 미적용 |
| PERF-003 | 성능 | 중간 | components/DAGCanvas.tsx:224 | dummy 상태 강제 리렌더링 |
| PERF-004 | 성능 | 낮음 | components/DAGCanvas.tsx:223 | fetch AbortController 미처리 |
| PERF-005 | 성능 | 중간 | app/tasks/[id]/page.tsx:207-264 | 복수 독립 폴링 타이머 |
| PERF-006 | 성능 | 중간 | lib/orchestration-manager.ts:178 | 로그 배열 무제한 증가 |
| PERF-007 | 성능 | 낮음 | lib/task-log-parser.ts:226 | 대용량 파일 전체 읽기 |
| PERF-008 | 성능 | 중간 | lib/orchestration-manager.ts:163 | stop() 타이머 미해제 |
| TYPE-001 | 타입 | 높음 | app/tasks/[id]/page.tsx:33 | any 타입 명시적 사용 |
| TYPE-002 | 타입 | 높음 | lib/parser.ts:8-9 | status/priority가 string 타입 |
| TYPE-003 | 타입 | 높음 | lib/waterfall.ts:14-19 | VALID_STATUSES 불완전 |
| TYPE-004 | 타입 | 중간 | lib/request-parser.ts, hooks/useRequests.ts | 인터페이스 중복 |
| TYPE-005 | 타입 | 중간 | components/TaskRow.tsx:20 | 안전하지 않은 타입 단언 |
| ERR-001 | 에러처리 | 중간 | app/tasks/[id]/page.tsx:272 | alert() 사용 |
| ERR-002 | 에러처리 | 중간 | 다수 | 빈 catch 블록 |
| ERR-003 | 에러처리 | 낮음 | components/TaskLogModal.tsx:24 | 전체 로그 매번 재페치 |
| ERR-004 | 에러처리 | 중간 | app/layout.tsx | Error Boundary 없음 |
| A11Y-001 | 접근성 | 높음 | components/ChatBot.tsx:299 | 세션 항목 키보드 접근 불가 |
| A11Y-002 | 접근성 | 높음 | 다수 | 아이콘 버튼 레이블 없음 |
| A11Y-003 | 접근성 | 중간 | components/DAGCanvas.tsx:263 | SVG 접근성 정보 없음 |
| A11Y-004 | 접근성 | 중간 | TaskLogModal, ChatBot | 모달 포커스 트랩 없음 |
| A11Y-005 | 접근성 | 낮음 | components/TaskRow.tsx:25 | div[role=button] 사용 |
| DUP-001 | 중복 | 높음 | hooks/useTasks.ts, useRequests.ts | SSE 로직 중복 |
| DUP-002 | 중복 | 중간 | 6개 이상 파일 | 스피닝 점 마크업 중복 |
| DUP-003 | 중복 | 중간 | lib/constants.ts, app/tasks/constants.ts | 상수 중복 정의 |
| DUP-004 | 중복 | 높음 | lib/parser.ts, lib/request-parser.ts | YAML 파싱 이중 구현 |
| DUP-005 | 중복 | 낮음 | AppShell.tsx, tasks/[id]/page.tsx | no-op 함수 중복 |
| BUNDLE-001 | 번들 | 중간 | app/tasks/[id]/page.tsx | 665줄 대형 단일 파일 |
| BUNDLE-002 | 번들 | 낮음 | components/TaskRow.tsx | import 경로 불일치 |
| BUNDLE-003 | 번들 | 낮음 | app/tasks/[id]/page.tsx:6 | 미사용 import |
| MISC-001 | 기타 | 낮음 | components/ChatBot.tsx:21 | Math.random() ID 생성 |
| MISC-002 | 기타 | 중간 | lib/task-log-parser.ts:152 | 논리 연산자 오류 |
| MISC-003 | 기타 | 낮음 | lib/orchestration-manager.ts:163 | stop() 프로세스 식별 취약 |
| MISC-004 | 기타 | 낮음 | lib/request-parser.ts:33 | 날짜 포맷 직접 구현 |

---

## 우선순위 개선 권장 순서

### 즉시 처리 권장 (버그 가능성)
1. **TYPE-003** — VALID_STATUSES 불완전으로 상태 데이터 소실
2. **MISC-002** — task-log-parser.ts의 논리 오류
3. **DUP-004** — YAML 파싱 이중 구현으로 인한 버그 위험

### 단기 개선 (품질 향상)
4. **PERF-001** — SSE 중복 연결 제거
5. **DUP-001** — SSE 훅 공통화
6. **TYPE-001, TYPE-002** — any 타입 및 string 타입 제거
7. **ERR-001** — alert() → toast 전환
8. **A11Y-001, A11Y-002** — 키보드 접근성 기본 처리

### 장기 개선 (리팩터링)
9. **PERF-002** — React.memo 적용
10. **BUNDLE-001** — 대형 파일 컴포넌트 분리
11. **DUP-002, DUP-003** — 공통 UI 컴포넌트 통합
12. **ERR-004** — Error Boundary 추가
13. **A11Y-003, A11Y-004** — 모달 및 SVG 접근성 보완
