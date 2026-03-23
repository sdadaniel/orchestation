# 사이드바 구조 재설계

## 현재 문제

```
현재:
├─ PRD
│   └─ 대시보드
│       ├─ Sprint 5      ← Sprint이 PRD 안에?
│       └─ Sprint 6      ← Sprints 탭이랑 중복
├─ Filters
│   ├─ All Tasks
│   └─ By Status
├─ Pages
│   ├─ Terminal
│   ├─ Sprint            ← 또 Sprint
│   ├─ Plan              ← PRD랑 뭐가 다르지?
│   └─ Cost
```

1. Sprint이 2곳에 존재 (PRD 안 + Pages)
2. PRD가 문서인데 Sprint을 품으면 "프로젝트 관리 도구"가 됨
3. Plan이 PRD와 역할 겹침 → 별도 페이지일 이유 없음

---

## 자체 검증

### Q1: Plan은 어디에?

- Plan = "PRD를 어떻게 실행할 것인가"의 설계 문서
- PRD-001(대시보드) → PLAN-001(대시보드 구현 단계)
- **Plan은 PRD의 실행 계획이므로 PRD 하위가 맞다**
- 별도 페이지로 분리하면 "이 Plan이 어떤 PRD의 것인지" 연결이 끊김

### Q2: Sprint은 어디에?

- Sprint = 시간 기반 일정 단위
- PRD-001이 SPRINT-005, 006을 참조하지만, Sprint은 PRD에 종속되지 않음
- Sprint은 여러 PRD의 태스크를 포함할 수 있음 (교차 가능)
- **Sprint은 독립 섹션이 맞다**

### Q3: Task "By Sprint" 필터는 Sprint 중복 아닌가?

- "By Sprint" = 태스크 리스트를 Sprint별로 필터링하는 것 (필터)
- "Sprints" 섹션 = Sprint 자체의 상세 정보를 보는 것 (네비게이션)
- **역할이 다르므로 중복 아님**

### Q4: PRD 클릭 시 중앙 패널은?

- PRD는 문서 → 중앙 패널에 태스크 리스트를 유지할 이유 없음
- 하지만 중앙이 비면 어색함
- **PRD 클릭 시: 중앙은 해당 PRD의 Sprint/Task 요약, 오른쪽은 문서 본문**

### Q5: 확장성 — PRD가 여러 개면?

```
├─ 📄 PRD
│   ├─ PRD-001: 대시보드
│   │   └─ PLAN-001
│   └─ PRD-002: 채팅앱         ← 미래
│       └─ (아직 Plan 없음)
```
→ 자연스럽게 확장됨

---

## 최종 구조

```
사이드바:
├─ 📄 PRD                           ← 기획 (왜, 뭘)
│   └─ PRD-001: 대시보드
│       └─ PLAN-001                  ← PRD의 실행 계획
│
├─ 📅 Sprints                       ← 일정 (언제)
│   ├─ Sprint 5: Sprint 뷰
│   └─ Sprint 6: 비용 모니터링
│
├─ 📋 Tasks                         ← 작업 (뭘 하는지)
│   ├─ All Tasks (5)
│   ├─ By Status
│   │   ├─ ● Backlog (0)
│   │   ├─ ● In Progress (0)
│   │   └─ ● Done (5)
│   └─ By Sprint
│       ├─ Sprint 5 (3/3)           ← 필터 역할
│       └─ Sprint 6 (2/2)           ← 필터 역할
│
├─ 💰 Cost                          ← 비용 추적
└─ 🖥 Terminal                      ← 실행
```

흐름: PRD(왜) → Sprint(언제) → Task(뭘) — 큰 그림에서 실행 단위로

---

## 클릭 시 동작 (상태 기반)

| 클릭 | 중앙 패널 | 오른쪽 패널 | 레이아웃 |
|------|----------|------------|---------|
| **Tasks > All Tasks** | 전체 태스크 리스트 | 선택 대기 | 2열 (패널 닫힘) |
| **Tasks > By Status > Done** | Done 태스크만 필터 | 선택 대기 | 2열 |
| **Tasks > By Sprint > Sprint 5** | Sprint 5 태스크만 필터 | 선택 대기 | 2열 |
| **태스크 행 클릭** | (유지) | 태스크 상세 | 3열 |
| **같은 태스크 재클릭** | (유지) | 닫힘 | 2열 |
| **Sprints > Sprint 5** | Sprint 배치/태스크 테이블 | Sprint 목표/상태 | 3열 |
| **PRD > PRD-001** | 관련 Sprint/Task 요약 | PRD 문서 본문 | 3열 |
| **PRD > PLAN-001** | (유지 또는 요약) | Plan 문서 본문 | 3열 |
| **Cost** | 비용 페이지 (별도) | - | 별도 |
| **Terminal** | 터미널 (별도) | - | 별도 |
| **ESC / 빈 영역 클릭** | (유지) | 닫힘 | 2열 |

---

## 관심사 분리 검증

| 섹션 | 역할 | 데이터 | 중복 여부 |
|------|------|--------|----------|
| Tasks | 태스크 작업/관리 | docs/task/*.md | ✅ 유일 |
| Sprints | 일정/배치 관리 | docs/sprint/*.md | ✅ 유일 |
| PRD | 기획 문서 열람 | docs/prd/*.md + docs/plan/*.md | ✅ Plan은 PRD 하위 |
| Cost | 비용 모니터링 | output/token-usage.log | ✅ 유일 |
| Terminal | 실행 | WebSocket + pty | ✅ 유일 |

**Sprint 중복 체크:**
- Tasks > By Sprint = **필터** (태스크 리스트를 Sprint별로 걸러봄)
- Sprints = **네비게이션** (Sprint 자체의 배치 구조, 목표 확인)
- → 역할 다름, 중복 아님 ✅
