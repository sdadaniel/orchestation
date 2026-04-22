import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 기본 staleTime: 5s (각 쿼리에서 오버라이드 가능)
        staleTime: 5_000,
        // garbage collection: 5분
        gcTime: 5 * 60_000,
        // 실패 시 최대 2회 재시도
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
        // 창 포커스 시 refetch 활성화
        refetchOnWindowFocus: true,
        // 재연결 시 refetch
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

// 서버/클라이언트 경계에서 싱글톤 관리
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    // 서버: 항상 새 인스턴스
    return makeQueryClient();
  }
  // 클라이언트: 싱글톤
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
