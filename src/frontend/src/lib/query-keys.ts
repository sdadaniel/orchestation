/**
 * 중앙 집중식 Query Key 팩토리
 *
 * 모든 쿼리 키는 이 파일에서 관리합니다.
 * invalidation 시 상위 키를 사용하면 하위 쿼리도 함께 무효화됩니다.
 *
 * 예) queryClient.invalidateQueries({ queryKey: queryKeys.requests.all })
 *     → requests 하위 모든 쿼리 무효화
 */
export const queryKeys = {
  // 태스크 목록 (waterfall groups)
  tasks: {
    all: ["tasks"] as const,
    list: () => [...queryKeys.tasks.all, "list"] as const,
  },

  // 요청(태스크) 목록
  requests: {
    all: ["requests"] as const,
    list: () => [...queryKeys.requests.all, "list"] as const,
    detail: (id: string) => [...queryKeys.requests.all, id] as const,
  },

  // 오케스트레이션 상태
  orchestration: {
    all: ["orchestration"] as const,
    status: () => [...queryKeys.orchestration.all, "status"] as const,
  },

  // 알림
  notices: {
    all: ["notices"] as const,
    list: () => [...queryKeys.notices.all, "list"] as const,
  },

  // 비용
  costs: {
    all: ["costs"] as const,
    list: () => [...queryKeys.costs.all, "list"] as const,
  },

  // 실행 이력
  runHistory: {
    all: ["run-history"] as const,
    list: () => [...queryKeys.runHistory.all, "list"] as const,
  },

  // 시스템 모니터링
  monitor: {
    all: ["monitor"] as const,
    current: () => [...queryKeys.monitor.all, "current"] as const,
  },

  // 문서 트리
  docs: {
    all: ["docs"] as const,
    tree: () => [...queryKeys.docs.all, "tree"] as const,
    detail: (id: string) => [...queryKeys.docs.all, id] as const,
  },

  // PRD 목록
  prds: {
    all: ["prds"] as const,
    list: () => [...queryKeys.prds.all, "list"] as const,
  },

  // 태스크 상세 로그
  taskLogs: {
    all: ["task-logs"] as const,
    byId: (id: string) => [...queryKeys.taskLogs.all, id] as const,
  },

  // 플랜
  plans: {
    all: ["plans"] as const,
    list: () => [...queryKeys.plans.all, "list"] as const,
    detail: (id: string) => [...queryKeys.plans.all, id] as const,
  },
} as const;
