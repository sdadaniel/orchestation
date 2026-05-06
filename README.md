# Orchestration

AI 개발 오케스트레이션 — 태스크 자동 실행, 리뷰, 머지 파이프라인

## 빠른 시작

```bash
# 1. 초기화
node cli.js init

# 2. API 키 설정
# .orchestration/config.json에서 apiKey 입력
# 또는 대시보드 Settings 페이지에서 설정

# 3. 대시보드 + 파이프라인 실행 (백그라운드)
node cli.js start
# → http://localhost:3000

# 4. 종료 (대시보드 + 파이프라인)
node cli.js stop
```

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `node cli.js init` | 프로젝트 초기화 (`.orchestration/` 생성) |
| `node cli.js start` | 대시보드 + 파이프라인 실행 (백그라운드) |
| `node cli.js stop` | 대시보드 + 파이프라인 종료 |
| `node cli.js night` | Night Worker 시작 |
| `node cli.js status` | 현재 상태 확인 |

### Night Worker 옵션

```bash
node cli.js night --until 07:00 --budget 5.00 --max-tasks 10
```

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--until` | 07:00 | 종료 시간 |
| `--budget` | 무제한 | 예산 한도 (USD) |
| `--max-tasks` | 10 | 최대 태스크 생성 수 |
| `--types` | typecheck,lint,review | 태스크 유형 |

## 폴더 구조

```
project/
  .orchestration/           # 오케스트레이션 데이터
    config.json             # 설정 (API 키, 모델, 병렬 수 등)
    tasks/                  # 태스크 정의 (TASK-XXX.md)
    notices/                # 알림 (NOTICE-XXX.md)
    output/                 # 실행 로그, 비용 데이터
      logs/
  scripts/                  # 실행 엔진
    orchestrate.sh          # 메인 파이프라인
    run-worker.sh           # 개별 태스크 워커
    night-worker.sh         # Night Worker
    lib/                    # 유틸리티
  packages/dashboard/      # 대시보드 (Next.js)
  packages/gateway/        # HTTP + WS + Next 커스텀 서버 호스트
  packages/engine/         # 엔진, CLI 스크립트, 파서, 공유 서버 유틸
  cli.js                    # CLI 엔트리포인트
```

## 로컬 개발

대시보드와 오케스트레이션 런타임은 서로 다른 `package.json`을 쓰므로, 클론 후 각각 한 번씩 설치합니다.

```bash
cd packages/dashboard && npm install
cd ../gateway && npm install
cd ../engine && npm install
```

모노레포 루트에서 한 번에 설치할 때는 `pnpm install`을 사용합니다.

### 대시보드 개발 (에이전트·워크트리 주의)

- **권장**: 리포 루트에서 `node cli.js start -p 3001` (또는 `pnpm dev:dashboard:3001` — `PORT`·`PROJECT_ROOT`·`PACKAGE_DIR` 기본 세팅).
- **직접**: `packages/dashboard`에서 `npm run dev`는 **게이트웨이 커스텀 서버**를 띄웁니다. worktree에서는 `PROJECT_ROOT`·`PACKAGE_DIR`을 해당 리포 루트로 두는 것이 안전합니다. 자세한 체크리스트·curl 주의(zsh `?`)는 [packages/dashboard/README.md](packages/dashboard/README.md)의 **에이전트·자동화용 개발 런북**을 참고하세요.
- **`npx next dev` 단독**은 이 레포의 공식 엔트리가 아니며, API·WS·경로 해석이 깨질 수 있습니다.

## 설정 (.orchestration/config.json)

```json
{
  "apiKey": "sk-ant-api03-...",
  "srcPaths": ["src/"],
  "model": "claude-sonnet-4-6",
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

| 설정 | 설명 |
|------|------|
| `apiKey` | Anthropic API 키 |
| `srcPaths` | Claude가 스캔할 소스 코드 경로 |
| `model` | 기본 모델 (haiku/sonnet/opus) |
| `maxParallel` | 동시 실행 태스크 수 |
| `maxReviewRetry` | 리뷰 실패 시 재시도 횟수 |
| `workerMode` | `background` (기본) 또는 `iterm` |

## 주요 기능

### 태스크 파이프라인
- 태스크 생성 → 의존 관계 확인 → 병렬 실행 → AI 리뷰 → 자동 머지
- scope 겹침 방지 — 같은 파일을 수정하는 태스크는 동시 실행 안 함
- 머지 충돌 자동 해결 — Claude가 충돌 해결 후 Notice로 보고

### Night Worker
- 밤 동안 코드 스캔 → 태스크 자동 생성
- 경미한 수정만 (타입 오류, 린트, 미사용 코드 정리)
- 종료 시 아침 요약 Notice 생성

### 대시보드
- Current 탭 — DAG 그래프로 태스크 의존 관계 시각화
- 실시간 로그 — 실행 중인 태스크 로그 확인
- Cost — 비용 추적
- Notice — 알림 (완료, 실패, 충돌 해결)
- Settings — API 키, 모델, 병렬 수 등 설정

### 태스크 추천
- `/tasks/new` → 추천받기 탭
- Claude가 프로젝트 분석 → 개선 포인트 추천 → 선택하여 태스크 생성

## 요구사항

- macOS (bash 스크립트 기반)
- Node.js 18+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) 설치
- Anthropic API 키

## 라이선스

MIT
