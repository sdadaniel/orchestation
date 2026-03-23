"use client";

import { useEffect, useState } from "react";
import type { CostData } from "@/lib/cost-parser";

type UseCostsResult = {
  data: CostData | null;
  isLoading: boolean;
  error: string | null;
};

export function useCosts(): UseCostsResult {
  const [data, setData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch("/api/costs");

        if (!res.ok) {
          throw new Error("비용 데이터를 불러오는데 실패했습니다.");
        }

        const costData: CostData = await res.json();

        if (!cancelled) {
          setData(costData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "알 수 없는 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
