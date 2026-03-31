# Orchestration 프로젝트 구조 및 패키징 가이드

## 1. 전체 프로젝트 구조

```
orchestration/
├── cli.js                      # CLI 엔트리포인트 (Node.js, bin)
├── package.json                # @orchestration/cli
├── config.json                 # 패키지 기본 설정 (maxParallel, workerMode)
├── .orchestration/             # 런타임 데이터 (git-ignored)
│   ├── config.json             # 프로젝트별 설정 (apiKey, model, nightWorker 등)
│   ├── tasks/                  # 태스크 정의 파일 (TASK-NNN-*.md)
│   ├── signals/                # 태스크 간 시그널 파일
│   ├── notices/                # 완료/실패 알림 (NOTICE-NNN-*.md)
│   └── output/                 # 실행 결과물
│       ├── logs/               # 태스크별 실행 로그
│       ├── crash.log           # 서버 크래시 로그
│       └── TASK-*-*.json       # 태스크/리뷰 결과 JSON
├── scripts/                    # 핵심 파이프라인 (bash 3.x)
│   ├── orchestrate.sh          # 메인 오케스트레이션 루프
│   ├── job-task.sh             # 태스크 실행 워커
│   ├── job-review.sh           # 코드 리뷰 워커
│   ├── night-worker.sh         # 야간 자동 실행
│   ├── auto-improve.sh         # 자동 개선 스크립트
│   ├── cleanup-stuck.sh        # 멈춘 태스크 정리
│   ├── collect-requests.sh     # 요청 수집
│   ├── analyze-dependencies.sh # 의존성 분석
│   ├── archive-tasks.sh        # 완료 태스크 아카이브
│   └── lib/                    # 공용 bash 라이브러리
│       ├── common.sh           # 공통 유틸 (경로, 로깅, config 로딩)
│       ├── signal.sh           # 시그널 송수신
│       ├── merge-resolver.sh   # 머지 충돌 자동 해결
│       ├── merge-task.sh       # 태스크 브랜치 머지
│       ├── model-selector.sh   # 모델 자동 선택
│       ├── context-builder.sh  # 프롬프트 컨텍스트 빌드
│       ├── iterm-run.sh        # iTerm 세션 실행
│       ├── close-iterm-session.sh
│       └── sed-inplace.sh      # macOS/Linux 호환 sed
├── template/                   # 프롬프트/엔티티 템플릿
│   ├── prompt/                 # Claude CLI용 프롬프트
│   │   ├── worker-task.md      # 태스크 실행 프롬프트
│   │   ├── worker-review.md    # 코드 리뷰 프롬프트
│   │   ├── task-analyze.md     # 태스크 분석
│   │   ├── task-suggest.md     # 태스크 제안
│   │   ├── night-scan.md       # 야간 스캔
│   │   └── night-scan-types.md # 야간 스캔 유형 정의
│   └── entity/                 # 태스크 정의 템플릿
│       ├── task.md             # 일반 태스크 템플릿
│       └── task-night.md       # 야간 태스크 템플릿
├── src/frontend/               # 대시보드 (Next.js + 커스텀 서버)
│   └── (아래 별도 섹션 참조)
├── docs/                       # 프로젝트 문서
│   ├── architecture/           # 아키텍처 문서
│   ├── prd/                    # 제품 요구사항 정의
│   ├── plan/                   # 작업 계획
│   ├── task/                   # 태스크 가이드
│   ├── notice/                 # 공지 템플릿
│   ├── roles/                  # 역할 정의
│   ├── errors/                 # 에러 분석
│   ├── requests/               # 기능 요청
│   └── todo/                   # 할 일 목록
├── swagger/                    # API 스펙 (OpenAPI)
├── tests/                      # 통합 테스트 (bash)
└── output/                     # 빌드/실행 출력물
```

## 2. 주요 디렉터리 상세

### 2-1. `.orchestration/` — 런타임 데이터

프로젝트별 런타임 데이터를 저장하는 디렉터리. `cli.js init` 실행 시 자동 생성되며 `.gitignore`에 추가된다.

