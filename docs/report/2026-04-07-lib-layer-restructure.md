# src/frontend/src/lib/ 레이어 구조 개편 보고서

> 2026-04-07 | 45개 파일 분석

## 현황: 문제점

`lib/` 디렉토리에 45개 파일이 **역할 구분 없이** 플랫하게 배치되어 있다.

- DB 접근 코드(`task-store.ts`, `db.ts`)와 순수 유틸(`slug-utils.ts`)이 같은 레벨
- 비즈니스 로직 엔진(`orchestrate-engine.ts`)과 파서(`parser.ts`)가 같은 레벨
- 새 파일 추가 시 어디에 넣어야 할지 판단 기준 없음

## 현재 파일 분류 (45개)

### DB 접근 (2개)
| 파일 | 역할 |
|------|------|
| `db.ts` | SQLite 연결 관리 (read-only, writable) |
| `task-store.ts` | 태스크 CRUD (SELECT, INSERT, UPDATE) |

### 비즈니스 로직 / 엔진 (11개)
| 파일 | 역할 |
|------|------|
| `orchestrate-engine.ts` | 메인 오케스트레이션 엔진 (워커, 시그널, 루프) |
| `orchestration-manager.ts` | 엔진 래퍼 (UI 상태/이벤트) |
| `auto-improve-manager.ts` | 자동 개선 루프 |
| `night-worker.ts` | 야간 코드 스캔/태스크 생성 |
| `job-task.ts` | 단일 태스크 실행 파이프라인 |
| `job-review.ts` | 코드 리뷰 실행 파이프라인 |
| `merge-utils.ts` | Git 머지 + 충돌 해결 |
| `task-runner-manager.ts` | 병렬 태스크 러너 관리 |
| `task-runner-iterm.ts` | iTerm2 탭 통합 |
| `task-runner-utils.ts` | 러너 공용 유틸 |
| `claude-worker.ts` | Claude CLI 호출 래퍼 |

### 파서 / 데이터 추출 (9개)
| 파일 | 역할 |
|------|------|
| `parser.ts` | 태스크 프론트매터 파싱 |
| `plan-parser.ts` | 계획 파일 파싱 |
| `prd-parser.ts` | PRD 파싱 |
| `plan-tree.ts` | 계획 트리 구조 빌드 |
| `cost-parser.ts` | 토큰/비용 로그 파싱 |
| `notice-parser.ts` | 알림 파일 파싱 + 생성 |
| `task-log-parser.ts` | 태스크 출력 로그 파싱 |
| `request-parser.ts` | 요청 메타데이터 파싱 (삭제 대상) |
| `doc-tree.ts` | 문서 트리 빌드 |

### 순수 유틸리티 (13개)
| 파일 | 역할 |
|------|------|
| `frontmatter-utils.ts` | gray-matter 유틸 |
| `cost-aggregation.ts` | 비용 집계 (모델별) |
| `cost-phase.ts` | 비용 집계 (페이즈별) |
| `date-utils.ts` | 날짜 포맷팅 |
| `error-utils.ts` | 에러 메시지 추출 |
| `format-utils.ts` | 시간 포맷팅 |
| `process-utils.ts` | 자식 프로세스 스트림 |
| `slug-utils.ts` | URL 슬러그 생성 |
| `paths.ts` | 경로 상수 |
| `template.ts` | 템플릿 렌더링 |
| `utils.ts` | Tailwind cn() |
| `waterfall.ts` | 워터폴 시각화 변환 |
| `signal.ts` | 시그널 파일 생성 |

### 설정 / 상태 (2개)
| 파일 | 역할 |
|------|------|
| `settings.ts` | 설정 로드/검증 |
| `context-builder.ts` | 태스크 프롬프트 빌드 |

### 로깅 / 모니터링 (2개)
| 파일 | 역할 |
|------|------|
| `token-logger.ts` | 토큰 사용량 기록 |
| `run-history.ts` | 실행 이력 추적 |

### React Query (클라이언트) (2개)
| 파일 | 역할 |
|------|------|
| `query-client.ts` | TanStack Query 설정 |
| `query-keys.ts` | 쿼리 키 팩토리 |

### 타입 정의 (2개)
| 파일 | 역할 |
|------|------|
| `monitor-types.ts` | 모니터링 타입 |
| `task-runner-types.ts` | 러너 상태 타입 |

### 모델 선택 (1개)
| 파일 | 역할 |
|------|------|
| `model-selector.ts` | 태스크 복잡도 → 모델 선택 |

## 제안: 레이어 구조

```
src/
├── service/                    # DB 접근 + 비즈니스 로직
│   ├── db.ts                   # SQLite 연결
│   ├── task-store.ts           # 태스크 CRUD
│   ├── token-logger.ts         # 토큰 기록 (DB 쓰기)
│   └── run-history.ts          # 실행 이력 (DB 쓰기)
│
├── engine/                     # 오케스트레이션 핵심 엔진
│   ├── orchestrate-engine.ts
│   ├── orchestration-manager.ts
│   ├── auto-improve-manager.ts
│   ├── night-worker.ts
│   ├── job-task.ts
│   ├── job-review.ts
│   ├── merge-utils.ts
│   ├── claude-worker.ts
│   ├── context-builder.ts
│   ├── model-selector.ts
│   ├── signal.ts
│   └── runner/
│       ├── task-runner-manager.ts
│       ├── task-runner-iterm.ts
│       ├── task-runner-utils.ts
│       └── task-runner-types.ts
│
├── parser/                     # 파일 파싱 / 데이터 추출
│   ├── parser.ts
│   ├── plan-parser.ts
│   ├── prd-parser.ts
│   ├── plan-tree.ts
│   ├── cost-parser.ts
│   ├── notice-parser.ts
│   ├── task-log-parser.ts
│   └── doc-tree.ts
│
├── lib/                        # 순수 유틸 (의존성 없음)
│   ├── utils.ts
│   ├── paths.ts
│   ├── settings.ts
│   ├── date-utils.ts
│   ├── error-utils.ts
│   ├── format-utils.ts
│   ├── slug-utils.ts
│   ├── template.ts
│   ├── frontmatter-utils.ts
│   ├── process-utils.ts
│   ├── cost-aggregation.ts
│   ├── cost-phase.ts
│   ├── waterfall.ts
│   ├── query-client.ts
│   └── query-keys.ts
│
├── constants/                  # (이미 존재)
│   ├── status.ts
│   └── terminal.ts
│
└── types/                      # (이미 존재)
    ├── monitor-types.ts        # ← lib에서 이동
    └── ...
```

## 의존성 방향 규칙

```
lib/ (순수 유틸)  ←  parser/  ←  service/  ←  engine/
        ↑                           ↑              ↑
     constants/                   types/         cli/
```

- `lib/`는 다른 레이어를 import하지 않음
- `parser/`는 `lib/`만 import
- `service/`는 `lib/`, `parser/` import 가능
- `engine/`는 모든 레이어 import 가능
- **역방향 의존 금지**: `lib/`가 `service/`를 import하면 안 됨

## 작업 규모

- 이동 대상: 45개 파일
- import 경로 수정 필요: API routes, components, hooks 등 전체 (~100+ import문)
- 권장: 레이어별로 나눠서 단계적 이동 (service → engine → parser → lib 순)
