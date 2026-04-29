"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Terminal, Monitor } from "lucide-react";
import { OrchestrateLogViewer } from "@/components/Logs/OrchestrateLogViewer";
import { MonitorDashboard } from "@/components/Monitor/MonitorDashboard";
import { Tabs } from "@/components/ui";
import { useLogsStore } from "@/store/logsStore";

export default function LogPageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lineCount = useLogsStore((s) => s.lines.length);
  const applyIncoming = useLogsStore((s) => s.applyIncoming);
  const [activeTab, setActiveTab] = useState<"monitor" | "log">("log");

  const queryTab = useMemo(() => {
    const tab = searchParams.get("tab");
    const tap = searchParams.get("tap");
    const value = tab ?? tap;
    return value === "monitor" || value === "log" ? value : null;
  }, [searchParams]);

  useEffect(() => {
    if (queryTab) {
      setActiveTab(queryTab);
      if (searchParams.get("tap")) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tap");
        params.set("tab", queryTab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "log");
    params.delete("tap");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setActiveTab("log");
  }, [pathname, queryTab, router, searchParams]);

  useEffect(() => {
    if (lineCount > 0) return;
    let cancelled = false;
    fetch("/api/orchestrate/logs?limit=200", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { logs?: string[]; total?: number };
        if (cancelled || !Array.isArray(data.logs) || data.logs.length === 0) return;
        applyIncoming({
          logs: data.logs,
          total: typeof data.total === "number" ? data.total : data.logs.length,
        });
      })
      .catch(() => {
        // ignore; websocket stream still provides live updates
      });
    return () => {
      cancelled = true;
    };
  }, [applyIncoming, lineCount]);

  const handleTabChange = (nextTab: "monitor" | "log") => {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    params.delete("tap");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="h-full -m-6 flex flex-col pb-[300px]">
      <div className="px-6 pt-3">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            { key: "log", label: "로그", icon: Terminal },
            { key: "monitor", label: "Monitor", icon: Monitor },
          ]}
        />
      </div>

      <div className="px-6 py-3">
        {activeTab === "monitor" ? <MonitorDashboard /> : <OrchestrateLogViewer />}
      </div>
    </div>
  );
}