| 경로 | 용도 |
|------|------|
| `config.json` | 프로젝트 설정 — apiKey, model, srcPaths, maxParallel, maxReviewRetry, nightWorker 등 |
| `tasks/` | 태스크 정의 마크다운. frontmatter에 status, scope, priority 등 포함 |
| `signals/` | 태스크 간 비동기 통신용 시그널 파일 (예: `TASK-266-review-rejected`) |
| `notices/` | 태스크 완료/실패/충돌 등 이벤트 알림 마크다운 |
| `output/logs/` | 태스크 실행 로그 |
| `output/*.json` | 태스크/리뷰 결과 JSON |

태스크 상태 값: `pending` → `in_progress` → `reviewing` → `done` / `rejected` / `stopped`

### 2-2. `scripts/` — 파이프라인 엔진

bash 3.x 기반. `declare -A`, `mapfile`, `readarray` 사용 금지 (macOS 호환).

**메인 스크립트:**
- `orchestrate.sh` — pending 태스크를 감지하여 워커를 병렬 실행하는 메인 루프
- `job-task.sh` — 개별 태스크를 Claude CLI로 실행 (브랜치 생성 → 코드 작성 → 커밋)
- `job-review.sh` — 완료된 태스크를 Claude CLI로 리뷰 (approve → 머지 / reject → 재작업)
- `night-worker.sh` — 야간에 자동으로 태스크를 스캔/생성/실행

**lib/ 라이브러리:**
- `common.sh` — PROJECT_ROOT, ORCH_DIR 등 경로 변수 및 공통 함수
- `signal.sh` — 시그널 파일 기반 태스크 간 통신
- `merge-resolver.sh` — git 머지 충돌 자동 해결
- `model-selector.sh` — 태스크 복잡도에 따른 모델 자동 선택
- `context-builder.sh` — 태스크 scope 기반 프롬프트 컨텍스트 구성

### 2-3. `src/frontend/` — 대시보드

Next.js 기반 + 커스텀 `server.ts` (WebSocket 지원).

```
src/frontend/
├── server.ts                   # 커스텀 HTTP/WS 서버 (next + ws + node-pty)
├── package.json                # orchestration-dashboard
├── next.config.ts
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── tasks/              # 태스크 관리
│   │   ├── monitor/            # 실행 모니터링
│   │   ├── cost/               # 비용 대시보드
│   │   ├── terminal/           # 웹 터미널 (xterm.js + node-pty)
│   │   ├── notices/            # 알림 목록
│   │   ├── settings/           # 설정
│   │   ├── plan/               # 작업 계획
│   │   ├── night-worker/       # 야간 워커 관리
│   │   ├── docs/               # 문서 뷰어
│   │   └── requests/           # 기능 요청
│   ├── components/
│   │   ├── ui/                 # 디자인 시스템 컴포넌트 (Input, Select, Button, Dialog 등)
│   │   ├── sidebar/            # 사이드바 내비게이션
│   │   ├── task-detail/        # 태스크 상세 뷰
│   │   ├── terminal/           # 터미널 컴포넌트
│   │   ├── cost/               # 비용 관련 컴포넌트
│   │   ├── monitor/            # 모니터 관련 컴포넌트
│   │   └── waterfall/          # 워터폴 차트
│   ├── providers/              # React 컨텍스트 (SSE, React Query)
│   ├── store/                  # Zustand 스토어
│   ├── hooks/                  # 커스텀 훅 (useTasks, useCosts, useMonitor 등)
│   ├── lib/                    # 유틸리티 (파서, 러너, 경로 등)
│   └── types/                  # TypeScript 타입 정의
├── e2e/                        # Playwright E2E 테스트
└── vitest.config.ts            # 유닛 테스트 설정
```

**주요 기술 스택:**
- Next.js 16 (App Router) + React 19
- 커스텀 server.ts — HTTP 서버 + WebSocket (ws) + 터미널 (node-pty)
- 상태 관리: Zustand + TanStack React Query
- 실시간 데이터: SSE (Server-Sent Events)
- UI: Tailwind CSS 4 + Radix UI + Lucide 아이콘
- 차트: Recharts
- 터미널: xterm.js
- 테스트: Vitest (유닛) + Playwright (E2E)
- 문서화: Storybook 10

