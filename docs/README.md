## AI CLI 역할 정의 (사람 운영용)

레오가 여러 AI CLI 터미널을 띄워 각각에 역할을 할당할 때 사용하는 가이드. 자동화된 멀티에이전트가 아니라, 사람이 수동으로 관리하는 분업 체계다.

---

## 역할 목록

### 1) 감독 (Task Manager + Sprint Manager)

전체 방향성 관리 + Plan/Sprint/Task 생성·분배·상태 관리를 담당하는 역할.
별도 Sprint Manager 역할 없이, 감독이 Sprint까지 담당한다.

* **하는 일**

  * **Plan 관리**
    * PRD 기반 장기 계획(Plan) 작성 및 유지
    * Plan은 "초안"이다 — 고정이 아니며, Sprint 종료 시 수정 가능
  * **Sprint 관리**
    * Plan에서 Sprint 단위로 쪼개기 (Sprint당 최대 3개 Task)
    * Sprint 목표 정의
    * Sprint 종료 후 Plan 업데이트
  * **Task 관리**
    * Task 생성 및 쪼개기
    * 의존 관계(`depends_on`, `blocks`, `parallel_with`) 정의
    * 브랜치 및 Worktree 정의
    * **작업자/리뷰어 역할 지정** (`role`, `reviewer_role` — `docs/roles/` 참고)
  * PRD 기준 방향성 유지, 과설계 방지, 병목 발생 시 개입
  * 병목 및 충돌 사전 방지
  * **Task 할당 전 TBD 해소 (필수)**
    * PRD나 기획에 TBD·미정·불명확한 항목이 있으면, **절대 가정하거나 임의로 결정하지 않는다**
    * 반드시 레오에게 질문하여 명확한 답변을 받은 뒤 Task에 반영한다
    * Task 내용은 **작업자(agent)가 추가 판단 없이 바로 실행할 수 있을 정도로 구체적**이어야 한다
    * 다음 항목이 모두 명시되어야 Task를 배정할 수 있다:
      * **무엇을**: 수정/생성할 파일, 함수, 컴포넌트 이름
      * **어떻게**: 구현 방식, 사용할 라이브러리/패턴, 데이터 구조
      * **입출력**: 예상 input/output 예시 또는 스펙
      * **완료 조건**: 어떤 상태가 되면 이 Task가 끝난 것인지 (테스트 통과 기준 포함)
    * "적절히 구현", "알아서 판단" 같은 모호한 표현 금지 — 작업자가 해석할 여지를 남기지 않는다
* **참고 문서**: `docs/prd/`, `docs/current/`, `docs/task/`, `docs/roles/`, `docs/plan/`, `docs/sprint/`
* **산출물**: Plan, Sprint, Task 파일 생성 및 상태 관리
* **금지**: 코드 수정

### 2) 작업자

Task를 받아 실제 코드 작업을 수행하는 역할. `docs/roles/`의 역할 프롬프트에 따라 전문성이 부여된다.

* **하는 일**

  * Worktree에서 코드 수정
  * 테스트 작성 및 실행
  * Reviewer 피드백 반영
* **역할 지정**: Task frontmatter의 `role` 필드 (예: `backend-dev`, `frontend-dev`)
* **참고 문서**: `docs/task/`
* **산출물**: 코드, 테스트
* **금지**

  * `main` 브랜치 직접 수정 금지
  * Task 상태 완료 처리 금지

### 3) Reviewer (검증자)

작업 결과를 검증하고 승인하는 역할. `docs/roles/`의 리뷰어 프롬프트에 따라 검증 성격이 부여된다.

* **하는 일**

  * 코드 리뷰
  * 테스트 검증
  * 승인 또는 수정 요청
* **역할 지정**: Task frontmatter의 `reviewer_role` 필드 (예: `reviewer-strict`, `reviewer-security`)
* **참고 문서**: Task 파일, 코드
* **완료 처리**: 승인 시 Task 완료 상태 변경
* **금지**: 코드 직접 수정


---

## 역할 간 흐름

```
감독 → Plan 확인 → Sprint 생성 (1~3 Task)
  ↓
감독 → Task 생성 + 의존 관계 정의 + 역할 지정 (role, reviewer_role)
  ↓
작업자 → Worktree에서 코드 작업 (parallel_with Task는 동시 실행)
  ↓
Reviewer → 코드 리뷰 및 승인 (수정 요청 시 작업자에게 반환)
  ↓
Sprint 내 모든 Task 완료 → Sprint 종료 → Plan 업데이트
  ↓
다음 Sprint 시작
```

---

## Sprint 시스템 (경량 버전)

큰 작업을 한 번에 처리하지 않고, 작은 단위로 쪼개서 반복 실행하기 위한 구조.

### 핵심 원칙

* 장기 계획(Plan)은 "초안"이다 (고정 아님)
* Sprint는 "짧고 실행 가능해야 한다"
* 계획보다 실행이 우선이다

### 구조

