# Orchestrator 아키텍처 옵션

> 2026-03-31 논의 + 전문가 리뷰 반영. 아직 결정 전.

## 배경

현재 구조는 `cli.js (Node) → orchestrate.sh (bash) → nohup bash job-*.sh &`로 이어지는 3단 bash 체인이다. 이를 라이브러리로 배포하려면 아키텍처를 재검토할 필요가 있다.

---

## 현재 구조

```
cli.js (Node)
  └─ spawn("bash", ["orchestrate.sh"])
        │
        orchestrate.sh (bash) ── 메인 루프
        │  ├─ 시그널 감시 (5초 폴링)
        │  ├─ 슬롯 관리
        │  ├─ 상태 전이 (pending → in_progress → reviewing → done)
        │  ├─ retry 카운트
        │  └─ config 핫 리로드
        │
        ├── nohup bash job-task.sh TASK-001 &    ← 별도 프로세스
        │     └─ claude --output-format stream-json ...
        │
        ├── nohup bash job-task.sh TASK-002 &
        │     └─ claude ...
        │
        └── nohup bash job-review.sh TASK-001 &
              └─ claude ...

PID 추적: /tmp/worker-TASK-XXX.pid (파일 기반)
로그: output/logs/TASK-XXX.log (nohup 리다이렉트)
```

### 현재 구조의 문제

- PID 파일 기반 추적: 좀비 PID, 경쟁 조건 가능 (dispatch 직후 프로세스 사망 시 이중 실패 처리)
- bash 호환성: macOS bash 3.x 제약 (declare -A, mapfile 사용 불가)
- nohup 프로세스: 종료 제어가 시그널 파일에 의존
- 라이브러리 배포 시 bash 의존이 무거움
- `get_task_ids()` 매 루프마다 모든 태스크 파일을 awk로 파싱 (50개 태스크 시 ~500ms-1s/루프)
- `memory_pressure` 시스템 콜이 dispatch 핫 패스에서 100-500ms 소요

### 발견된 버그 (아키텍처 선택과 무관, 수정 필요)

| 버그 | 심각도 | 내용 |
|------|--------|------|
| PIPESTATUS 오귀속 | **높음** | job-task.sh에서 `PIPESTATUS[0]`이 claude가 아닌 tee의 exit code를 캡처. claude 실패 감지 불가 |
| scope 검증 불완전 | 중간 | `HEAD~1`만 검사 → 멀티 커밋 시 이전 커밋의 scope 위반이 통과 |
| iTerm PID 미생성 | **높음** | iTerm 모드에서 PID 파일 미생성 → health check가 워커를 즉시 kill |
| git merge 경쟁 | 중간 | 동시 완료 시 `_merge_and_done`에 locking 없음 → 머지 충돌 가능 |

---

## 옵션 비교

### 옵션 A: Worker만 spawn (하이브리드)

```
cli.js (Node)
  └─ spawn("bash", ["orchestrate.sh"])
        │
        orchestrate.sh (bash) ── 메인 루프 (그대로)
        │
        ├── node cli.js run-worker TASK-001 &
        │     └─ spawn("bash", ["job-task.sh"])
        │          └─ claude ...
        │
        └── node cli.js run-review TASK-001 &
              └─ spawn("bash", ["job-review.sh"])
                   └─ claude ...
```

- **판정: 탈락** — bash → Node → bash 샌드위치가 되어 오히려 복잡해짐
- Node 워커 추가로 프로세스당 ~40MB + 300ms 시작 지연 추가, 이점 없음

### 옵션 B: 오케스트레이션 루프를 Node로 이전

```
cli.js (Node) ── 메인 루프
  ├─ 시그널 감시      (fs.watch — 이벤트 드리븐, 폴링 제거)
  ├─ 슬롯 관리        (Map<taskId, ChildProcess>)
  ├─ 상태 전이        (frontmatter 1회 파싱 후 메모리 캐시)
  ├─ config 핫 리로드  (JSON.parse)
  │
  ├── spawn("bash", ["job-task.sh", "TASK-001"])
  │     stdout pipe → 실시간 로그
  │     on("close") → 시그널 처리
  │
  ├── spawn("bash", ["job-task.sh", "TASK-002"])
  │
  └── spawn("bash", ["job-review.sh", "TASK-001"])

PID 추적: 메모리 (Map)
종료: process.kill(-pid) (프로세스 그룹)
```

