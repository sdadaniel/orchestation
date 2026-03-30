# orchestrate.sh vs Claude Agent Team — 비교 분석

## 1. 개요

| 항목 | orchestrate.sh (현 프로젝트) | Claude Agent Team |
|------|---------------------------|-------------------|
| **성격** | 외부 셸 스크립트 오케스트레이터 | Claude Code 내장 기능 (experimental) |
| **실행 단위** | `job-task.sh` (single-shot Claude CLI 호출) | Teammate (별도 Claude Code 프로세스) |
| **상태 저장** | `.orchestration/tasks/*.md` (YAML frontmatter) | `~/.claude/tasks/{team}/` (내부 관리) |
| **통신** | 시그널 파일 (atomic mv) | 메일박스 시스템 (SendMessage/broadcast) |
| **격리** | git worktree (조건부 생성) | git worktree (옵션) |

---

## 2. 유사점

### 2.1 태스크 기반 병렬 실행
- **둘 다** 작업을 태스크 단위로 분리하고 병렬 실행
- **둘 다** 태스크 간 의존성(depends_on)을 인식하고 순서 강제

### 2.2 Worktree 격리
- **둘 다** git worktree를 사용하여 병렬 작업의 파일 충돌 방지
- **둘 다** 작업 완료 후 worktree 자동 정리

### 2.3 리드(Lead) — 워커(Worker) 구조
- **orchestrate.sh**: 셸 스크립트가 리드, job-task.sh가 워커
- **Agent Team**: Lead 세션이 리드, Teammate가 워커
- 둘 다 리드가 태스크 할당/결과 종합, 워커가 실행 담당

### 2.4 동시 실행 제한
- **orchestrate.sh**: `maxParallel.task=2`, 메모리 가드, `MAX_CLAUDE_PROCS=4`
- **Agent Team**: 권장 3~5 teammates, 비용 선형 증가 고려

### 2.5 태스크 상태 관리
- **둘 다** pending → in_progress → completed/done 상태 전이
- **둘 다** 실패 시 재시도 메커니즘 보유

---

## 3. 차이점

### 3.1 아키텍처 근본 차이

| | orchestrate.sh | Agent Team |
|---|---|---|
| **런타임** | bash 프로세스 + Claude CLI 호출 | Claude Code 프로세스 내부 |
| **오케스트레이터** | 외부 셸 스크립트 (Claude 밖) | Claude 자체 (Lead가 Claude) |
| **제어 흐름** | 스크립트 로직 (if/while/case) | LLM 판단 (자연어 기반) |

orchestrate.sh는 **결정론적**: 태스크 선택, 우선순위, 재시도 로직이 모두 셸 코드로 명시됨.
Agent Team은 **확률적**: Lead Claude가 자연어 지시를 해석하여 판단.

### 3.2 태스크 정의 수준

| | orchestrate.sh | Agent Team |
|---|---|---|
| **태스크 파일** | YAML frontmatter + 마크다운 (scope, context, depends_on, priority, role 등 풍부) | 내부 JSON (title, status, dependencies) |
| **Scope 명시** | 수정 대상 파일 목록 명시 → 충돌 탐지 가능 | 없음 — Lead가 구두로 "이 파일은 네가" 지정 |
| **충돌 방지** | `scope_not_conflicting()` 함수로 자동 검사 | Best practice로 권고 (강제 아님) |

### 3.3 리뷰 파이프라인

| | orchestrate.sh | Agent Team |
|---|---|---|
| **리뷰** | 별도 `job-review.sh` (haiku 모델, diff 기반, 자동) | Plan approval gate (선택적, Lead가 수동) |
| **재시도** | review-rejected → 피드백 포함 재시도 (max 2회, 자동 rebase) | Lead가 판단하여 수동 재지시 |
| **품질 게이트** | 자동화된 파이프라인 | 사람(사용자) 또는 Lead의 판단 |

이것이 가장 큰 차이. orchestrate.sh는 **CI/CD 파이프라인**에 가깝고, Agent Team은 **협업 세션**에 가깝다.

