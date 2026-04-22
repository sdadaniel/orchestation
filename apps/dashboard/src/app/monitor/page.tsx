"use client";

import { useEffect, useMemo } from "react";
import { Server, Monitor as MonitorIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MonitorDashboard } from "@/components/monitor/MonitorDashboard";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";
import { OrchestrateLogViewer } from "@/components/logs/OrchestrateLogViewer";

type MonitorTab = "server" | "monitor";

function ServerPanel() {
  return (
    <div className="space-y-3">
      <OrchestrateLogViewer title="Logs" />
    </div>
  );
}

export default function MonitorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo<MonitorTab>(() => {
    const raw = searchParams.get("tab");
    return raw === "monitor" || raw === "server" ? raw : "server";
  }, [searchParams]);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "monitor" || raw === "server") return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", "server");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const setTab = (nextTab: MonitorTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", nextTab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <PageLayout>
      <PageHeader title="Monitor" />

      <div className="flex items-center gap-1 border-b border-border">
        {[
          { key: "server" as const, label: "서버", icon: Server },
          { key: "monitor" as const, label: "모니터", icon: MonitorIcon },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "server" ? <ServerPanel /> : <MonitorDashboard />}
    </PageLayout>
  );
}
