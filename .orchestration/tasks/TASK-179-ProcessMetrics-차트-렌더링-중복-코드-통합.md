---
id: TASK-179
title: "ProcessMetrics 차트 렌더링 중복 코드 통합"
status: done
branch: task/task-179
worktree: ../repo-wt-task-179
priority: medium
mode: night
created: 2026-03-25
updated: 2026-03-25
depends_on: []
scope:
  - src/frontend/src/components/monitor/ProcessMetrics.tsx
---

`ProcessMetrics.tsx` (365줄)에서 CPU/Memory 차트 4개가 거의 동일한 구조로 반복되고 있다.

### 중복 패턴

**1. BarChart 쌍 (109~192줄, ~80줄 중복)**
- CPU BarChart (117~146줄)와 Memory BarChart (160~189줄)
- 차이점: `dataKey="cpu"` vs `"mem"`, YAxis `width={30}` vs `{35}`, formatter 단위 `%` vs `MB`

**2. LineChart 쌍 (197~319줄, ~120줄 중복)**
- CPU LineChart (206~254줄)와 Memory LineChart (268~316줄)
- 차이점: prefix `"cpu_"` vs `"mem_"`, formatter 값 `value.toFixed(1)` + `%` vs `value.toFixed(0)` + ` MB`, YAxis `width={30}` vs `{35}`

### 개선 방안

각 차트 쌍을 config 객체 배열로 추상화하여 `.map()`으로 렌더링한다.

```ts
const barChartConfigs = [
  { title: "CPU per Terminal", unit: "Percent", dataKey: "cpu", yAxisWidth: 30, formatValue: (v) => `${v}%` },
  { title: "Memory per Terminal", unit: "MB", dataKey: "mem", yAxisWidth: 35, formatValue: (v) => `${v} MB` },
];
```

LineChart도 동일 패턴으로 prefix, formatter, width만 파라미터화한다.

### 효과
- ~150줄 감소 (365줄 → ~215줄 예상)
- 버그 수정이 한 곳에서 적용됨
- 새로운 메트릭 추가 시 config 항목만 추가

## Completion Criteria
- BarChart 렌더링이 config 기반 `.map()`으로 통합되어 중복 제거
- LineChart 렌더링이 config 기반 `.map()`으로 통합되어 중복 제거
- 기존과 동일한 UI 출력 (시각적 변경 없음)
- TypeScript 컴파일 에러 없음