### 2-4. `cli.js` — CLI 엔트리포인트

Node.js 스크립트. `package.json`의 `bin` 필드로 `orchestrate` 명령어에 매핑.

| 명령어 | 동작 |
|--------|------|
| `orchestrate init` | `.orchestration/` 디렉터리 및 config.json 생성, .gitignore 업데이트 |
| `orchestrate dashboard` | 대시보드 dev 서버 실행 (src/frontend) |
| `orchestrate run` | orchestrate.sh 실행 (메인 파이프라인) |
| `orchestrate night` | night-worker.sh 실행 |
| `orchestrate status` | 현재 상태 출력 (API 키, 모델, 태스크 수 등) |

### 2-5. 설정 파일 우선순위

```
.orchestration/config.json (프로젝트 설정)  ← 우선
config.json (패키지 기본값)                  ← 폴백
```

**패키지 기본값 (`config.json`):**
```json
{
  "maxParallel": 5,
  "workerMode": "background"
}
```

**프로젝트 설정 (`.orchestration/config.json`):**
```json
{
  "apiKey": "****",
  "srcPaths": ["src/"],
  "model": "claude-sonnet-4-6",
  "baseBranch": "main",
  "maxParallel": 3,
  "maxReviewRetry": 2,
  "workerMode": "background",
  "nightWorker": {
    "until": "07:00",
    "budget": null,
    "maxTasks": 10,
    "types": "typecheck,lint,review"
  }
}
```

## 3. 배포 전 해결할 결정 사항

### 3-1. 패키지 범위 결정

| 옵션 | 포함 범위 | 장점 | 단점 |
|------|----------|------|------|
| **A. 모노 패키지** | CLI + scripts + template + frontend 전부 | 설치 한 번으로 끝 | 패키지 사이즈 큼, frontend 의존성 무거움 |
| **B. 코어 + 대시보드 분리** | `@orchestration/cli` + `@orchestration/dashboard` | 대시보드 없이도 사용 가능 | 두 패키지 관리 필요 |
| **C. 코어만 배포** | CLI + scripts + template | 가볍고 단순 | 대시보드는 별도 설치/실행 |

**권장: 옵션 B** — 코어는 가볍게 유지하고, 대시보드는 선택 설치.

### 3-2. 배포 레지스트리

| 옵션 | 설명 |
|------|------|
| **npm public** | `npm publish` — 누구나 설치 가능 |
| **npm private (org scope)** | `@yourorg/orchestration` — 조직 내부 전용 |
| **GitHub Packages** | GitHub repo에 연결, 접근 제어 용이 |
| **로컬 tarball** | `npm pack` → `.tgz` 파일 공유 |

## 4. 패키징 단계별 작업

### Step 1: package.json 정비

```jsonc
{
  "name": "@orchestration/cli",
  "version": "0.1.0",
  "description": "AI Development Orchestration — 태스크 자동 실행, 리뷰, 머지 파이프라인",
  "bin": {
    "orchestrate": "./cli.js"
  },
  "files": [
    "cli.js",
    "scripts/",
    "template/",
    "config.json"
  ],
  "engines": {
    "node": ">=18"
  },
  "os": ["darwin", "linux"],
  "keywords": ["ai", "orchestration", "claude", "automation"],
  "license": "MIT"
}
```

핵심:
- **`files` 필드**: npm publish 시 포함할 파일만 명시. `.orchestration/`, `src/frontend/`, `docs/`, `output/` 등은 제외
- **`engines`**: Node 18+ 필수
- **`os`**: bash 3.x 의존이므로 darwin/linux만 지원

### Step 2: .npmignore 생성

`files` 필드가 있으면 보통 불필요하지만, 안전장치로 추가:

```
.orchestration/
src/frontend/
tests/
docs/
output/
swagger/
.claude/
*.DS_Store
repo-wt-*
```