| 장점 | 단점 |
|------|------|
| PID 메모리 관리, 파일 추적 제거 | 메인 루프 포팅 필요 (중간 규모) |
| fs.watch 이벤트 드리븐 → dispatch 지연 1초 미만 | worker는 여전히 bash |
| frontmatter 1회 파싱 + 메모리 캐시 → get_task_ids 병목 제거 | |
| process.kill으로 직접 종료 제어 | |

**주의**: stdout pipe 사용 시 backpressure 관리 필요 (64KB 버퍼 초과 시 워커 블로킹). `process.kill(pid)`는 bash만 종료되고 claude 자식은 살아남을 수 있으므로 프로세스 그룹 kill(`-pid`) 필요.

### 옵션 C: 전부 Node로 포팅

```
cli.js (Node) ── 메인 루프
  │
  ├── worker-task.js (Node)
  │     └─ spawn("claude", [...args])
  │
  ├── worker-task.js (Node)
  │     └─ spawn("claude", [...args])
  │
  └── worker-review.js (Node)
        └─ spawn("claude", [...args])

bash 의존: claude CLI 호출 1곳만
```

| 장점 | 단점 |
|------|------|
| bash 의존 최소화 | 포팅 비용 큼 |
| 라이브러리 배포에 가장 유리 | 템플릿 렌더링, frontmatter 파싱 등 전부 재구현 (파싱 버그 위험) |
| 크로스 플랫폼 (Windows 포함) | bash(2MB, 5ms) → Node(40MB, 300ms)로 교체는 순수 낭비 |

### 옵션 D: Claude CLI가 오케스트레이터

```
claude (CLI) ── 오케스트레이터 역할
  │  시스템 프롬프트: 오케스트레이션 규칙
  │  판단: 어떤 태스크를 언제 실행할지 AI가 결정
  │
  ├── claude (subprocess) ── worker-task
  │
  ├── claude (subprocess) ── worker-task
  │
  └── claude (subprocess) ── worker-review
```

| 장점 | 단점 |
|------|------|
| bash 로직 대부분 제거 (프롬프트로 대체) | 오케스트레이터가 상시 claude 세션 유지 → 토큰 비용 |
| 예외 상황을 AI 판단으로 처리 | 5초 폴링 같은 단순 반복에 AI를 쓰는 건 낭비 |
| 라이브러리 배포 시 bash 호환성 걱정 없음 | **현재 Claude CLI subagent는 순차 실행** → 병렬 4슬롯이 1슬롯으로 퇴보 |
| | 오케스트레이터 컨텍스트가 시간이 지나며 소진 → 장시간 운영 불가 |
| | 오케스트레이터 자체가 ~750MB → bash(2MB)에서 748MB 증가 |

**subagent 컨텍스트 모델:**
- subagent는 각자 독립된 컨텍스트를 가짐 (부모 대화 히스토리 공유 안 됨)
- 부모가 spawn 시 프롬프트로 전달한 내용만 받음 → 큰 태스크도 컨텍스트 풀 사용 가능
- 단, subagent 결과가 부모 컨텍스트에 누적됨 → 태스크 수 증가 시 부모 컨텍스트 소진
- CLAUDE.md 및 도구 권한은 부모에서 상속됨

### 옵션 D': Claude CLI + 경량 루프 (D의 절충안)

```
경량 루프 (bash 또는 Node) ── 폴링/dispatch만
  │  시그널 감시, 슬롯 카운트 (기계적 작업)
  │
  ├── claude "TASK-001 실행해" (subprocess)
  │     └─ worker-task 프롬프트
  │
  ├── claude "TASK-002 실행해" (subprocess)
  │
  └── 예외 발생 시 → claude "이 상황 판단해" (1회 호출)
        └─ retry? skip? fail? → AI가 결정
```

