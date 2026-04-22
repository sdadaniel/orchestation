import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/ui/toast";
import { QueryProvider } from "@/providers/QueryProvider";
import { SseProvider } from "@/providers/SseProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestration Dashboard",
  description: "오케스트레이션 대시보드",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="h-screen overflow-hidden">
        <QueryProvider>
          <SseProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </SseProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
