"use client";

import { useEffect, useState } from "react";

export interface Prd {
  id: string;
  title: string;
  status: string;
  sprints: string[];
  content: string;
}

export function usePrds() {
  const [prds, setPrds] = useState<Prd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch("/api/prds");
        if (!res.ok) throw new Error("PRD 데이터를 불러오는데 실패했습니다.");
        const data: Prd[] = await res.json();
        if (!cancelled) {
          setPrds(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류 발생");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { prds, isLoading, error };
}