```
[장기 계획 (Plan)] → [Sprint] → [Task]
```

### 장기 계획 (Plan)

PRD를 기반으로 전체 작업의 큰 그림을 잡는 문서. 틀려도 된다.

```md
# Plan: 프로젝트명

## 목표
- 달성하려는 것

## 단계
1. 첫 번째 단계
2. 두 번째 단계
3. 세 번째 단계
```

* **위치**: `docs/plan/`
* Plan은 Sprint 종료 시 수정 가능
* 변경 시 변경 이유를 간단히 기록

### Sprint 정의

Sprint는 Plan의 단계를 실행 가능한 단위로 쪼갠 것.

```md
# Sprint N

## 목표
- 이 Sprint에서 달성할 것

## 포함 Task
- Task 1
- Task 2
- Task 3 (최대)
```

* **위치**: `docs/sprint/`
* 최대 3개 Task
* 1 Sprint = 하루 or 짧은 단위

### Sprint 운영 흐름

1. **감독**: Plan 확인 → 레오와 대화하며 **현재 Sprint만** 생성
2. **작업자**: Sprint 내 Task 수행
3. **검증자**: Task 검증
4. **Sprint 종료**: 감독이 Plan 업데이트 → 레오와 대화하며 다음 Sprint 계획

### Sprint 규칙

* Sprint는 최대 3개 Task
* Sprint는 반드시 실행 가능해야 한다 (모호함 금지)
* Sprint 끝나면 Plan 수정 가능
* Plan은 틀려도 된다 — Sprint는 반드시 실행 가능해야 한다
* **한 번에 모든 Sprint를 정의하지 않는다** — 현재 Sprint + 다음 Sprint 정도까지만 정의하고, 작업자가 작업하는 동안 레오와 대화하며 이후 Sprint를 준비한다

---

## Task 관리

### 1) 폴더 구조

Task 파일은 플랫하게 관리한다. 순서와 병렬 관계는 frontmatter로 표현한다.

```
docs/task/
├── TASK-001-data-model.md
├── TASK-002-api-crud.md
├── TASK-003-api-filter.md
├── TASK-004-ui-list.md
├── TASK-005-ui-detail.md
└── TASK-006-ui-admin.md
```

### 2) Task 파일 형식

모든 Task 파일은 YAML frontmatter를 포함한다.

```yaml
---
id: TASK-XXX
title: 작업 제목
sprint: SPRINT-001       # 소속 Sprint
status: backlog          # backlog → in_progress → in_review → done
priority: critical       # critical / high / medium / low
depends_on:              # 이 Task가 시작되려면 완료되어야 하는 Task
  - TASK-001
blocks:                  # 이 Task가 완료되어야 시작할 수 있는 Task
  - TASK-003
parallel_with:           # 동시 실행 가능한 Task (영향 파일 분리 전제)
  - TASK-004
role: backend-dev        # 작업자 역할 (docs/roles/ 참고)
owner: worker-a          # 배정된 작업자
branch: task/TASK-XXX-short-desc
worktree: ../repo-wt-TASK-XXX
reviewer_role: reviewer-strict  # 리뷰어 역할 (docs/roles/ 참고)
reviewer: reviewer-1
affected_files:          # 이 Task가 수정하는 파일/디렉토리
  - src/models/
  - src/types/
---
```

### 3) frontmatter 필드 설명

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자. 전체 프로젝트에서 순차 증가 |
| `sprint` | 소속 Sprint ID |
| `status` | `backlog` → `in_progress` → `in_review` → `done` |
| `depends_on` | 선행 Task 목록. 모두 `done`이어야 시작 가능 |
| `blocks` | 이 Task가 완료되어야 해제되는 후행 Task 목록 |
| `parallel_with` | 동시 실행 가능한 Task. `affected_files`가 겹치지 않아야 함 |
| `role` | 작업자 역할. `docs/roles/`의 파일명 (확장자 제외). 미지정 시 `general` |
| `reviewer_role` | 리뷰어 역할. `docs/roles/`의 파일명 (확장자 제외). 미지정 시 `reviewer-general` |
| `affected_files` | 수정 대상 파일/디렉토리. 충돌 방지의 근거 |

### 4) 실행 규칙

* `depends_on`의 모든 Task가 `done`이면 시작 가능
* `parallel_with`에 명시된 Task끼리는 동시 실행 허용
* `parallel_with` Task 간 `affected_files`가 겹치면 감독이 조정
* `blocks`는 `depends_on`의 역방향 참조 (양쪽 모두 명시하여 일관성 유지)

### 5) 상태 변경 권한

| 전환 | 권한 |
|------|------|
| `backlog` → `in_progress` | 감독 |
| `in_progress` → `in_review` | 작업자 |
| `in_review` → `done` | Reviewer |
| `in_review` → `in_progress` | Reviewer (수정 요청 시) |

---

## 운영 규칙

### 1) Worktree 규칙

