# AI Result 탭이 실패한 태스크에서 "작업 완료"로 표시되는 문제 (2026-03-27)

## 요약
TASK-258이 review retry 상한 초과로 failed 처리되었으나, AI Result 탭에는 워커의 "작업 완료" 요약이 그대로 표시됨. 사용자가 실패한 태스크를 성공으로 오인할 수 있음.

## 증상
- 태스크 status: **failed** (review retry 상한 초과)
- AI Result 탭: "작업 완료. 수정된 내용을 요약합니다..." — **성공처럼 보임**
- 사용자 혼란: 작업은 끝났는데 왜 failed?

## 근본 원인

AI Result 탭은 `TASK-XXX-task.json`의 `.result` 필드를 표시한다. 이건 **task 단계 워커의 최종 텍스트 응답**이다.

```
task 워커 실행 → 코드 수정 + 커밋 → "작업 완료" 응답 (여기가 .result)
  ↓
review 워커 실행 → 수정요청 → retry → retry → 상한 초과 → failed
```

task 단계는 성공했지만 review에서 실패한 경우, AI Result에는 task 워커의 성공 응답만 남아있다. 실패 사유(review 수정요청 내용)는 별도 파일(`TASK-XXX-review-feedback.txt`)에 있지만 AI Result 탭에 표시되지 않음.

## 문제의 영향
- 사용자가 failed 태스크의 AI Result를 보고 "성공한 줄 알았는데?" 혼란
- 실패 원인(리뷰 피드백)을 보려면 별도로 리뷰 결과 파일을 찾아야 함
- TASK-258 사례: 문서 작업이 잘 완료됐지만 불필요한 리뷰에서 반복 실패

## 개선안

### 1. AI Result 탭에 최종 status 반영 (즉시)
- status가 `failed`이면 AI Result 상단에 실패 사유 배너 표시
- review에서 실패한 경우 리뷰 피드백도 함께 표시
- 예: `⚠️ 이 태스크는 리뷰 단계에서 실패했습니다: review retry 상한 초과`

### 2. 리뷰 불필요 role은 review 스킵 (근본 해결)
- `prd-architect`, `tech-writer` 등 코드를 수정하지 않는 role은 review 불필요
- task 완료 → review 건너뛰고 → 바로 merge → done
- TASK-258 같은 문서 작업 실패를 원천 차단

### 3. AI Result를 단계별로 분리 표시 (나중)
- Task Result: 워커 작업 결과
- Review Result: 리뷰어 판정 결과
- Final Status: 최종 상태 + 사유
- 현재는 한 탭에 섞여있어서 혼란
