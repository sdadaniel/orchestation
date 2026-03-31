# 세션 리포트 — 2026-03-31

## 요약

orchestrate.sh와 Claude Agent Team을 비교 분석하고, 분석 결과를 기반으로 오케스트레이션 시스템 전반(백엔드 스크립트 + 프론트엔드 대시보드)을 개선한 세션.

---

## 1. 분석 문서 작성

### orchestrate.sh vs Agent Team 비교 (`docs/architecture/orchestrate-vs-agent-team.md`)
- 유사점 5개, 차이점 10개 영역 비교
- 실시간 관찰(Observability), 속도/태스크 Granularity, 데이터 정확성 섹션 포함
- 하이브리드 접근 제안: orchestrate.sh 스케줄링 유지 + 워커 내부 subagent 활용

### 종합 개선안 (`docs/architecture/legacy/improvement-plan.md`)
- **4개 Explore 에이전트** 병렬 투입 (속도/효율/정확성/아키텍처)
- **strict-reviewer 에이전트**가 10건 오류 발견 → 수정 반영
- Phase 1~3 총 16개 항목 도출

---

## 2. 백엔드 개선 (orchestrate.sh + 워커 스크립트)

### Phase 1: Quick Wins
| # | 항목 | 파일 | 변경 |
|---|------|------|------|
| 1 | 모델 분류 키워드 튜닝 | `model-selector.sh` | scope≤1 + 키워드 1개 이하 → Haiku. `complex_keyword_count` 도입 |
| 2 | MAX_REVIEW_RETRY 2→3 + circuit breaker | `orchestrate.sh` | `MAX_TASK_COST=$5.0`, 누적 비용 초과 시 자동 중단 |
| 3 | 유휴 폴링 30초→5초 | `orchestrate.sh` | `sleep 30` → `sleep 5` |
| 4 | dispatch 대기 2초→0.3초 | `orchestrate.sh` | `sleep 2` → `sleep 0.3` |
| 5 | 리뷰 판정 마커 구조화 | `worker-review.md`, `job-review.sh` | `**Decision**: APPROVE/REJECT` 형식 + 기존 "승인" 폴백 |

### Phase 2: 핵심 수정
| # | 항목 | 파일 | 변경 |
|---|------|------|------|
| 6 | PID 재사용 검증 | `orchestrate.sh` | `ps -p $wpid -o command=`으로 프로세스 명령어 확인 |
| 7 | RUNNING 상태 파일 동기화 | `orchestrate.sh` | 배열 + `/tmp/orchestrate-running/` 하이브리드, 재시작 시 복구 |
| 8 | find_file 캐시 | `orchestrate.sh` | `/tmp/orchestrate-filecache/` 60초 TTL 캐시 |
| 9 | scope 위반 사후 검증 | `job-task.sh` | task-done 전 git diff로 scope 밖 변경 자동 원복 |
| 10 | 태스크별 비용 상한 | `orchestrate.sh` | `bc`로 token-usage.log 누적 비용 비교 |

### Phase 3: 구조 개선
| # | 항목 | 파일 | 변경 |
|---|------|------|------|
| 11 | merge-resolver 에러 처리 | `merge-resolver.sh` | `timeout 300` + exit code 검증 + 충돌 마커 잔존 체크 |
| 12 | night-worker atomic 생성 | `night-worker.sh` | temp 파일 → 검증 → `mv` atomic rename |
| 13 | 메모리 가드 강화 | `orchestrate.sh` | Linux 임계값 512MB→2048MB |
| 14 | fswatch 직접 이벤트 수신 | `orchestrate.sh` | polling 1초→0.3초, 사전 시그널 체크 추가 |
| 15 | git commit 배치화 | `orchestrate.sh` | 개별 commit 6개소 → 메인 루프 끝 배치 commit |
| 16 | Lock PID 검증 | `orchestrate.sh` | stale lock의 holder PID 생존 확인 후 삭제 |

### 추가 수정 (세션 중 발견)
| 항목 | 파일 | 변경 |
|------|------|------|
| `_set_status()` 헬퍼 | `orchestrate.sh` | status 변경 시 `updated` 타임스탬프 자동 갱신 |
| context-builder 크래시 방지 | `context-builder.sh` | worktree 미존재 시 `.claudeignore` 생략, 실패해도 `return 0` |
| signals 디렉토리 보존 | `orchestrate.sh` | cleanup에서 `rm -rf $SIGNAL_DIR` → `rm -f $SIGNAL_DIR/*` |
| 머지 시 stash 보호 | `orchestrate.sh`, `merge-task.sh` | uncommitted 변경 stash → merge → pop |

---

## 3. 프론트엔드 개선