### 3.4 에이전트 간 통신

| | orchestrate.sh | Agent Team |
|---|---|---|
| **방식** | 시그널 파일 (one-way: worker → orchestrator) | 양방향 메시지 (SendMessage, broadcast) |
| **워커 간 통신** | 불가 — 반드시 오케스트레이터 경유 | 가능 — teammate 간 직접 대화 |
| **실시간성** | fswatch/polling (1초 간격) | 즉시 전달 (async) |

### 3.5 실시간 관찰 (Observability)

| | orchestrate.sh | Agent Team |
|---|---|---|
| **작업 중 확인** | 로그 파일 tail (`output/logs/`) — 간접적, 사후 확인 | **split-pane에서 해당 agent 터미널에 직접 진입**하여 실시간 확인 |
| **개입** | `stopped` 시그널로 중단만 가능 | 터미널에 타이핑하여 즉시 방향 전환/질문 가능 |
| **진행 상황** | 시그널 도착 여부로만 판단 (완료/실패) | Shift+Down으로 각 teammate 순회하며 현재 상태 확인 |

Agent Team의 가장 인상적인 차이. 워커가 지금 무엇을 하고 있는지 실시간으로 볼 수 있고, 잘못된 방향으로 가면 즉시 개입 가능. orchestrate.sh는 태스크가 시작되면 완료/실패 시그널이 올 때까지 **블랙박스**.

### 3.6 컨텍스트 관리

| | orchestrate.sh | Agent Team |
|---|---|---|
| **프롬프트** | `context-builder.sh`로 레이어별 임베딩 (≤300줄 full, >800줄 시그니처만) | 자동 (CLAUDE.md + MCP 로드) |
| **비용 제어** | 컨텍스트 크기 제한 (2000줄 cap) | 없음 (각 teammate가 필요한 만큼 읽음) |
| **역할 분리** | `role` 필드로 프롬프트 템플릿 변경 | 자연어로 역할 지시 |

### 3.6 복구 및 안정성

| | orchestrate.sh | Agent Team |
|---|---|---|
| **좀비 감지** | PID liveness 체크, health sweep | 없음 (idle 알림 의존) |
| **메모리 관리** | `memory_pressure` 체크, dispatch 게이트 | 없음 |
| **lock** | mkdir 기반 atomic lock | 파일 lock (task claiming) |
| **세션 복구** | 재시작 시 이전 시그널 처리 가능 | `/resume`으로 복구 불가 (teammate 유실) |

### 3.8 속도와 태스크 Granularity

| | orchestrate.sh | Agent Team |
|---|---|---|
| **dispatch 오버헤드** | 셸 루프 polling → 의존성/충돌 체크 → context-builder 프롬프트 조립 → 프로세스 spawn → 시그널 파일 I/O | Claude 판단 → 하네스가 즉시 API 세션 생성. 오버헤드 거의 0 |
| **태스크 크기** | 작게 쪼갬 (scope 명시, 파일 단위) | 크게 던짐 ("이 모듈 리팩토링해") |
| **분해 주체** | 사람이 미리 태스크 정의 | Claude가 자율적으로 분해 |
| **병렬 결정** | 스크립트 로직 (의존성/충돌 체크 후 dispatch) | Claude가 즉석 판단 ("4명 띄워야겠다") |
| **리뷰 사이클** | task 완료 → review dispatch → 또 claude spawn → 피드백 → retry | 없음 (Lead가 직접 확인하거나 생략) |

Agent Team이 체감상 **훨씬 빠른** 이유:
1. 셸 스크립트 오버헤드, 파일 I/O, polling 지연, 프로세스 spawn 시간이 전부 없음
2. 큰 덩어리를 던지면 Claude가 알아서 subagent 4개를 자율적으로 띄워서 병렬 처리
3. 리뷰 파이프라인이 없어서 왕복 사이클이 적음

단, 이것은 **트레이드오프**:

