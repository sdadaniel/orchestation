---
id: TASK-104
title: CostTable에 타임스탬프 컬럼 추가
status: pending
priority: medium
sprint:
depends_on: [TASK-103]
branch: task/TASK-104-costtable---
worktree: ../repo-wt-TASK-104
role: general
reviewer_role: reviewer-general
---

# TASK-104: CostTable에 타임스탬프 컬럼 추가

## 원본 요청

- Request: REQ-036
- 제목: Cost 테이블에 타임스탬프 컬럼 추가
- 내용: CostTable에 timestamp 데이터가 파싱되어 있지만 UI에 표시되지 않는다. 타임스탬프 컬럼을 추가하여 각 실행의 시각을 확인할 수 있게 한다.

## 완료 조건

- CostTable 컴포넌트에 "시각" 또는 "Timestamp" 컬럼 추가
- 기존에 파싱된 timestamp 데이터를 해당 컬럼에 표시
- 날짜/시간 포맷을 사람이 읽기 쉬운 형식으로 렌더링 (예: YYYY-MM-DD HH:mm:ss)
- 기존 컬럼 레이아웃과 스타일 일관성 유지
