---
id: REQ-027
title: Monitor API ps 파싱 안정화
status: done
priority: medium
created: 2026-03-24
---
monitor API에서 ps aux 출력 파싱 시 parts[1]이 숫자가 아닐 경우 NaN PID 발생.

## 문제
- `api/monitor/route.ts:30-46`
- ps 출력 포맷이 예상과 다를 경우 parseInt 결과가 NaN
- NaN PID로 후속 로직 오동작 가능

## Completion Criteria
- parseInt 결과 NaN 체크 후 해당 라인 스킵
- 예상 외 포맷에 대한 방어 코드 추가
