# 오케스트레이션 파이프라인

## 실행 흐름

```
orchestrate.sh
│
├── 1. Task 수집: docs/task/*.md에서 status=backlog인 Task 수집
├── 2. 의존 관계 분석: depends_on 기반으로 배치(batch) 구성
├── 3. 배치별 병렬 실행:
│   ├── Task A ──→ run-worker.sh ──→ iTerm 패널
│   └── Task B ──→ run-worker.sh ──→ iTerm 패널
├── 4. 배치 완료 대기
├── 5. 다음 배치 실행
└── 6. 전체 완료 → main 머지
```

## run-worker.sh 내부

```
run-worker.sh TASK-XXX
│
├── 1. run-task.sh TASK-XXX
│   ├── worktree 생성
│   ├── 역할 프롬프트 로드 (--system-prompt)
│   ├── Claude CLI 실행 (에이전트 모드)
│   └── 결과 저장 (output/TASK-XXX-task.json)
│
├── 2. run-review.sh TASK-XXX
│   ├── 리뷰어 프롬프트 로드
│   ├── Claude CLI 실행
│   └── 승인/수정요청 판정
│
├── 3. 수정요청 시:
│   ├── 피드백 파일 생성
│   └── run-task.sh TASK-XXX FEEDBACK → 재실행
│
└── 4. 최대 재시도: 10회
```

## Claude CLI 호출 방식

```bash
# 에이전트 모드 (검증 루프 허용)
echo "$PROMPT" | claude --output-format json \
  --dangerously-skip-permissions \
  --system-prompt "$ROLE_PROMPT"

# 역할은 --system-prompt, 작업 지시는 stdin으로 전달
# -p (print 모드) 대신 에이전트 모드 사용 → 코드 작성/실행/검증 가능
```

## 비용 로그

```
[날짜] TASK-ID | phase=task/review | input=N cache_create=N cache_read=N output=N | turns=N | duration=Nms | cost=$N
```

---

## Task 분할 원칙

> **프롬프트 실험 결론: 한 컨텍스트에 들어가는 작업은 쪼개지 않는 게 낫다.**

### DO — 큰 단위로 묶기

- **1 태스크 = 1 컨텍스트에서 완결되는 단위**
- "백엔드 API 전체"를 1태스크로, "프론트엔드 UI 전체"를 1태스크로
- 같은 서비스 안의 API 5개를 5태스크로 쪼개지 마라
- 태스크 간 의존성이 높으면 합쳐라

### DON'T — 잘게 쪼개기

- API 하나당 1태스크 ❌ → 통합 비용 발생
- 파일 하나당 1태스크 ❌ → 인터페이스 불일치
- "생성 API"와 "생성 UI"를 분리 ❌ → 한 기능은 한 태스크로

### 분할 기준

| 기준 | 쪼갠다 | 합친다 |
|------|--------|--------|
| 서로 다른 서비스/언어 | ✅ | |
| 같은 앱 내 API + UI | | ✅ |
| 파일 간 import 관계 | | ✅ |
| 독립적으로 배포 가능 | ✅ | |
| 한 사람이 한번에 구현 가능 | | ✅ |

### 예시

```
❌ Bad: 5태스크, 3배치
  배치 0: TASK-031 (CRUD API) + TASK-032 (실행 API)
  배치 1: TASK-033 (생성 UI) + TASK-034 (실행 UI)
  배치 2: TASK-035 (통합)

✅ Good: 2태스크, 2배치
  배치 0: TASK-031 (Backend 전체 — 모든 API)
  배치 1: TASK-032 (Frontend 전체 — 모든 UI + 통합)
```

### 이유

- 오케스트레이션 오버헤드 (분해 + 통합 디버깅) > 병렬 이득
- 캐시가 태스크마다 별도 → 재활용 불가
- 같은 서비스의 API와 UI를 다른 에이전트가 만들면 인터페이스 불일치 발생
- 한 에이전트가 전체를 만들면 검증 루프에서 자연스럽게 통합됨
