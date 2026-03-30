# 프론트엔드 console 디버그 문 분석 보고서

## 요약

프론트엔드 클라이언트 컴포넌트 4개 파일에서 총 7건의 `console.error`/`console.warn` 호출이 프로덕션 브라우저에 노출되고 있다.

## 대상 파일 및 위치

### 1. `src/frontend/src/app/tasks/[id]/page.tsx` (4건)
| 라인 | 호출 | 내용 |
|------|------|------|
| 93 | `console.error` | `[TaskDetail] checkRunStatus error:` |
| 106 | `console.error` | `[TaskDetail] handleRunStatusChange refetch error:` |
| 151 | `console.warn` | `Stop failed:` |
| 155 | `console.error` | `[TaskDetail] handleStop error:` |

### 2. `src/frontend/src/app/tasks/new/page.tsx` (1건)
| 라인 | 호출 | 내용 |
|------|------|------|
| 45 | `console.error` | `[NewTask] existingTasks fetch error:` |

### 3. `src/frontend/src/components/DAGCanvas.tsx` (1건)
| 라인 | 호출 | 내용 |
|------|------|------|
| 237 | `console.error` | `[DAGCanvas] settings fetch error:` |

### 4. `src/frontend/src/components/sidebar/DocTreeNode.tsx` (1건)
| 라인 | 호출 | 내용 |
|------|------|------|
| 118 | `console.error` | `Reorder failed:` |

## 범위 외 (서버 사이드 — 변경 불필요)

- `src/frontend/src/app/api/chat/route.ts` (2건) — API route, 서버 로그
- `src/frontend/src/app/api/tasks/analyze/route.ts` (3건) — API route, 서버 로그
- `src/frontend/src/app/api/tasks/suggest/route.ts` (3건) — API route, 서버 로그
- `src/frontend/src/lib/task-runner-utils.ts` (3건) — 서버 유틸리티
- `src/frontend/src/lib/orchestration-manager.ts` (1건) — 서버 유틸리티

## 권장 조치

각 console 호출을 제거하거나 개발 환경 조건부로 래핑:
```typescript
if (process.env.NODE_ENV === "development") {
  console.error("[TaskDetail] checkRunStatus error:", err);
}
```

catch 블록의 에러 핸들링 로직 자체는 변경하지 않는다.
