"use client";

import { useState, useRef, useEffect } from "react";
import { Folder, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";

/* ── Props ── */

export interface NewItemInputProps {
  type: "doc" | "folder";
  onConfirm: (title: string) => void;
  onCancel: () => void;
}

/* ── Component ── */

export function NewItemInput({ type, onConfirm, onCancel }: NewItemInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="tree-item">
      {type === "folder" ? (
        <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
      ) : (
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <Input
        ref={inputRef}
        type="text"
        size="sm"
        value={value}
        placeholder={type === "folder" ? "New folder..." : "New document..."}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onConfirm(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (value.trim()) onConfirm(value.trim());
          else onCancel();
        }}
        className="border-primary px-1 py-0 flex-1"
      />
    </div>
  );
}
