# Agent Team 패턴 — 병렬 조사 아키텍처

## 개요

Claude Code의 Agent 도구를 활용하여 복수의 서브에이전트를 **병렬로 실행**하고, 메인 에이전트가 결과를 종합하는 패턴.

복잡한 코드 분석, 버그 조사, 아키텍처 리뷰 등에서 사용한다.

## 실행 원리

프로세스를 fork/spawn하는 것이 아니다. 메인 Claude가 **하나의 응답에 여러 Agent tool call을 포함**하면, Claude Code 런타임(하네스)이 이를 **동시에 dispatch**한다. 각 서브에이전트는 별도의 Claude API 세션으로 실행되지만, 프로세스 관리는 런타임이 담당한다.

```
메인 Claude → 하나의 응답에 N개 Agent tool call 반환
                │
Claude Code 런타임이 N개를 동시 dispatch
                │
        ┌───────┼───────┬───────┐
        ▼       ▼       ▼       ▼
    Agent A  Agent B  Agent C  Agent D  (각각 독립된 Claude API 세션)
    (Explore) (Explore) (Explore) (Explore)
    읽기만    읽기만    읽기만    읽기만
        │       │       │       │
        └───────┼───────┴───────┘
                ▼
    N개 결과가 메인 컨텍스트로 반환
                │
                ▼
    메인이 종합 → (선택) strict-reviewer 검증 → 직접 Edit/Write로 코드 수정
```

**중요**: 서브에이전트(Explore/Plan)는 조사만 한다. 코드 수정은 메인이 직접 수행한다.

## 에이전트 타입

| 타입 | 용도 | 사용 가능 도구 | 코드 수정 |
|------|------|---------------|----------|
| `Explore` | 코드 탐색, 키워드 검색, 구조 파악 | Read, Grep, Glob, Bash(읽기) | **불가** — Edit/Write 없음 |
| `Plan` | 구현 계획 수립, 아키텍처 설계 | Read, Grep, Glob, Bash(읽기) | **불가** — Edit/Write 없음 |
| `general-purpose` | 범용 — 조사 + 코드 수정 가능 | 전체 (Edit, Write 포함) | **가능** |

타입은 **능력의 제약**이지, 실행 순서를 강제하지 않는다. 3가지 타입 모두 동시에 병렬 실행 가능.

## 실행 모드

### Foreground (기본)
```
모든 에이전트 결과가 돌아올 때까지 대기한 뒤 다음 단계 진행.
결과가 다음 작업에 필요할 때 사용.
```

### Background (`run_in_background: true`)
```
에이전트를 띄운 뒤 다른 작업을 병행. 완료 시 알림.
결과가 당장 필요하지 않을 때 사용.
```

### Worktree 격리 (`isolation: "worktree"`)
```
임시 git worktree에서 실행. 에이전트가 코드를 수정해도 메인 브랜치에 영향 없음.
코드 수정이 필요한 에이전트를 안전하게 돌릴 때 사용.
```

## 실제 사용 사례

### 사례 1: 좀비 in_progress 버그 분석 (2026-03-30)

#### 문제
`orchestrate.sh`가 태스크를 `in_progress`로 전환 후 워커가 죽으면 영구 교착 상태 발생.

#### 투입한 에이전트 팀 (3 Explore)

| 에이전트 | 타입 | 조사 범위 | 핵심 발견 |
|---------|------|----------|----------|
| `orchestrate-analyzer` | Explore | `orchestrate.sh` — start_task, process_signals, 메인 루프, cleanup | 5개 문제 모두 미수정 확인 |
| `job-task-analyzer` | Explore | `job-task.sh` — 시그널 생성, claude spawn, EXIT trap | job-task.sh 자체는 안전 (EXIT trap 있음). 문제는 시작 실패 시 |
| `recovery-analyzer` | Explore | 프로젝트 전체 — 기존 복구 메커니즘, PID 관리, known-issues | cleanup-stuck.sh(수동), cleanupZombies(서버 시작 시만) 존재. 런타임 감지 부재 |

#### 결과 종합 → 메인이 직접 구현

3개 Explore 에이전트는 **조사만** 수행. 코드 수정(Edit/Write)은 전부 **메인 Claude가 직접** 실행:

1. **`process_signals_for_task()`에 PID liveness 체크** — 시그널 없을 때 `kill -0`으로 워커 생사 확인
2. **`start_task()`에 dispatch 후 검증** — nohup 후 2초 대기, 프로세스 죽었으면 pending 원복
3. **`_write_crashlog()` 헬퍼** — 사망 시 진단 정보(태스크 정보, PID, 시그널, 프로세스 스냅샷, 로그 tail) 기록
4. **메인 루프 health sweep** — 10회 루프마다 RUNNING 태스크의 PID 생존 확인

