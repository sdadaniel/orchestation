"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { makeQueryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState로 QueryClient를 초기화하여 컴포넌트 마운트마다 재생성 방지
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools: 개발 환경에서만 표시 (프로덕션 빌드에서 자동 제거됨) */}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
}