| | 빠름 (Agent Team) | 느림 (orchestrate.sh) |
|---|---|---|
| **품질 보장** | Claude 판단에 의존 | 리뷰 파이프라인으로 강제 |
| **비용 예측** | 불가 (Claude가 알아서 subagent 띄움) | 가능 (token-usage.log) |
| **재현성** | 같은 요청해도 다르게 분해할 수 있음 | 같은 태스크 = 같은 실행 |
| **무인 운영** | Lead 세션 필요 | 셸 스크립트만으로 동작 |

### 3.9 야간/자율 작업

| | orchestrate.sh | Agent Team |
|---|---|---|
| **자율 모드** | `night-worker.sh` (시간/예산/태스크 제한 내 자동 스캔 → 태스크 생성) | 없음 — Lead가 명시적으로 지시해야 함 |
| **비용 제한** | `budget` 필드, `maxTasks` 제한 | 팀 규모로만 간접 제어 |

---

## 4. 각 시스템의 강점

### orchestrate.sh의 강점
1. **결정론적 제어** — 우선순위, 의존성, 충돌 탐지가 코드로 보장됨
2. **자동 리뷰 파이프라인** — task → review → retry가 사람 개입 없이 동작
3. **리소스 관리** — 메모리 압력, 프로세스 수, 비용을 능동적으로 모니터링
4. **야간 자율 작업** — 사람이 없어도 코드 스캔 + 태스크 생성 가능
5. **scope 기반 충돌 방지** — 파일 단위로 병렬 실행 안전성 보장
6. **컨텍스트 비용 최적화** — 레이어별 임베딩으로 토큰 절약

### Agent Team의 강점
1. **실시간 관찰** — 작업 중인 agent 터미널에 직접 들어가서 지금 뭘 하고 있는지 실시간 확인 가능. 블랙박스가 아님
2. **양방향 통신** — teammate 간 토론, 가설 검증, 피드백 교환 가능
3. **유연한 조정** — Lead가 실시간으로 방향 전환, 재지시 가능
4. **설정 불필요** — 셸 스크립트, 시그널, 파서 없이 자연어로 팀 구성
5. **인터랙티브** — split-pane에서 직접 teammate에게 타이핑 가능
6. **경량 시작** — "5명 팀 만들어줘" 한 마디로 즉시 시작
7. **비정형 작업** — 조사, 토론, 경쟁 가설 같은 구조화 어려운 작업에 적합

---

## 5. 개선 방향 제안

### 5.1 Agent Team에서 가져올 수 있는 것

#### (A) 워커 간 통신 채널 추가
**현재**: 워커는 오케스트레이터에게만 시그널을 보냄. 워커 A의 결과가 워커 B에 필요하면 오케스트레이터가 중개해야 하는데, 현재는 그 메커니즘이 없음.

**제안**: 태스크 간 메시지 파일 도입
```
.orchestration/signals/TASK-100-message-to-TASK-101.md
```
`depends_on`과 다른 차원 — 의존이 아닌 **정보 전달**. 예: "내가 이 인터페이스를 이렇게 바꿨으니 참고해"

**우선순위**: 낮음 — 현재 scope 분리가 잘 되어 있어 필요성 적음

#### (B) 실시간 방향 전환 (Steering)
**현재**: 태스크가 시작되면 끝날 때까지 개입 불가. `stopped` 시그널로 중단만 가능.

**제안**: `TASK-XXX-redirect` 시그널 + job-task.sh에 시그널 폴링 추가
```bash
# job-task.sh 내부에서 주기적으로:
if [ -f "$SIGNAL_DIR/${TASK_ID}-redirect" ]; then
  NEW_INSTRUCTION=$(cat "$SIGNAL_DIR/${TASK_ID}-redirect")
  # Claude에 추가 지시 전달
fi
```

**우선순위**: 중간 — 10분 타임아웃이 있어 급하지 않지만, 비용 절약에 도움

