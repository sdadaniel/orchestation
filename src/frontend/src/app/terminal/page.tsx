"use client";

import { TerminalView } from "@/components/terminal/TerminalView";

export default function TerminalPage() {
  return (
    <div className="h-full -m-6 flex flex-col pb-[500px]">
      <TerminalView />
    </div>
  );
}
