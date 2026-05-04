import { Suspense } from "react";
import LogPageView from "@/views/log";

export default function LogPage() {
  return (
    <Suspense fallback={null}>
      <LogPageView />
    </Suspense>
  );
}