#### (C) 워커 실시간 관찰 (Live Observability)
**현재**: 워커가 시작되면 완료/실패 시그널이 올 때까지 **블랙박스**. 로그 파일을 `tail -f`로 볼 수는 있지만, Claude의 사고 과정이나 현재 어떤 파일을 수정 중인지 실시간으로 알 수 없음.

**Agent Team에서 인상적인 점**: split-pane에서 작업 중인 agent 터미널에 직접 들어가서, 지금 무슨 파일을 읽고 있고 어떤 판단을 하고 있는지 실시간으로 볼 수 있음. 잘못 가고 있으면 즉시 타이핑으로 개입 가능.

**제안**: iTerm 모드에서 각 워커 탭의 실시간 상태를 대시보드로 제공
```
┌─ orchestrate.sh 대시보드 ──────────────────────────┐
│                                                    │
│  TASK-300 [in_progress] 03:42 elapsed              │
│  ├─ 현재: src/api/routes.ts 수정 중                 │
│  ├─ 읽은 파일: 4/6 (scope 기준)                     │
│  └─ 마지막 활동: Edit src/api/routes.ts:142         │
│                                                    │
│  TASK-301 [in_progress] 01:15 elapsed              │
│  ├─ 현재: 테스트 실행 중                             │
│  └─ 마지막 활동: Bash npm test                      │
│                                                    │
│  [Tab 클릭으로 해당 워커 터미널 직접 진입]             │
└────────────────────────────────────────────────────┘
```

구현 방안:
1. `job-task.sh`가 Claude의 `--output-format stream-json`을 이미 사용 중 → JSONL 스트림을 실시간 파싱
2. 파싱된 현재 활동(tool call name, 파일 경로)을 상태 파일에 기록: `.orchestration/signals/TASK-XXX-activity.json`
3. orchestrate.sh 또는 별도 `dashboard.sh`가 상태 파일을 읽어 요약 표시
4. iTerm 모드에서 `Cmd+숫자`로 해당 워커 탭에 직접 진입 가능 (이미 지원)

**우선순위**: 높음 — 현 시스템의 가장 큰 약점(블랙박스)을 직접 해소. 잘못된 방향의 태스크를 조기에 발견하여 비용/시간 절약

#### (D) 속도 개선 — 큰 태스크 + 워커 자율 분해 허용
**현재**: 태스크를 사람이 미리 잘게 쪼개고, 스크립트가 하나씩 dispatch. 태스크 간 오버헤드(polling, 시그널 I/O, 프로세스 spawn, 리뷰 왕복)가 누적되어 체감 속도가 느림.

**Agent Team이 빠른 이유**: 큰 덩어리를 던지면 Claude가 자율적으로 "4명 subagent 띄워야겠다" 판단 → 하네스가 즉시 병렬 생성. 오버헤드 거의 0.

**제안**: 두 가지 태스크 모드를 지원
```yaml
# 기존: 작은 태스크 (현재와 동일)
granularity: fine
scope:
  - src/api/routes.ts
  - src/api/middleware.ts

# 신규: 큰 태스크 (워커가 자율 분해)
granularity: coarse
scope:
  - src/api/**
goal: "API 모듈 전체를 REST → tRPC로 마이그레이션"
# 워커가 내부적으로 subagent를 자율적으로 띄워서 병렬 처리
# orchestrate.sh는 이 태스크에 단일 슬롯만 할당하되, 타임아웃을 늘림
```

워커 프롬프트에 다음 안내 추가:
> "scope가 넓고 granularity: coarse인 태스크는, 먼저 Explore 에이전트를 병렬로 띄워 전체 구조를 파악한 뒤, 필요하면 general-purpose 에이전트를 worktree 격리로 띄워 영역별 병렬 수정하라."

**부가 개선**:
- 단순 태스크에 `skip_review: true` 옵션 → 리뷰 왕복 사이클 제거로 속도 향상
- dispatch 간격(현재 5초 stagger) → 태스크 크기에 따라 동적 조절

