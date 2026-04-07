# 신규 기능 제안: 태스크 실행 타임아웃

> 제안일: 2026-04-03
> 관련 파일: `src/frontend/src/lib/orchestrate-engine.ts`

## 배경

현재 `OrchestrateEngine`은 워커 프로세스에 대한 타임아웃이 없다. `startTask()`와 `startReview()`로 spawn된 프로세스가 무한히 실행될 수 있으며, `healthCheck()`는 프로세스 사망만 감지할 뿐 장시간 실행 중인 워커를 강제 종료하지 않는다.

이로 인해:
- Claude API 응답 지연 시 워커 슬롯이 영구 점유됨
- 비용 circuit breaker(`checkCostLimit`)는 review-rejected 시점에서만 동작하므로, 단일 긴 실행에는 무방비
- 대기 큐의 태스크들이 무기한 블록됨

## 제안

### 1. 태스크 frontmatter에 `timeout` 필드 추가

```yaml
---
id: TASK-340
timeout: 30m    # 기본값: settings.json의 defaultTimeout (예: 20m)
---
```

지원 형식: `10m`, `1h`, `90s`

### 2. Engine에 타임아웃 체크 로직 추가

`healthCheck()` 메서드에서 각 워커의 `startedAt`과 현재 시각을 비교하여, `timeout`을 초과한 워커를 `killProcessGracefully()`로 종료하고 `markTaskFailed(taskId, "타임아웃 초과")`로 처리한다.

```typescript
// healthCheck() 내 추가
const elapsed = Date.now() - entry.startedAt;
const timeout = this.getTaskTimeout(taskId); // frontmatter timeout 또는 default
if (elapsed > timeout) {
  this.log(`  ⏰ ${taskId}: 타임아웃 초과 (${Math.round(elapsed/60000)}분)`);
  killProcessGracefully(entry.process);
  this.markTaskFailed(taskId, "타임아웃 초과");
}
```

### 3. settings.json에 기본 타임아웃 설정

```json
{
  "defaultTaskTimeout": "20m",
  "defaultReviewTimeout": "15m"
}
```

## 영향 범위

- `orchestrate-engine.ts`: `healthCheck()` 수정, `getTaskTimeout()` 추가
- `settings.ts`: `defaultTaskTimeout`, `defaultReviewTimeout` 필드 추가
- `frontmatter-utils.ts`: timeout 파싱 유틸 (예: `"30m"` → `1800000`)

## 비용/복잡도

- 구현 난이도: 낮음 (기존 `healthCheck` 확장)
- 위험: 낮음 (타임아웃 미설정 시 기존 동작 유지)
