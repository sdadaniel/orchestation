---
status: ready
---

# Sprint 8: 실시간 모니터링 + 알림

## 목표

오케스트레이션이 돌아가는 동안 사용자가 "지금 뭐 하고 있는지"를 대시보드에서 **물어보지 않아도** 알 수 있어야 한다.

## 핵심 문제

현재는 오케스트레이션 실행 중에:
- 어떤 Task가 실행 중인지 알려면 파일을 직접 확인해야 함
- 완료/실패 시 알림이 없음 → 계속 새로고침하거나 물어봐야 함
- Task 상세를 보려면 사이드 패널만 있음 → 실행 로그는 볼 수 없음
- "멈춘 건지 돌고 있는 건지" 구분할 수 없음

## 해결해야 할 것

### 1. 실시간 상태 자동 갱신
- 대시보드 홈의 Overview 카드, Active Tasks, Active Sprints가 주기적으로 자동 갱신 (5초 polling)
- Task 상태 변경 시 (backlog → in_progress → done) UI가 즉시 반영
- 스피너가 돌고 있으면 "살아있다", 멈추면 "끝났다"가 직관적으로 보여야 함

### 2. 토스트 알림
- Task 완료 시: "✅ TASK-031 완료" 토스트 (우하단, 3초 후 자동 닫힘)
- Task 실패 시: "❌ TASK-031 실패" 토스트 (빨간색, 수동 닫기)
- Sprint 전체 완료 시: "🎉 Sprint 7 완료!" 토스트
- 새 Task 실행 시작 시: "🚀 TASK-033 실행 시작" 토스트

### 3. Task 상세 페이지 (/tasks/[id])
- 현재: 우측 사이드 패널에서만 간단한 정보 표시
- 개선: 별도 페이지로 이동 가능
  - Task 메타 정보 (상태, 우선순위, 역할, 의존성, Sprint)
  - Task 문서 내용 (docs/task/TASK-XXX.md의 body)
  - 실행 로그 (output/TASK-XXX-task.json의 result)
  - 리뷰 결과 (output/TASK-XXX-review.json의 result)
  - 비용 정보 (token-usage.log에서 해당 Task)
  - 실행 중이면 로그가 실시간으로 업데이트

### 4. /tasks 리스트에서도 실시간 표시
- In Progress 태스크에 스피너 표시 (홈과 동일)
- 상태 변경 시 자동 갱신

### 5. 홈 대시보드 활성화
- "마지막 갱신: 3초 전" 타임스탬프 표시
- 실행 중일 때 전체 페이지 상단에 파란 인디케이터 바 (GitHub Actions 스타일)