### 사례 2: 종합 개선안 조사 (2026-03-31)

#### 목표
오케스트레이션 시스템 전체를 속도/효율/정확성/아키텍처 관점에서 종합 점검하고 개선안 수립.

#### 투입한 에이전트 팀 (4 Explore + 1 strict-reviewer)

| 에이전트 | 타입 | 조사 관점 | 핵심 발견 |
|---------|------|----------|----------|
| `speed-analyzer` | Explore | 메인 루프, 폴링, dispatch, signal, git 오버헤드 | 6개 병목 카테고리, 태스크당 60~120초 오버헤드 |
| `efficiency-analyzer` | Explore | context-builder, model-selector, token-usage.log, 템플릿 | 모델 튜닝 여지, 캐시 96.5% 우수 |
| `accuracy-analyzer` | Explore | 리뷰 파이프라인, notices, output, 실패 패턴 | 태스크 기준 86% 승인률, MAX_RETRY 조기 실패 |
| `architecture-analyzer` | Explore | signal.sh, lock, PID, merge, night-worker, known-issues | CRITICAL 2건, HIGH 4건, MEDIUM 3건 |
| **strict-reviewer** | Explore | **위 4개 결과 전체를 검증** | **10건 오류 발견 (아래 상세)** |

#### 핵심: strict-reviewer의 역할

4개 Explore 에이전트가 종합한 초안에는 **10건의 오류와 과장**이 포함되어 있었다. strict-reviewer 에이전트가 코드를 직접 대조하여 발견한 주요 오류:

| # | 원래 주장 | 실제 | 심각도 |
|---|----------|------|--------|
| 1 | TOCTOU 레이스 존재 | signal.sh는 이미 mkdir lock 보호 | CRITICAL — 삭제 |
| 2 | 리뷰 승인률 10.8% | 태스크 단위 ~86% (API 호출 단위 집계 오류) | CRITICAL — 8배 오차 |
| 3 | chmod으로 scope 제한 | git, Claude CLI 파괴 | HIGH — 대안으로 교체 |
| 4 | 비용 32~41% 절감 | 캐시 96.5% 미반영, 실제 15~25% | HIGH — 하향 조정 |
| 5 | Lock rm -rf가 CRITICAL | pgrep kill 단계 누락, MEDIUM으로 하향 | MEDIUM |
| 6 | MAX_RETRY 올리면 해결 | TASK-105 (36회) 같은 케이스 악화 | HIGH — circuit breaker 추가 |

이 결과는 `docs/architecture/improvement-plan.md`에 반영. Phase 1~3 전 16개 항목이 구현되어 야간 10회 점검 후 regression 0건으로 확인됨.

#### 교훈

- **4개 Explore 에이전트**를 **관점별**로 분리하면 각자 깊이 있는 조사가 가능
- **strict-reviewer 에이전트**를 추가하면 에이전트들의 환각/과장을 잡아낼 수 있음 (이 사례에서 10건)
- 관점별 분리 기준: 속도(speed), 효율(efficiency), 정확성(accuracy), 아키텍처(architecture)

## 설계 원칙

### 병렬로 돌리는 이유
- **속도**: 순차 실행 대비 ~3배 빠름
- **컨텍스트 보호**: 각 에이전트가 수백 줄을 읽어도 메인 컨텍스트에는 요약만 들어옴
- **관심사 분리**: 각자 다른 관점으로 조사하여 놓치는 부분 최소화

### 에이전트 분리 기준
- **코드 영역별**: 파일/모듈 단위로 분리 (예: orchestrate.sh vs job-task.sh)
- **관점별**: 같은 코드라도 "현재 구현" vs "기존 복구 메커니즘" 등으로 분리 (예: speed / efficiency / accuracy / architecture)
- **의존성 없이**: 에이전트 간 결과 의존이 없어야 병렬 실행 가능

### strict-reviewer 에이전트 패턴

병렬 Explore 에이전트의 결과를 종합한 후, **별도의 strict-reviewer 에이전트**로 전체 결과를 검증하는 것을 권장한다.

**왜 필요한가**: Explore 에이전트는 코드를 빠르게 훑으면서 조사하므로, 코드를 잘못 읽거나 존재하지 않는 버그를 보고하거나 수치를 과장할 수 있다. 종합 개선안 조사에서 4개 Explore 에이전트의 초안에 **10건의 오류**가 있었고, strict-reviewer가 코드를 직접 대조하여 전부 잡아냈다.