### 버그 수정
| 항목 | 파일 | 변경 |
|------|------|------|
| `TaskStatus`에 `"failed"` 누락 | `constants.ts`, `parser.ts`, `waterfall.ts`, `request-parser.ts` | `failed` 타입 + 스타일 + VALID_STATUSES 추가 |
| Home Overview에 Failed 카드 없음 | `AppShell.tsx` | Failed 카드 추가 (grid-cols-4 → 5) |
| 사이드바 정렬 — 활성 태스크 안 보임 | `TaskListSection.tsx` | `updated` 내림차순 → status 우선 정렬 (in_progress > pending > done) |
| SSE 이중 연결 | `tasks/[id]/page.tsx` | 별도 EventSource 제거 → `useTasksStore` 구독으로 교체 |
| patchRequest에 updated 미갱신 | `tasksStore.ts` | `patchRequest` 시 `updated: now` 자동 추가 |
| 새 태스크 SSE 미감지 | `SseProvider.tsx` | store에 없는 taskId → `fetchAll()` 호출 |

### 신규 기능
| 항목 | 파일 | 설명 |
|------|------|------|
| **Terminal 탭** (실시간 JSONL 뷰어) | `LiveTerminalPanel.tsx` | JSONL 대화 파일을 실시간 스트리밍. tool_use(시안), thinking(보라), text(기본) 분류 표시 |
| **WebSocket 백엔드** | `server.ts` | `/ws/task-terminal/{taskId}` 엔드포인트. `fs.watchFile`로 JSONL 감시 → batch push |
| **Settings 페이지 너비 축소** | `settings/page.tsx` | `max-w-2xl mx-auto` (TASK-293, 워커 자동 실행) |
| **Night Worker 페이지 너비 축소** | `night-worker/page.tsx` | `max-w-2xl mx-auto` (TASK-294, 워커 자동 실행) |

---

## 4. 문서 개선 (5개 에이전트 병렬)

| 문서 | 변경 |
|------|------|
| `agent-team-pattern.md` | 종합 개선안 사례 추가, strict-reviewer 패턴 섹션, LiveTerminalPanel 섹션 |
| `memory-leak-analysis.md` | 6개 이슈 상태 재검증, SSE 이중 연결 신규 발견, Node.js execSync 근본 원인 섹션 |
| `orchestrate-vs-agent-team.md` | 섹션 번호 수정, LiveTerminalPanel 반영, 데이터 정확성 섹션 신설 |
| `packaging-guide.md` | legacy → active 복원, 현재 구조로 전면 재작성 |
| `improvement-plan.md` | Phase 1~3 구현 완료 + 추가 수정 9건 반영 → legacy 이동 |

---

## 5. 야간 자동 점검 (cron)

- **매 시간 자동 점검** 10회 실행 (cron job `e953bc25`)
- Phase 1~3 전 16개 항목 bash -n + grep spot-check
- **Regression 0건** — 10회 연속 안정
- 1건 사소한 수정: 유휴 대기 로그 메시지 "30초마다" → "5초마다"

---

## 6. 수정된 파일 목록 (총 20개)

### 백엔드 스크립트 (7개)
- `scripts/orchestrate.sh`
- `scripts/job-task.sh`
- `scripts/job-review.sh`
- `scripts/lib/model-selector.sh`
- `scripts/lib/merge-resolver.sh`
- `scripts/lib/merge-task.sh`
- `scripts/lib/context-builder.sh`
- `scripts/night-worker.sh`

### 프론트엔드 (12개)
- `src/frontend/server.ts` — WebSocket task-terminal 엔드포인트
- `src/frontend/lib/constants.ts` — TaskStatus "failed" 추가
- `src/frontend/src/lib/parser.ts` — VALID_STATUSES "failed"
- `src/frontend/src/lib/waterfall.ts` — VALID_STATUSES "failed"
- `src/frontend/src/lib/request-parser.ts` — VALID_STATUSES "failed"
- `src/frontend/src/store/tasksStore.ts` — patchRequest updated 갱신
- `src/frontend/src/providers/SseProvider.tsx` — 새 태스크 감지
- `src/frontend/src/components/AppShell.tsx` — Failed 카드 추가
- `src/frontend/src/components/sidebar/TaskListSection.tsx` — status 우선 정렬
- `src/frontend/src/components/task-detail/LiveTerminalPanel.tsx` — 신규 생성
- `src/frontend/src/app/tasks/[id]/page.tsx` — Terminal 탭 + SSE 중복 제거
- `template/prompt/worker-review.md` — Decision 마커

### 문서 (5개)
- `docs/architecture/agent-team-pattern.md`
- `docs/architecture/memory-leak-analysis.md`
- `docs/architecture/orchestrate-vs-agent-team.md`
- `docs/architecture/packaging-guide.md`
- `docs/architecture/legacy/improvement-plan.md`

---

## 7. 발견된 미수정 이슈 (향후)

| 이슈 | 우선순위 | 위치 |
|------|---------|------|
| SSE 재연결 exponential backoff 미적용 | 중 | `SseProvider.tsx` |
| JSONL 로그 → SQLite 마이그레이션 | 낮 | Phase 4 |
| Go/Rust 오케스트레이터 재작성 | 낮 | Phase 4 |
| 워커 human-in-the-loop (인터랙티브 모드) | 낮 | Phase 4 |
