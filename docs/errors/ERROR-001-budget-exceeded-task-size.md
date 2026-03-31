# ERROR-001: 태스크 범위 과다로 인한 예산 초과 (Budget Exceeded)

## 개요
`TASK-001` 실행 중 설정된 태스크당 비용 상한($5.0)을 초과하여 오케스트레이터에 의해 강제 종료됨. 최종 누적 비용 약 $6.47 발생.

## 발생 일시
2026-03-31

## 현상
- `TASK-001` (프로젝트 기반 설정 및 DB/API 레이어 구축) 수행 중 리뷰 단계에서 실패 처리.
- `orchestrate.sh`의 Circuit Breaker(`MAX_TASK_COST`) 작동.
- 후속 의존 태스크(`TASK-002`~`TASK-005`) 모두 `stopped` 상태로 전이.

## 원인 분석
1. **과도한 태스크 범위 (Task Oversizing)**:
   - 단일 태스크 내에서 DB 스키마(11개 테이블), API Route(27개), 인증 로직, 크롤링/시드 스크립트 등 광범위한 구현 포함.
   - 작업량이 많아짐에 따라 AI의 도구 호출(Turn) 횟수가 80~90회 이상으로 증가.

2. **컨텍스트 비용 누적 (Context Inflation)**:
   - 작업이 길어질수록 대화 이력이 비대해져, 매 응답 시 발생하는 입력 토큰 비용이 기하급수적으로 상승.
   - 태스크 후반부에는 단순한 파일 생성 작업조차 높은 비용을 유발함.

3. **리뷰 루프의 비용 부담**:
   - 구현량이 많을수록 리뷰 통과 난이도가 높아지며, 작은 수정 요청(Reject)에도 대량의 컨텍스트를 다시 처리해야 하므로 비용이 급증함.

## 재발 방지 대책 (Best Practices)
- **태스크 세분화 (Atomic Tasks)**: 단일 태스크는 가급적 10~20개 내외의 파일 수정/생성으로 제한할 것.
- **계층별 분리**: 
  - 1단계: 인프라/공통 (DB, Auth, Types)
  - 2단계: 기능별 API (Public API, Admin API)
  - 3단계: 유틸리티 (Scripts, Seed)
- **예산 최적화**: 대규모 태스크가 불가피할 경우 `MAX_TASK_COST`를 사전에 조정하되, 가급적 태스크 분할을 우선 권장.

## 관련 파일
- `.orchestration/tasks/TASK-001-*.md`
- `.orchestration/output/token-usage.log`
- `scripts/orchestrate.sh` (Circuit Breaker 로직)
