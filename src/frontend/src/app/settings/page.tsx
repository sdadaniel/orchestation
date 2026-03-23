"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h1 className="text-sm font-semibold">Settings</h1>
      </div>
      <p className="text-xs text-muted-foreground">설정 페이지 (준비 중)</p>
    </div>
  );
}