**실행 방법**:
```
# 1단계: N개 Explore 에이전트 병렬 조사 (동시 실행)
Explore speed-analyzer ──┐
Explore efficiency-analyzer ──┼── 동시 → 메인이 종합 초안 작성
Explore accuracy-analyzer ──┤
Explore architecture-analyzer ──┘

# 2단계: strict-reviewer가 초안 검증 (순차)
Explore strict-reviewer → 초안의 모든 주장을 코드와 대조 → 오류 목록 반환

# 3단계: 메인이 오류 반영하여 최종 문서 확정
```

**reviewer 프롬프트에 포함할 지시**:
- 문서의 모든 코드 참조(파일:줄)를 실제 코드와 대조
- 수치(%, 건수, 비용)의 근거를 검증
- 제안된 수정 코드가 실제로 동작하는지 확인
- 존재하지 않는 버그를 보고한 경우 삭제 표시

### 언제 사용하는가
- 코드베이스의 여러 영역을 동시에 조사해야 할 때
- 단순 Grep/Glob으로 3회 이상 탐색이 필요한 깊은 조사
- 버그 분석, 아키텍처 리뷰, 리팩토링 사전 조사

### 의존성에 따른 실행 흐름

에이전트 간 결과 의존이 없으면 동시, 있으면 순차:

```
# 케이스 1: 독립 조사 → 동시 실행 + 메인 수정
Explore A ──┐
Explore B ──┼── 동시 → 메인 종합 → 메인이 직접 코드 수정
Explore C ──┘

# 케이스 2: 조사 → 수정까지 에이전트에게 위임
Explore A + B (동시)
      │ 결과
      ▼
general-purpose C (결과 기반 수정) ── 순차, worktree 격리 권장

# 케이스 3: 독립적인 수정 작업 → 각자 worktree에서 동시
general-purpose A (worktree) ──┐
general-purpose B (worktree) ──┼── 동시, 각자 격리된 브랜치
general-purpose C (worktree) ──┘
```

### 언제 사용하지 않는가
- 특정 파일 1~2개만 읽으면 되는 단순 작업 → 직접 Read/Grep
- 에이전트 간 결과가 서로 의존하는 경우 → 순차 실행

---

## 에이전트 작업 관찰: LiveTerminalPanel

에이전트가 실행 중일 때 무엇을 하고 있는지 실시간으로 관찰할 수 있는 UI 컴포넌트.

### 구현 위치
- **프론트엔드**: `src/frontend/src/components/task-detail/LiveTerminalPanel.tsx`
- **백엔드**: `src/frontend/server.ts` — WebSocket 서버 (`wssTaskTerminal`)
- **데이터 소스**: `.orchestration/output/*-conversation.jsonl`

### 동작 원리

```
JSONL 파일 (워커가 기록)
    │ fs.watchFile (서버가 감시)
    ▼
server.ts wssTaskTerminal
    │ WebSocket push
    ▼
LiveTerminalPanel (브라우저)
    │ parseJSONLLine → TerminalEntry
    ▼
터미널 스타일 UI 렌더링
```

1. 워커(`job-task.sh`)가 Claude CLI 대화 내용을 JSONL 파일로 기록
2. `server.ts`가 `fs.watchFile`로 해당 파일을 감시
3. 새 줄이 추가되면 WebSocket(`/ws/task-terminal/{taskId}`)으로 push
4. `LiveTerminalPanel`이 JSONL을 파싱하여 tool_use, thinking, text, system 타입으로 분류
5. 터미널 스타일 UI(검은 배경, 모노스페이스 폰트, 줄 번호)로 실시간 렌더링

### 표시하는 정보

| 타입 | 표시 내용 | 스타일 |
|------|----------|--------|
| `tool_use` | 도구 이름 + 요약 (파일 경로, 명령어, 패턴 등) | 시안 하이라이트 + 아이콘 |
| `thinking` | Claude의 사고 과정 (150자 제한) | 보라색 이탤릭 |
| `text` | Claude의 텍스트 출력 (200자 제한) | 기본 텍스트 |
| `system` | 시작/완료 등 시스템 이벤트 | 회색 |

### 연결 전략

- **정상**: WebSocket 연결로 실시간 스트리밍
- **WebSocket 실패 시**: `/api/tasks/{taskId}/conversation` REST API로 fallback (완료된 대화 일괄 로드)
- **파일 미존재 시**: "터미널 로그 대기 중..." 스피너 표시 (파일 생성까지 대기)

### Agent Team 패턴과의 관계

오케스트레이션 시스템에서 워커 에이전트가 태스크를 수행할 때, LiveTerminalPanel을 통해 에이전트가 어떤 파일을 읽고, 어떤 도구를 쓰고, 무엇을 생각하는지를 실시간으로 관찰할 수 있다. 이는 개선안(improvement-plan.md)의 Phase 4-18 "실시간 대시보드" 항목을 완료한 구현이다.