| 장점 | 단점 |
|------|------|
| 기계적 작업은 코드, 판단은 AI | 경계가 모호해질 수 있음 (어디까지가 "판단"인지) |
| 토큰 비용 절약 (판단 시점에만 호출) | 루프 자체는 여전히 bash/Node 의존 |
| 현재 구조에서 점진적 마이그레이션 가능 | 판단 호출 중 상태 변경 시 판단이 stale할 수 있음 (5-30초 지연) |

**참고**: 경량 루프를 Node로 구현하면 사실상 Option B와 동일. bash로 구현하면 현재와 동일.

---

## 메모리 분석 (태스크 3개 동시 실행 기준)

> **중요**: 실측 결과 claude CLI는 프로세스당 **~750MB RSS** (장시간 세션은 1GB+). 이전 추정치 ~80MB는 10배 과소평가였음.

### 실측 기반 프로세스별 메모리

| 프로세스 | 메모리 (실측) | 비고 |
|----------|-------------|------|
| bash | ~2MB | 경량 |
| node | ~40MB | V8 힙 포함 |
| claude CLI | **~750MB** | 세션 길어지면 1GB+ 성장 |

### 옵션별 프로세스 구성 (실측 기반)

```
현재 구조
──────────────────────────────────────
프로세스(ps)                     메모리
node cli.js                      ~40MB
  bash orchestrate.sh             ~2MB
    bash job-task.sh (TASK-001)    ~2MB
      claude                      ~750MB
    bash job-task.sh (TASK-002)    ~2MB
      claude                      ~750MB
    bash job-review.sh (TASK-001)  ~2MB
      claude                      ~750MB
    (+watchdog, tee 등 보조 ps)    ~3MB x3
──────────────────────────────────────
프로세스 ~12개              합계 ~2.3GB
```

```
옵션 B: 루프를 Node로
──────────────────────────────────────
node cli.js (메인 루프 포함)      ~50MB
  bash job-task.sh (TASK-001)      ~2MB
    claude                        ~750MB
  bash job-task.sh (TASK-002)      ~2MB
    claude                        ~750MB
  bash job-review.sh (TASK-001)    ~2MB
    claude                        ~750MB
  (+watchdog, tee 등 보조 ps)      ~3MB x3
──────────────────────────────────────
프로세스 ~12개              합계 ~2.3GB
→ 현재와 동일. 래퍼 차이는 노이즈.
```

```
옵션 C: 전부 Node
──────────────────────────────────────
node cli.js (메인 루프)           ~50MB
  node worker-task.js (TASK-001)  ~40MB
    claude                        ~750MB
  node worker-task.js (TASK-002)  ~40MB
    claude                        ~750MB
  node worker-review.js           ~40MB
    claude                        ~750MB
──────────────────────────────────────
프로세스 ~10개              합계 ~2.4GB
→ +100MB. 의미 없는 증가.
```

```
옵션 D: Claude 오케스트레이터 (subagent가 별도 프로세스)
──────────────────────────────────────
claude (오케스트레이터)           ~750MB  ← bash 2MB → 750MB로 증가
  claude (TASK-001 subagent)      ~750MB
  claude (TASK-002 subagent)      ~750MB
  claude (TASK-001 review)        ~750MB
──────────────────────────────────────
프로세스 4개                합계 ~3.0GB
→ 오히려 최악. 오케스트레이터 자체가 750MB.
```

```
옵션 D: Claude 오케스트레이터 (내부 subagent 가정)
──────────────────────────────────────
claude (오케스트레이터)           ~750MB
  ├─ subagent 컨텍스트 x3        ~300MB x3
  └─                              (API 세션, 도구 상태 등)
──────────────────────────────────────
프로세스 1개                합계 ~1.65GB (낙관적)
→ 현재(2.3GB)보다 낫지만 "80-150MB" 주장은 완전히 틀림.
  또한 subagent 순차 실행이므로 처리량이 1/4로 감소.
```

```
옵션 D': Claude + 경량 루프
──────────────────────────────────────
bash loop.sh (or node)            ~2-50MB
  claude (TASK-001)               ~750MB
  claude (TASK-002)               ~750MB
  claude (TASK-001 review)        ~750MB
──────────────────────────────────────
프로세스 4개                합계 ~2.3GB
→ 현재에서 bash 중간 레이어 제거. 메모리 동일.
```

