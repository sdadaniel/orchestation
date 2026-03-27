# 시스템 구조

## 전체 아키텍처

```
┌──────────────────────────────────────────────┐
│                  Web Dashboard                │
│  (Next.js — Task/Sprint/Docs/Cost/Terminal)   │
└─────────────────────┬────────────────────────┘
                      │ API
┌─────────────────────┴────────────────────────┐
│              Orchestration Layer              │
│                                               │
│  orchestrate.sh                               │
│    ├── run-task.sh → Claude CLI (에이전트)     │
│    ├── run-review.sh → Claude CLI (리뷰어)    │
│    └── run-worker.sh (task + review 루프)      │
└─────────────────────┬────────────────────────┘
                      │
┌─────────────────────┴────────────────────────┐
│              File System (docs/)              │
│                                               │
│  docs/task/TASK-*.md    ← Task 정의           │
│  docs/sprint/SPRINT-*.md ← Sprint 정의        │
│  docs/roles/*.md         ← 역할 프롬프트      │
│  docs/prd/*.md           ← PRD 문서           │
│  output/token-usage.log  ← 비용 로그          │
└──────────────────────────────────────────────┘
```

## 데이터 흐름

1. **Task 정의** → docs/task/TASK-XXX.md (frontmatter: status, branch, role, depends_on)
2. **orchestrate.sh** → Task를 의존 관계에 따라 배치로 분류
3. **run-task.sh** → Claude CLI로 에이전트 실행 (역할 프롬프트 + 작업 지시)
4. **run-review.sh** → Claude CLI로 리뷰어 실행 (완료 조건 검증)
5. **승인** → main에 머지 / **수정요청** → run-task.sh 재실행
6. **비용 기록** → output/token-usage.log

## 디렉토리 구조

```
orchestation/
├── scripts/              # 실행 스크립트
│   ├── orchestrate.sh    # 메인 오케스트레이터
│   ├── run-task.sh       # 작업자 에이전트
│   ├── run-review.sh     # 리뷰어 에이전트
│   ├── run-worker.sh     # task + review 루프
│   └── run-pipeline.sh   # 단일 태스크 파이프라인
├── docs/                 # 모든 문서
├── src/frontend/         # Next.js 대시보드
└── output/               # 실행 결과물
```

## API 엔드포인트 현황

### 태스크 관련 API (모두 `.orchestration/tasks/TASK-*.md` 읽기/쓰기)

| 엔드포인트 | 메서드 | 용도 | 상태 |
|-----------|--------|------|------|
| `/api/requests` | GET | 전체 태스크 목록 조회 | 활성 (레거시 경로명) |
| `/api/requests` | POST | 태스크 생성 (TASK-*.md 생성) | 활성 (레거시 경로명) |
| `/api/requests/[id]` | GET | 태스크 상세 조회 | 활성 (레거시 경로명) |
| `/api/requests/[id]` | PATCH | 태스크 상태/필드 수정 | 활성 (레거시 경로명) |
| `/api/requests/[id]/reorder` | POST | 태스크 순서 변경 | 활성 (레거시 경로명) |
| `/api/tasks` | GET | 태스크 목록 (의존 관계 포함) | 활성 |
| `/api/tasks/[id]` | GET/PATCH/DELETE | 태스크 CRUD | 활성 |
| `/api/tasks/[id]/run` | POST | 단일 태스크 수동 실행 | 활성 |
| `/api/tasks/[id]/logs` | GET | 태스크 실행 로그 | 활성 |
| `/api/tasks/[id]/result` | GET | Claude 작업 결과물 | 활성 |
| `/api/tasks/analyze` | POST | AI 태스크 분석 (분할 제안) | 활성 |
| `/api/tasks/suggest` | POST | 코드베이스 개선 태스크 자동 제안 | 활성 |
| `/api/tasks/watch` | GET | SSE 태스크 변경 감지 | 활성 |
| `/api/tasks/lastmod` | GET | 마지막 수정 시각 | 활성 |

> **중요**: `/api/requests`와 `/api/tasks`는 **모두 같은 `.orchestration/tasks/` 디렉토리**를 읽고 쓴다.
> 경로명만 다를 뿐 동일한 데이터 소스를 사용한다.
> `/api/requests` 경로는 레거시 명칭이며, `/api/tasks`로 통일하는 마이그레이션이 [TBD] 예정이다.

### role 필드 처리

- 태스크 생성 시 `role` 필드를 POST body에 포함 가능
- 서버는 `docs/roles/` 디렉토리를 읽어 유효한 역할 목록을 확인
- `general` 역할은 기본값이며 frontmatter에서 생략됨
- `/api/roles` 엔드포인트는 삭제되었으나, role 필드 자체는 여전히 처리됨

## Source of Truth

| 항목 | 진실 | 이유 |
|------|------|------|
| orchestrate 실행 여부 | OS PID 생존 (`kill(pid, 0)`) | 메모리 변수는 거짓말할 수 있음 |
| 태스크 상태 | `.orchestration/tasks/TASK-*.md` frontmatter | 파일이 유일한 영속 상태 |
| 워커 실행 여부 | `/tmp/worker-TASK-*.pid` + `kill(pid, 0)` | PID 파일만으로 부족, 생존 확인 필요 |
| 비용 | `.orchestration/output/token-usage.log` | claude CLI가 직접 기록 |

## 외부 의존성

| 의존성 | 용도 |
|--------|------|
| claude CLI | AI 에이전트 실행 |
| git + worktree | 태스크별 격리 실행 환경 |
| fswatch (선택) | 시그널 파일 감지 (없으면 polling fallback) |
| jq (선택) | config.json 파싱 |
| node-pty | 웹 터미널 |
| xterm.js | 터미널 UI |
