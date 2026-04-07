# 2026-04-06 Node.js 마이그레이션 이슈

## Issue 1: Claude CLI JSON 출력에서 cost 파싱 실패 — **해결됨**
- **증상**: cost_usd가 항상 0으로 기록됨
- **원인**: Claude CLI 출력에서 비용 필드가 `total_cost_usd`인데, `cost_usd`로 파싱
- **수정**: `claude-worker.ts`에서 `total_cost_usd` 필드 + `usage.input_tokens` 파싱 추가

## Issue 2: .claudeignore 파일이 워크트리에 남아 리뷰 거절됨 — **해결됨**
- **증상**: 리뷰어가 scope 외 변경(.claudeignore)을 감지하여 REJECT (2회 연속)
- **원인**: `setupContextFilter()`가 워크트리에 .claudeignore를 생성, Claude가 커밋하거나 diff에 포함됨
- **수정 1차**: git rm으로 정리 → 삭제 변경이 diff에 포함되어 실패
- **수정 2차**: .gitignore에 .claudeignore 추가 + scope 검증에서 .claudeignore, .gitignore 제외
- **결과**: 3차 시도에서 APPROVE, merge, done까지 성공

## Issue 3: scope 검증이 HEAD 대비로만 동작 — **해결됨**
- **증상**: Claude가 커밋한 변경은 `git diff HEAD`에서 안 잡힘
- **수정**: `git diff baseBranch..HEAD`로 변경하여 전체 브랜치 diff 확인

## Issue 4: Night Worker stop→start 경쟁 조건 — **해결됨**
- **증상**: stop 후 즉시 start하면 이전 루프가 계속 실행되어 태스크가 중복 생성됨 (maxTasks=2인데 3개 생성)
- **원인**: stop()이 shouldStop 플래그만 설정하고 이전 runLoop Promise 완료를 기다리지 않음
- **수정**: run()에서 이전 loopPromise가 완료될 때까지 대기 후 새 루프 시작

## Issue 5: 리뷰 Claude CLI가 json 모드에서 빈 결과 반환 — **해결됨**
- **증상**: 리뷰가 exit=1, cost=$0.0000, 빈 result, duration 17분
- **원인**: `runClaudeJson`이 `--output-format json --print` 모드로 실행되는데, 리뷰어가 git diff 등 도구를 사용하면서 대화형으로 동작할 때 json 모드에서는 중간 출력이 캡처되지 않음
- **수정**: 리뷰도 `runClaudeStreamJson` (stream-json 모드)으로 변경하여 tool_use 포함 전체 대화 캡처

## Issue 6: 타임아웃 워치독이 프로세스를 종료하지 못함 — **해결됨**
- **증상**: 10분 타임아웃인데 16분 동안 실행됨
- **원인**: `process.kill(-proc.pid, "SIGTERM")`이 프로세스 그룹 킬을 시도하지만, detached 모드가 아닌 프로세스에서는 실패하고 catch에서 무시됨
- **수정**: `proc.kill("SIGTERM")`으로 직접 프로세스 킬하도록 변경

## Issue 7: Night Worker 시간 비교 로직이 UTC/로컬 시간 혼동 — **해결됨**
- **증상**: until="03:00"인데 오전 10시(KST)에 즉시 종료됨
- **원인**: Night Worker 로그에서 `toISOString().slice(11,19)`는 UTC 시간을 표시하지만, `getHours()`는 로컬(KST) 시간 반환. 시간 비교에서 "오전이면서 endTime 이후" 조건이 10:00 > 03:00으로 참이 됨
- **수정**: 시작 시간 기준으로 종료 시간을 Date 객체로 계산 (startDate.setHours(h,m) + 날짜 보정)
