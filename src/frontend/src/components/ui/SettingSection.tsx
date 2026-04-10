import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface SettingSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * 설정 섹션 그룹 패턴.
 * Label(size="section") + space-y-4 필드 그룹 조합 추출.
 */
export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className="space-y-4">
      <Label size="section">{title}</Label>
      {children}
    </div>
  );
}
