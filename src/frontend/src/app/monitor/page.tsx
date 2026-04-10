"use client";

import { MonitorDashboard } from "@/components/monitor/MonitorDashboard";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

export default function MonitorPage() {
  return (
    <PageLayout>
      <PageHeader title="Monitor" />
      <MonitorDashboard />
    </PageLayout>
  );
}