**우선순위**: 높음 — 체감 속도 직접 개선. 안전장치(orchestrate.sh 스케줄링, 리소스 관리)를 유지하면서 Agent Team의 속도를 가져오는 핵심 전략

#### (E) 태스크 난이도 기반 자동 팀 구성
**현재**: `MAX_PARALLEL_TASK=2`로 고정. 태스크 복잡도에 무관하게 동일 리소스 배분.

**제안**: `model-selector.sh`의 복잡도 분류를 확장하여, 고난이도 태스크에 더 큰 모델/더 넓은 scope, 저난이도에 haiku 배정
```yaml
# task frontmatter에 추가
complexity: high  # → opus, 단독 실행
complexity: low   # → haiku, 4병렬 가능
```

**우선순위**: 높음 — 비용 대비 효율 직접 개선

### 5.2 현 시스템이 이미 우월한 것 (유지/강화)

#### (F) 자동 리뷰 파이프라인 — 유지
Agent Team에는 없는 핵심 차별점. task → review → feedback → retry 자동 루프는 **사람 없이 품질 유지**의 핵심.

**강화 제안**: 리뷰 결과를 구조화된 JSON으로 출력하여, 반복되는 리뷰 피드백 패턴 감지
```json
{"category": "type-safety", "severity": "high", "file": "parser.ts", "line": 42}
```

#### (G) Scope 기반 충돌 탐지 — 유지
Agent Team은 "각 teammate에게 다른 파일 할당"을 best practice로만 권고. 현 시스템은 코드로 강제.

#### (H) 리소스 관리 — 유지
메모리 가드, 프로세스 수 제한, 비용 추적은 Agent Team에 없는 기능. 무인 운영에 필수.

### 5.3 하이브리드 접근 — 최적의 조합

```
┌─────────────────────────────────────────────────┐
│              orchestrate.sh (유지)               │
│  결정론적 스케줄링, 리소스 관리, 리뷰 파이프라인  │
│                                                 │
│  ┌─────────────────────────────────────────────┐│
│  │  job-task.sh 내부에서 Agent Team 패턴 활용   ││
│  │                                             ││
│  │  복잡한 태스크 → Claude가 내부적으로          ││
│  │  Explore 서브에이전트 3개 병렬 조사           ││
│  │  → 메인이 종합 → 코드 수정                   ││
│  │                                             ││
│  │  단순 태스크 → Claude가 직접 수정             ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**현 시스템의 스케줄링/리소스 관리**는 그대로 유지하되,
**각 워커(job-task.sh) 내부**에서 Agent Team의 병렬 조사 패턴을 활용.

이미 `agent-team-pattern.md`에서 이 접근을 사용 중 (좀비 태스크 분석 사례).
이를 **worker 프롬프트 템플릿에 명시적으로 안내**하면 워커가 복잡한 태스크에서 자율적으로 서브에이전트를 활용할 수 있음.

---

## 6. 우선순위 요약

| 순위 | 개선 항목 | 효과 | 난이도 |
|------|----------|------|--------|
| 1 | **큰 태스크 + 워커 자율 분해 허용 (5.1-D)** | 체감 속도 대폭 개선, Agent Team의 속도를 안전장치 유지하며 확보 | 중 |
| 2 | **워커 실시간 관찰 대시보드 (5.1-C)** | 블랙박스 해소, 잘못된 방향 조기 발견 → 비용/시간 절약 | 중 |
| 3 | 복잡도 기반 모델/병렬 자동 조절 (5.1-E) | 비용 30~50% 절감 가능 | 중 |
| 4 | 리뷰 피드백 구조화 (5.2-F 강화) | 반복 실패 패턴 감지 → 태스크 품질 향상 | 중 |
| 5 | 워커 내부 서브에이전트 활용 안내 (5.3) | 복잡 태스크 성공률 향상 | 낮 |
| 6 | 실시간 방향 전환 (5.1-B) | 비용 절약, 실패 감소 | 높 |
| 7 | 워커 간 메시지 채널 (5.1-A) | 인터페이스 변경 시 연계 | 낮 |
