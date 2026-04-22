"use client";

import { OrchestrateLogViewer } from "@/components/logs/OrchestrateLogViewer";
import { PageLayout, PageHeader } from "@/components/ui/page-layout";

export default function LogsPage() {
  return (
    <PageLayout>
      <PageHeader title="Logs" />
      <OrchestrateLogViewer />
    </PageLayout>
  );
}