### 핵심 인사이트

**아키텍처 선택은 메모리에 거의 영향을 주지 않는다.** 메모리의 97%는 claude CLI 프로세스가 차지하며, 래퍼(bash/Node)의 차이는 노이즈 수준이다.

**메모리에 가장 큰 영향을 주는 설정은 `MAX_CLAUDE_PROCS`:**
- MAX_CLAUDE_PROCS=4 → ~3.0GB (claude만)
- MAX_CLAUDE_PROCS=2 → ~1.5GB (claude만)
- 2로 줄이면 1.5GB 절약 — 어떤 아키텍처 변경보다 큰 효과

---

## 성능 분석

### Dispatch 지연 (태스크 준비 → 실행 시작)

| 옵션 | 지연 | 원인 |
|------|------|------|
| 현재 | 3-16초 | fswatch 폴링 0-10s + awk 파싱 + claude 콜드 스타트 2-5s |
| **B. 루프 Node** | **2.5-6초** | **fs.watch 즉시 + 메모리 캐시 + claude 콜드 스타트 2-5s** |
| C. 전부 Node | 3-6초 | B와 유사 + Node 워커 시작 300ms 추가 |
| D. Claude 오케스트레이터 | <1초 (내부 subagent) | 콜드 스타트 없음. 단, 순차 실행 |
| D'. 경량 루프 | 현재 또는 B와 동일 | 루프 구현에 의존 |

### 처리량 (Throughput)

현재 기준: MAX_PARALLEL_TASK=2, 평균 태스크 5분, 리뷰 2분 → 시간당 ~34개

| 옵션 | 슬롯 활용률 | 처리량 영향 |
|------|------------|-----------|
| 현재 | ~90% (dispatch 갭 때문) | 기준선 |
| **B. 루프 Node** | **~99%** | **+5-10%** |
| D. Claude (순차 실행) | **25%** (1슬롯만 사용) | **-75% (치명적)** |

### 스케일링 병목 (50개 태스크 시)

- `get_task_ids()`: N개 파일 × awk → Option B에서 메모리 캐시로 해결
- `scope_not_conflicting()`: O(running × scope²) 문자열 비교 → 어떤 옵션이든 동일
- `memory_pressure` 시스템 콜: macOS에서 100-500ms → 호출 빈도 줄여야
- **git 직렬화**: 동시 머지는 git 글로벌 락에 걸림 → 아키텍처와 무관한 근본 제약

---

## 요약 매트릭스

| 옵션 | 변경 범위 | bash 의존 | 토큰 비용 | 메모리 | 성능 | 정확성 | 종합 |
|------|----------|----------|----------|--------|------|--------|------|
| A. worker만 spawn | 작음 | 높음 | 없음 | ~2.3GB | 현재와 동일 | 현재와 동일 | 탈락 |
| **B. 루프를 Node로** | **중간** | **중간** | **없음** | **~2.3GB** | **최선 (+5-10%)** | **PID/이벤트 개선** | **추천** |
| C. 전부 Node | 큼 | 최소 | 없음 | ~2.4GB | 워커 시작 지연 | B와 동일 | 비추 |
| D. Claude 오케스트레이터 | 큼 | 없음 | 높음 (상시) | ~3.0GB (최악) | 순차 실행 (치명) | 컨텍스트 소진 위험 | 비추 |
| D'. Claude + 경량 루프 | 중간 | 낮음 | 낮음 (판단 시만) | ~2.3GB | 루프 구현에 의존 | 판단 stale 위험 | 보통 |

---

## 미결정 사항

- [ ] 어떤 옵션을 선택할지 (리뷰 결과 B 추천이나 최종 결정 보류)
- [ ] 선택 시 단계적 마이그레이션 vs 한 번에 전환
- [ ] D/D' 선택 시: "판단이 필요한 순간"의 경계 정의 + subagent 병렬 실행 지원 확인
- [ ] 발견된 버그 4건 수정 (아키텍처 선택과 무관)
- [ ] MAX_CLAUDE_PROCS 기본값 재검토 (4 → 2~3)
