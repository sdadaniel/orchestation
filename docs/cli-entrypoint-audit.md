# CLI·진입점 감사 프롬프트

사용자가 **설치·실행·중지**할 때 실제로 거치는 경로를 한 번에 점검할 때 쓰는 **상위(마스터) 프롬프트**다. 에이전트나 사람이 주기적으로 복붙해 전수 감사를 돌리면, 단일 파일 비대화·플랫폼 의존·exit/시그널 불일치를 일괄 발견하기 쉽다.

## 기준 시점 (스냅샷 검증)

아래 **감사 범위 표**의 구체 경로·`package.json` 인용은 특정 시점의 트리에 맞춰 적어 두었다. 리팩터 후에는 표와 이 블록을 함께 갱신한다.

- **확인일**: 2026-05-05 — 루트 `package.json`, `packages/engine/src/cli/`, `docs/architecture/packaging-guide.md` 존재, 루트 `scripts/`·`*.sh` 없음을 기준으로 표를 맞춤.
- **재현**: 큰 변경 직후에는 확인일을 오늘로 바꾸고, 필요하면 같은 줄에 `git rev-parse --short HEAD` 결과를 덧붙인다.

## 사용 시점

- `cli.js` 또는 엔진 CLI를 대규모로 손볼 때 (리팩터 전/후)
- Windows·Linux CI·새 머신에서 “왜 안 돌아가지?” 이슈가 나온 뒤
- 패키징(`package.json` `bin`, `files`, `engines`, `os`)을 바꿀 때

## 마스터 프롬프트 (복사용)

```
이 레포의 모든 사용자 대면 진입점(루트 cli.js, bin 스크립트, packages/*/src/cli, npm scripts, 문서에 적힌 설치/실행 경로)을 감사해줘. 목표: 어떤 OS·CI에서도 예측 가능하게 동작하고, 한 파일에 몰린 로직·중복·플랫폼 전용 명령·exit/시그널 불일치를 줄이며, 필요한 곳은 테스트/모듈 경계로 쪼갤 수 있게 정리할 수 있는지 평가하고 우선순위를 매겨줘.
```

## 이 레포에서의 감사 범위 (기준 스냅샷)

감사 시 아래를 **빠짐없이 훑는다**. 경로는 리포 구조 변경 시 함께 업데이트한다.

| 구분 | 위치 |
|------|------|
| 메인 CLI | 루트 `cli.js` |
| npm bin | 루트 `package.json`의 `"bin": { "orchestrate": "./cli.js" }` — 별도 `bin/` 디렉터리 없음 |
| npm scripts | 루트 `package.json`의 `start` / `status` / `restart` / `stop` (각각 `node cli.js …`) |
| 엔진 TS 엔트리 | `packages/engine/src/cli/` (`run-engine.ts`, `run-task.ts`, `run-review.ts`, `run-night-worker.ts`) — **기준 시점** 기준으로 다른 패키지에는 `packages/*/src/cli` 없음 |
| 문서상 실행 경로 | 루트 `README.md`, `docs/architecture/packaging-guide.md`(존재 확인됨), `packages/dashboard/README.md` 등 — `cli.js`·`orchestrate`·과거 셸 진입점 설명의 **상호 일치**를 본다 |
| 레거시 셸·문서상 셸 | 과거 `scripts/*.sh` 등은 **문서·태스크 기록에 남아 있을 수 있으나**, 기준 시점 트리에는 루트 `*.sh` / `scripts/` 실체가 **없을 수 있음**. 존재 여부를 `find` 등으로 확인하고, 문서만 남은 경우는 사용자 대면 경로(`cli.js`)와의 **불일치**로 취급한다 |

**참고**: 루트 `package.json`에는 `"os": ["darwin", "linux"]`, `"engines": { "node": ">=18" }`가 있다. 감사에서는 (1) 선언과 실제 코드(`pgrep`/`ps`/`which` 등)의 일치, (2) Windows를 지원하지 않을 명시적 정책인지, (3) CI가 Linux만이면 충분한지까지 정리하면 좋다.

## 기대 산출물

감사를 수행한 에이전트/사람은 최소 다음을 남긴다.

1. **인벤토리**: 위 표에 해당하는 실제 파일·커맨드·문서 줄(링크 또는 경로).
2. **문제 목록**: 단일 파일 비대화, 중복 로직, Unix 전용 서브프로세스, 파싱/exit 코드/시그널 처리 불일치, 문서와 코드 불일치.
3. **우선순위**: P0(설치/실행/중지가 깨짐), P1(특정 OS·CI에서만 깨짐 또는 유지보수 비용 큼), P2(정리·테스트 분리 등 개선).
4. **모듈/테스트 경계 제안**: 순수 함수로 빼기 좋은 조각(포트 프로브, argv 파싱, PID 탐지 추상화 등)과, 그에 맞는 파일 단위 후보.

## 세부 체크리스트 (하위 프롬프트)

마스터 프롬프트만으로도 충분하지만, **코드만 좁혀** 보고 싶을 때는 아래를 추가로 붙인다.

```
cli.js와 packages/engine/src/cli 전체를 점검해줘:
1) 단일 파일/중복 로직
2) Windows·CI 환경에서 깨질 수 있는 pgrep/ps/which 의존
3) 파싱·exit 코드·시그널 처리 일관성
4) 테스트 가능한 단위로 쪼갤 수 있는 경계
```

## Prompt Feedback (상위 프롬프트 축적용)

한 번에 넓게 잡고 싶을 때는 이 문서 **마스터 프롬프트** 블록을 쓰고, `cli.js`만 파고들 때는 **세부 체크리스트**를 덧붙이면 된다.

## 관련 문서

- 일반적인 프롬프트 작성 원칙: `[docs/prd/doc-prompt-guide.md](prd/doc-prompt-guide.md)`

