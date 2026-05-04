# 역할 카탈로그 · 태스크 분석 연동 개선안

> `docs/roles/`와 대시보드 `/api/tasks/analyze`, 태스크 생성 API, 엔진 실행(`job-task`)이 어떻게 맞물리는지 정리하고, **역할 매칭·폴백·운영** 관점에서의 개선 후보를 문서화한다.

**기준일:** 2026-05-04

---

## 1. 현재 동작 요약

### 1.1 역할 목록의 출처

- **경로:** `[packages/engine/src/lib/config/paths.ts](../../packages/engine/src/lib/config/paths.ts)`의 `ROLES_DIR` → 우선 `PACKAGE_DIR/docs/roles/`를 보고, 없으면 `PROJECT_ROOT/docs/roles/`로 폴백한다.
- **워커 역할 후보:** 해당 디렉터리의 `*.md` 중  
`reviewer-*`로 시작하지 않고 `README.md`가 아닌 파일의 **파일명(확장자 제외)**이 역할 ID다.
- **리뷰어 역할:** `reviewer-*.md`는 태스크 **분석** 단계의 `available_roles`에는 넣지 않는다 (작업자 역할만 나열).

### 1.2 태스크 분석 (`POST /api/tasks/analyze`)

- 구현: `[packages/dashboard/src/app/api/tasks/analyze/route.ts](../../packages/dashboard/src/app/api/tasks/analyze/route.ts)`
- `getAvailableRoles()`로 디렉터리를 **동적** 읽고, 프롬프트 템플릿 `[task-analyze.md](../../packages/dashboard/template/prompt/task-analyze.md)` 또는 refine용 `[task-analyze-refine.md](../../packages/dashboard/template/prompt/task-analyze-refine.md)`의 `{{available_roles}}`에 `  - role-id` 형태로 주입한다.
- 모델 응답 JSON의 각 `role`은 `**getAvailableRoles().includes(role)`이면 그대로, 아니면 `general`로 치환**한다.
- 디렉터리 읽기 실패 시 목록은 `["general"]`만 사용한다.

### 1.3 태스크 생성 (`POST /api/tasks`)

- 구현: `[packages/dashboard/src/app/api/tasks/route.ts](../../packages/dashboard/src/app/api/tasks/route.ts)`  
- 본문의 `role`이 위와 동일한 규칙의 유효 목록에 없으면 내부적으로 빈 값 처리 후, `**createTask`에는 `general`이 들어간다** (`taskRole || "general"`).

### 1.4 실행 시 역할 프롬프트 로드

- 구현: `[packages/engine/src/orchestrate/jobs/job-task.ts](../../packages/engine/src/orchestrate/jobs/job-task.ts)`
- `task.role`이 비어 있으면 `**general`**.
- `loadRolePrompt(role)` 순서: `**{ROLES_DIR}/{role}.md` → `general.md` → 둘 다 없으면** 짧은 하드코딩 기본 문구.

### 1.5 역할 목록 API

- `GET /api/roles`: `[packages/dashboard/src/app/api/roles/route.ts](../../packages/dashboard/src/app/api/roles/route.ts)` — UI 등에서 동일 디렉터리 기준으로 목록을 노출할 때 사용.

---

## 2. 관찰된 갭 · 리스크


| 구분                   | 내용                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **의미상 “맞는 역할 없음”**   | 시스템은 별도 상태를 두지 않는다. 모델이 목록 밖 문자열을 주면 `**general`로 강제 보정**된다.                                                         |
| **분석 프롬프트 정보 밀도**    | `available_roles`가 역할 ID 나열뿐이면, 모델이 **스코프와 역할을 잘못 매칭**하거나 억지로 좁은 역할을 고를 여지가 있다.                                      |
| **분석 템플릿 이원화**       | 일반 분석과 refine가 **서로 다른 프롬프트 템플릿**을 사용하므로, 역할 선택 규칙을 한쪽에만 추가하면 동작이 다시 벌어질 수 있다.                                      |
| `**general`의 역할 정의** | `[docs/roles/general.md](../roles/general.md)`는 실행 품질 가이드 위주이며, **“다른 역할에 안 맞을 때 이 역할을 써라”**는 분석 단계 지시와는 결이 다를 수 있다. |
| **코드 중복**            | 유효 역할 수집 로직이 `analyze/route.ts`, `tasks/route.ts`, `roles/route.ts` 등에 **동일 패턴으로 반복**된다. 한쪽만 규칙이 바뀌면 불일치 위험.         |
| **같은 요청 내 I/O**      | `analyze`는 검증 시 `getAvailableRoles()`를 **다시 호출**할 수 있어, 같은 요청에서 `readdir`가 중복될 수 있다 (규모상 보통 미미).                     |
| **역할 문서 메타데이터 혼입**    | 역할 문서 상단에 frontmatter를 추가하면, 이를 별도 파싱/제거하지 않는 한 **실행 시 system prompt에도 그대로 포함**된다.                                 |


---

## 3. 개선 제안 (우선순위)

### 높음 — 프롬프트·카탈로그 (코드 변경 최소, 효과 큼)