### Step 3: 경로 참조 수정

스크립트 내부 경로가 `SCRIPT_DIR` 기반으로 통일되어 있는지 확인:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"
```

`cli.js`는 이미 `__dirname` 기반:
```js
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const FRONTEND_DIR = path.join(__dirname, "src", "frontend");
```

점검 대상:
- `scripts/orchestrate.sh`의 `source` 경로
- `scripts/job-task.sh`의 template 참조 경로
- `scripts/job-review.sh`의 template 참조 경로
- `scripts/lib/common.sh`의 config 참조 경로

### Step 4: 외부 의존성

| 도구 | 용도 | 필수 여부 |
|------|------|----------|
| `claude` | Claude CLI (태스크 실행, 리뷰) | **필수** |
| `git` | 브랜치/머지/워크트리 | **필수** |
| `jq` | JSON 파싱 | **필수** |
| `node` >= 18 | CLI 엔트리포인트 | **필수** |
| `bash` >= 3.x | 스크립트 실행 (macOS 기본 bash) | **필수** |

### Step 5: 대시보드 패키지 (옵션 B 선택 시)

대시보드는 커스텀 server.ts가 WebSocket과 node-pty를 통합하므로, 별도 패키지로 분리 시 다음이 필요:

- `ws` + `node-pty`는 네이티브 바인딩이므로 OS별 빌드 고려
- `server.ts`가 `.orchestration/` 경로를 상대 참조 — 패키지화 시 경로 해석 로직 필요
- React Query + SSE 기반 실시간 데이터가 `.orchestration/output/`을 감시 — 경로 설정 가능해야 함

## 5. 배포 명령

```bash
# 1. 포함될 파일 확인
npm pack --dry-run

# 2. tarball 생성 (로컬 테스트)
npm pack

# 3. 다른 프로젝트에서 테스트
cd /path/to/other-project
npm install /path/to/orchestration-cli-0.1.0.tgz
orchestrate init
orchestrate run

# 4. 레지스트리 배포
npm publish --access public
```

## 6. 사용자 설치 및 사용 흐름

```bash
# 1. 설치
npm install -g @orchestration/cli

# 2. 초기화
cd my-project
orchestrate init
# → .orchestration/ 디렉터리 생성
# → .orchestration/config.json 생성
# → .gitignore에 .orchestration/ 추가

# 3. 설정
vi .orchestration/config.json
# apiKey, srcPaths, model, maxParallel 등

# 4. 실행
orchestrate run              # 파이프라인 실행
orchestrate night --until 07:00  # Night Worker
orchestrate status           # 상태 확인
orchestrate dashboard        # 대시보드 (localhost:3000)
```

## 7. 배포 전 체크리스트

- [ ] `files` 필드 추가하여 포함 파일 명시
- [ ] `npm pack --dry-run`으로 포함 파일 확인
- [ ] 모든 스크립트의 경로 참조가 `SCRIPT_DIR` 기반인지 확인
- [ ] config 로딩 우선순위 구현 (프로젝트 → 패키지 기본값)
- [ ] template 오버라이드 로직 구현
- [ ] `cli.js init`에 외부 의존성 체크 추가 (claude, git, jq)
- [ ] LICENSE 파일 추가
- [ ] `.orchestration/` 내부 데이터가 패키지에 포함되지 않는지 확인
- [ ] 대시보드 분리 시 server.ts 경로 참조 해결
- [ ] 다른 프로젝트에서 `npm install <tarball>` → `orchestrate init` → `orchestrate run` 테스트

## 8. 향후 고려

- **`orchestrate eject`**: template을 `.orchestration/template/`로 복사하여 커스터마이즈 가능하게
- **플러그인 시스템**: 커스텀 job-type을 등록할 수 있는 구조
- **Windows 지원**: bash 의존 제거 또는 WSL 가이드
- **npx 지원**: `npx @orchestration/cli init`으로 설치 없이 초기화
- **대시보드 프로덕션 빌드**: `next build` + standalone 모드로 배포 최적화
