"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskOption {
  id: string;
  title: string;
  status: string;
}

interface DependsOnSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  tasks: TaskOption[];
  placeholder?: string;
  className?: string;
}

export function DependsOnSelector({
  selected,
  onChange,
  tasks,
  placeholder = "Search existing tasks...",
  className,
}: DependsOnSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = tasks.filter((t) => {
    if (selected.includes(t.id)) return false;
    const q = query.toLowerCase();
    return t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q);
  });

  const add = (id: string) => {
    onChange([...selected, id]);
    setQuery("");
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  const selectedTasks = selected
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as TaskOption[];

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Selected chips + input */}
      <div
        className={cn(
          "min-h-[34px] flex flex-wrap gap-1 items-center bg-muted border border-border rounded px-2 py-1 cursor-text",
          open && "border-primary",
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedTasks.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1 text-[11px] bg-primary/15 text-primary border border-primary/30 rounded px-1.5 py-0.5 font-mono"
          >
            {t.id}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(t.id);
              }}
              className="hover:text-red-400"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded border border-border bg-popover shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {query ? "No tasks found" : "No more tasks to add"}
            </div>
          ) : (
            filtered.slice(0, 30).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => add(t.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
              >
                <span className="font-mono text-muted-foreground shrink-0">{t.id}</span>
                <span className="truncate">{t.title}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-[10px] px-1 rounded",
                    t.status === "done" && "bg-green-500/15 text-green-500",
                    t.status === "in_progress" && "bg-blue-500/15 text-blue-500",
                    t.status === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {t.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
