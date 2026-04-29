"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Terminal, Monitor } from "lucide-react";
import { OrchestrateLogViewer } from "@/components/Logs/OrchestrateLogViewer";
import { MonitorDashboard } from "@/components/Monitor/MonitorDashboard";
import { Tabs } from "@/components/ui";

export default function LogPageView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
