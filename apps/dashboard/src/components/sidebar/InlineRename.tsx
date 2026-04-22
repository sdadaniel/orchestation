"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

/* ── Props ── */

export interface InlineRenameProps {
  initialValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/* ── Component ── */

export function InlineRename({
  initialValue,
  onConfirm,
  onCancel,
}: InlineRenameProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <Input
      ref={inputRef}
      type="text"
      size="sm"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (value.trim()) onConfirm(value.trim());
        else onCancel();
      }}
      className="border-primary px-1 py-0"
    />
  );
}
