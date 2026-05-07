# 대시보드 로그/터미널 겹침 및 세션(재실행) 모델 이슈

## 배경

Task 상세 화면의 Logs 탭은 `대화 / 이벤트 / 비용 / 터미널` 서브탭으로 구성된다.  
사용자 관찰 기준으로 다음 문제가 반복 발생했다.

- 실행 중에는 로그가 잘 보이는데 `failed` 이후에는 로그가 비거나(특히 대화) 기대와 다르게 보임
- `대화` 탭과 `터미널` 탭이 같은 내용을 다른 형태로 보여 **중복/겹침**이 발생
- 태스크는 `failed` 이후 **여러 번 재실행(run/attempt)** 될 수 있고, `stopped → resume`은 같은 세션으로 취급해야 함
- 세션마다 `Task/Review/...` 같은 **workflow 단계**가 있으며, 단계는 반복될 수도 있음 (예: Task → Review → Task → Review)

---

## 현재 관찰된 문제

### 1) `failed` 이후 “대화 로그가 안 뜨는” 문제

- 실행 중에는 WebSocket 이벤트(`log.dashboard`, `log.console`)로 들어오는 라인이 UI에 실시간 append되어 보인다.
- 실패 후 새로고침/재진입 시에는 초기 로그가 `/api/tasks/:id/logs` 응답으로만 구성된다.
- 이때 DB 기반 로그(이벤트/비용)만 있거나, 파일 기반 실행 로그가 없다면 `대화`가 비어 보일 수 있다.

### 2) “대화 탭”과 “터미널 탭”의 내용 겹침

- `터미널` 탭은 `*-task-conversation.jsonl`(Claude CLI `stream-json` JSONL)을 그대로 스트리밍/렌더링한다.
- `대화` 탭도 `/api/tasks/:id/logs`에 conversation JSONL에서 파생된 텍스트가 포함되면, 결과적으로 같은 정보를 다른 형태로 중복 표시하게 된다.

### 3) 일부 태스크에서 `대화/비용` 카운트가 0

“겹치면 안 됨” 정책을 위해 `대화` 탭에서 conversation JSONL을 제외하면,

- 해당 태스크가 DB(`token_usage`, `task_events`)나 `output/logs/*.log` 같은 실행 로그가 없는 경우
- `대화/비용`이 0으로 표시될 수 있다.

---

## 기술적 원인(데이터 소스/표현 구조)

### 로그 저장소가 2계열로 분리됨

- DB(구조화): `token_usage`, `task_events` 중심  
  - 비용/상태 전이에 강함
  - “대화 원문/러너 stdout”은 원칙적으로 없음
- 파일(원본/비정형):
  - `output/token-usage.log`
  - `output/<taskKey>-task-conversation.jsonl` / `output/<taskKey>-review-conversation.jsonl`
  - `output/<taskKey>-task.json` / `output/<taskKey>-review.json`
  - `output/logs/<taskKey>.log`

### UI 분류가 의미 기반이 아니라 “문자열 패턴 기반”

대화/이벤트/비용은 본질적으로 동일한 `lines` 배열(문자열)을 정규식으로 분류한다.  
따라서 “어떤 소스를 `lines`에 포함시키는지”가 곧 탭 의미를 결정한다.

---

## 결정된 정책(UX)

### “대화 탭”과 “터미널 탭”은 겹치면 안 됨

- 터미널 탭: conversation JSONL(Claude stream-json 이벤트) 전용
- 로그 탭의 `대화/이벤트/비용`: conversation JSONL에서 파생된 항목을 **제외**하고,
  - DB 이벤트/비용
  - 워커/러너 실행 로그(`output/logs/*.log`) 등 “실행 로그” 중심으로 표시

---

## 적용된 변경(해결책)

### `/api/tasks/:id/logs`에 `includeConversation` 옵션 추가

- 기본값: `includeConversation=1`(기존 동작 유지)
- 로그 탭 전용 호출: `includeConversation=0` (대화 JSONL 제외 → 터미널과 겹침 방지)

대시보드 Logs 탭(대화/이벤트/비용)은 다음처럼 호출하도록 변경한다.

- `/api/tasks/:id/logs?includeConversation=0`

---

## 남아있는 과제(근본 해결)

### 1) 세션(run/attempt) 모델 도입

요구사항:

- `stopped → resume`은 **같은 session**
- `failed → rerun`은 **새 session**
- session마다 workflow 단계(Task/Review/...)가 있으며 반복 가능

따라서 데이터/UI 계층은 아래를 기본으로 한다.

- Task(논리 카드: `TASK-369`)
  - Session(run/attempt #1)
    - Workflow steps: Task → Review → ...
  - Session(run/attempt #2)
    - Workflow steps: Task → Review → ...

### 2) “실행 로그” 최소 보장

`includeConversation=0` 정책을 유지하려면,

- conversation JSONL 외에도 “실행 로그”가 session 단위로 안정적으로 저장되어야 한다.
- 그렇지 않으면 일부 태스크는 Logs 탭이 비게 된다.

권장:

- 세션마다 최소 1개의 실행 로그 소스(예: `output/logs/<taskKey>.log` 또는 sessionId 포함 파일)를 확보

---

## 다음 액션(우선순위 제안)

1. **Session Switcher UI** 도입 (최신 세션 기본, 이전 세션 선택 가능)
2. 세션별 workflow를 반복 가능한 timeline으로 표현
3. 모든 로그/비용/이벤트/터미널이 “선택된 session” 스코프를 명시하도록 URL에 `session` 파라미터 추가
4. `includeConversation=0`에서도 비지 않도록 세션 단위 실행 로그 저장을 보장

