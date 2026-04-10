import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldRowProps {
  label: string;
  htmlFor?: string;
  description?: string;
  children: ReactNode;
}

/**
 * 라벨 + 입력 필드 + 설명 텍스트 조합 패턴.
 * settings, 폼 등에서 반복되는 space-y-1.5 패턴을 추출.
 */
export function FieldRow({ label, htmlFor, description, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground/60">{description}</p>
      )}
    </div>
  );
}