1. `**task-analyze.md`, `task-analyze-refine.md` 규칙 동시 보강**
  - 예: “목록에 정확히 맞는 작업자 역할이 없거나 복합 작업이면 `**general`을 선택**한다.”  
  - “알 수 없는 역할명을 만들지 말 것”을 한 줄 명시하면 **서버 쪽 `general` 폴백 비율**을 줄이는 데 도움이 된다.
2. `**general.md`에 ‘분석·배정’ 관점 한 단락**
  - “전문 역할에 단일하게 속하지 않는 태스크”, “여러 레이어를 건드리는 소규모 변경” 등 **언제 `general`인지**를 짧게 적어 두면, 분석 모델과 사람 모두 기준이 맞춰진다.
3. `**available_roles`에 한 줄 설명 포함 (선택)**
  - 각 `docs/roles/*.md` 상단에 YAML frontmatter `summary: ...`를 두고, 분석 API에서 읽어  
     `- frontend-dev — React/UI 중심` 형태로 주입하는 방식.  
  - **주의:** 현재 엔진의 역할 로더는 역할 문서를 **파일 전체 그대로** 실행 프롬프트에 넣는다. frontmatter를 도입하려면 분석 API에서만 파싱하는 것으로 끝내지 말고, 실행 시에는 이를 제거하거나 본문만 읽도록 로더를 함께 조정해야 한다.
  - **트레이드오프:** 프롬프트 토큰 증가 → 역할 개수가 많아지면 상한·요약 길이 제한을 둔다.

### 중간 — 코드 구조

1. **유효 워커 역할 목록 단일 함수로 통합**
  - 예: `@/lib/roles` 또는 엔진 `lib`에 `listWorkerRoleIds(rolesDir)` 한 곳에서 필터 규칙을 정의하고, `analyze` / `tasks` POST / `api/roles`가 모두 이를 사용.  
  - **효과:** 규칙 변경 시 한 파일만 수정.
2. **요청 단위 캐시(선택)**
  - `analyze` 핸들러에서 `getAvailableRoles()` 결과를 지역 변수에 한 번만 두고, 파싱 검증에 재사용.  
  - 프로세스 수명 TTL 캐시는 역할 파일이 자주 바뀌지 않는 전제에서만 고려 (무효화 정책 필요).

### 낮음 — 정책·고급

1. **엄격 검증 모드**
  - API가 알 수 없는 `role`을 **400**으로 거절하는 옵션. 데이터 품질은 좋아지나, 클라이언트·레거시 호환을 정해야 한다. 현재는 `**general` 폴백이 기본 정책**이다.
2. **2단계 라우팅**
  - 먼저 카테고리(예: front/back/infra)만 고르고, 두 번째 호출에서 세부 역할을 고르는 식은 **지연·비용**이 늘므로 필요해질 때만 검토.

---

## 4. 새 역할 추가 시 체크리스트

운영 관점에서 “최적화”는 **카탈로그를 반복 패턴에 맞게 유지**하는 것과 같다.

1. `docs/roles/새역할.md` 추가 (`reviewer-`*가 아니면 분석 목록에 자동 포함).
2. `[docs/roles/README.md](../roles/README.md)` 표에 한 줄 설명 추가(수동 동기화).
3. (frontmatter 요약을 도입했다면) `summary` 작성.
4. 샘플 태스크로 `/api/tasks/analyze` 한 번 돌려, 의도한 역할이 자주 선택되는지 확인.

---

## 5. 관련 파일


| 역할           | 경로                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `ROLES_DIR`  | `[packages/engine/src/lib/config/paths.ts](../../packages/engine/src/lib/config/paths.ts)`                             |
| 분석 API       | `[packages/dashboard/src/app/api/tasks/analyze/route.ts](../../packages/dashboard/src/app/api/tasks/analyze/route.ts)` |
| 태스크 생성 API   | `[packages/dashboard/src/app/api/tasks/route.ts](../../packages/dashboard/src/app/api/tasks/route.ts)`                 |
| 역할 목록 API    | `[packages/dashboard/src/app/api/roles/route.ts](../../packages/dashboard/src/app/api/roles/route.ts)`                 |
| 분석 프롬프트      | `[packages/dashboard/template/prompt/task-analyze.md](../../packages/dashboard/template/prompt/task-analyze.md)`       |
| refine 프롬프트  | `[packages/dashboard/template/prompt/task-analyze-refine.md](../../packages/dashboard/template/prompt/task-analyze-refine.md)` |
| 실행 시 프롬프트 로드 | `[packages/engine/src/orchestrate/jobs/job-task.ts](../../packages/engine/src/orchestrate/jobs/job-task.ts)`           |
| 역할 문서 모음     | `[docs/roles/README.md](../roles/README.md)`                                                                           |


---

## Prompt Feedback (메타)

이번 작업은 **코드 전역을 다시 읽지 않고도** 한 번에 정리할 수 있었던 상위 프롬프트 예시:

> “`available_roles` / `docs/roles` / analyze·task create·job-task의 role 폴백을 추적해서, 현재 동작과 개선 후보를 `docs/architecture/`에 한 편의 설계 문서로 써 줘. 표로 갭과 우선순위를 적고, 파일 경로는 상대 링크로.”
