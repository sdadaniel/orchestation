# 패키징 테스트 발견 이슈 (2026-03-31)

> funble-backup 프로젝트에서 `npm install orchestration-cli-*.tgz` + `npx orchestrate start` 테스트 중 발견

---

## 해결 완료

### 1. CONFIG_FILE 경로 불일치
- **증상**: cli.js init이 `.orchestration/config.json`에 생성, 스크립트는 루트 `config.json`을 읽음
- **수정**: `.orchestration/config.json` 우선, 루트 fallback

### 2. apiKey → claudeApiKey 키 이름 불일치
- **증상**: config에 apiKey로 설정해도 스크립트에서 claudeApiKey로 읽어서 무시됨
- **수정**: cli.js를 claudeApiKey로 통일

### 3. srcPaths 미연동
- **증상**: config에 설정만 존재, 스크립트에서 사용하는 곳 없음
- **수정**: 모든 스크립트에서 읽어서 .claudeignore, night-scan 프롬프트에 반영

### 4. PROJECT_ROOT / PACKAGE_DIR 경로 하드코딩
- **증상**: paths.ts, server.ts, template.ts, orchestration-manager.ts가 `process.cwd()/../..`로 하드코딩 → 패키지 설치 시 엉뚱한 경로 참조
- **수정**: `PROJECT_ROOT`, `PACKAGE_DIR` 환경변수 우선 사용

### 5. template/docs/roles 경로
- **증상**: 패키지 내부 리소스(template/, docs/roles/)를 PROJECT_ROOT에서 찾음 → ENOENT
- **수정**: PACKAGE_DIR 기반으로 패키지 내부 우선, 프로젝트 fallback

### 6. .gitignore로 인한 git add 실패
- **증상**: `.orchestration/`이 .gitignore에 있어서 `git add` 실패 → `set -e`로 전체 스크립트 종료 (exit 1)
- **수정**: `git add -f` 사용

### 7. /tmp/ 경로 프로젝트 격리 없음
- **증상**: 모든 프로젝트가 `/tmp/orchestrate.lock` 등 같은 경로 사용 → 동시 실행 시 충돌
- **수정**: `PROJECT_ROOT` cksum 해시 기반 `/tmp/orchestrate-{hash}/` prefix

### 8. get_list() 인라인 배열 미지원
- **증상**: `depends_on: [TASK-001, TASK-002]` 형식을 파싱 못 함 → 의존성 무시 → 동시 실행
- **수정**: 인라인 배열 `[...]` 파싱 추가 (macOS awk 호환)

### 9. start 명령에 PACKAGE_DIR 환경변수 누락
- **증상**: `orchestrate start`로 대시보드 실행 시 PACKAGE_DIR 미전달 → 내부 리소스 경로 해석 실패
- **수정**: cli.js start에서 `PACKAGE_DIR: __dirname` 추가

### 10. 포트 충돌 시 자동 포트 탐색
- **증상**: 3000번 포트 사용 중이면 EADDRINUSE 에러로 크래시
- **수정**: 자동으로 다음 포트 탐색 + `-p` 옵션 지원

---

## 미해결 이슈

### 11. 대시보드 재시작 시 orchestrate.sh 상태 유실
- **증상**: 대시보드를 죽이고 재시작하면 orchestration-manager의 메모리 상태가 리셋됨. 기존 orchestrate.sh는 고아 프로세스로 백그라운드에서 계속 돌지만 대시보드는 "idle"로 표시
- **영향**: 시그널 파일이 쌓여도 처리 안 됨, UI와 실제 상태 불일치
- **원인**: orchestration-manager가 상태를 메모리에만 보관, 디스크 persist 없음
- **대안**: 상태를 `.orchestration/` 내 파일이나 SQLite에 저장, 재시작 시 복구

### 12. 고아 orchestrate.sh 프로세스
- **증상**: 대시보드가 종료되어도 spawn한 orchestrate.sh가 살아남음. 새로 Run 누르면 중복 실행 가능
- **영향**: 같은 프로젝트에서 orchestrate.sh 2개가 돌면 시그널/상태 경쟁
- **원인**: 대시보드 종료 시 자식 프로세스 kill 안 함
- **대안**: 대시보드 shutdown hook에서 orchestrate.sh process group kill, 또는 시작 시 기존 PID 파일 체크

### 13. TASK-004 의존성 무시 실행 (이전 버그 잔여)
- **증상**: get_list 수정 전에 실행된 TASK-004가 의존성(TASK-001, TASK-002) 무시하고 동시 실행됨
- **영향**: 의존 태스크의 결과물 없이 작업 → 불완전한 코드 생성
- **상태**: get_list 수정으로 근본 원인 해결, 하지만 이미 실행된 결과는 수동 정리 필요

### 14. 비-git 프로젝트에서 실행 실패
- **증상**: git init 안 한 프로젝트에서 Run 누르면 exit code 128 (git fatal error)
- **영향**: `orchestrate init`이 git 초기화를 안 해줌
- **대안**: `orchestrate init`에서 git repo 아니면 `git init` 자동 실행, 또는 사전 체크 후 안내 메시지

### 15. npm install 시 peer dependency 경고 다수
- **증상**: 프론트엔드 의존성 설치 시 vite/eslint peer dependency 충돌 경고 대량 출력
- **영향**: 동작에는 문제 없지만 사용자 경험 나쁨
- **대안**: 프론트엔드 의존성 정리 (storybook/eslint 버전 호환)

### 16. 프론트엔드 node_modules 매번 재설치
- **증상**: `rm -rf node_modules/@orchestration` 후 재설치하면 프론트엔드 node_modules도 사라져서 790개 패키지 재설치 (~10초)
- **영향**: 버전 업데이트마다 대기 시간
- **대안**: 프론트엔드 node_modules를 패키지 외부에 캐시하거나, Next.js standalone 빌드로 전환