* 작업자는 반드시 **자신의 Worktree에서만** 작업
* 다른 Worktree 접근 금지
* 동일 파일을 여러 Task에서 동시에 수정 금지 (감독 책임)

### 2) 브랜치 규칙

* 모든 작업은 `task/*` 브랜치에서 수행
* `main` 브랜치 직접 수정 금지
* merge는 Reviewer 승인 후만 가능

### 3) 문서 규칙

* 작업자는 Task 파일만 수정 가능
* Task 파일은 단일 진실 소스(SSOT)

### 4) 충돌 방지 규칙

* `parallel_with` Task 간 `affected_files`가 겹치면 안 됨 (감독이 사전 검증)
* 동일 영역 작업은 `depends_on`으로 순차 처리
* 충돌 발생 시 작업자가 아닌 감독이 조정

### 5) Escalation 규칙

다음 조건 발생 시 감독이 레오에게 보고:

* 2회 이상 Reviewer 피드백 무응답
* 24시간 이상 작업 미진행
* 3일 이상 Task 미완료
* 반복적인 설계 충돌 발생

### 6) 병렬 작업 규칙

* 병렬 실행은 `parallel_with`에 명시된 Task 간에만 허용
* 한 Task = 한 브랜치 = 한 Worktree
* 각 작업자는 **서로 다른 Worktree**에서만 작업 (동일 디렉토리 공유 금지)
* `affected_files` 겹침 금지
* Reviewer는 **Task별로 독립 리뷰** 수행 (리뷰 혼합 금지)
* 병렬 중 충돌 징후 발생 시 **감독이 즉시 조정/재배정**

### 7) 브랜치 전략

* 기본 브랜치: `main` (항상 배포 가능한 상태 유지)
* Sprint 브랜치: `sprint/SPRINT-XXX-<short-desc>` (Sprint 단위 통합 브랜치)
* 작업 브랜치: `task/TASK-XXX-<short-desc>` (Sprint 브랜치에서 분기)
* (선택) 검증 브랜치: `review/TASK-XXX-<short-desc>`
* (긴급) 핫픽스: `hotfix/TASK-XXX-<short-desc>`

**Sprint 브랜치 규칙**

* Sprint 시작 시 감독이 `main`에서 Sprint 브랜치를 생성
* Task 브랜치는 Sprint 브랜치에서 분기
* Sprint 내 모든 Task 완료 → Sprint 브랜치를 `main`에 머지
* 예: `sprint/SPRINT-001-map-rendering` → `task/TASK-101-map-data` (분기)

**생성 규칙**

* Task 생성 시 감독이 브랜치/Worktree를 함께 정의
* 예: `task/TASK-101-login-form` → `../repo-wt-TASK-101`

**작업 규칙**

* 모든 개발은 `task/*` 브랜치에서만 수행
* `main` 직접 수정 금지
* 작업자는 자신의 브랜치/Worktree 외 접근 금지

**동기화 규칙**

* 장기 작업 시 주기적으로 Sprint 브랜치를 rebase (또는 merge)하여 최신 상태 유지
* Sprint 브랜치는 필요 시 `main`과 동기화
* rebase 충돌은 작업자가 해결, 설계 충돌은 감독이 조정

**머지 규칙**

* Reviewer 승인 전 merge 금지
* Task 브랜치 → Sprint 브랜치: **squash merge**
* Sprint 브랜치 → `main`: Sprint 완료 후 머지
* 머지 메시지에는 반드시 `TASK-XXX` 또는 `SPRINT-XXX` 포함

**충돌 방지 규칙**

* 감독은 Task 생성 시 `affected_files`를 반드시 명시
* `affected_files`가 겹치는 Task는 `depends_on`으로 순차 처리

**정리 규칙**

* Task 머지 완료 후 Task 파일의 `status`를 `done`으로 변경하고 커밋
* Sprint 완료 후 Sprint 브랜치 및 Task 브랜치 삭제
* Worktree 정리 (`git worktree remove`)

---

## 권한 매트릭스

### 읽기 권한

| 경로              | 감독 | 작업자 | Reviewer |
| --------------- | -------- | --- | -------- |
| `docs/prd/`     | O        | R   | R        |
| `docs/current/` | O        | R   | R        |
| `docs/plan/`    | O        | R   | R        |
| `docs/sprint/`  | O        | R   | R        |
| `docs/task/`    | O        | O   | O        |
| `docs/roles/`   | O        | O   | O        |
| 소스 코드           | R        | O   | O        |

### 쓰기 권한

| 경로              | 감독 | 작업자   | Reviewer |
| --------------- | -------- | ----- | -------- |
| `docs/prd/`     | O        | ×     | ×        |
| `docs/current/` | O        | ×     | ×        |
| `docs/plan/`    | O        | ×     | ×        |
| `docs/sprint/`  | O        | ×     | ×        |
| `docs/task/`    | O        | O(내용) | O(상태)    |
| `docs/roles/`   | O        | ×     | ×        |
| 소스 코드           | ×        | O     | ×        |
