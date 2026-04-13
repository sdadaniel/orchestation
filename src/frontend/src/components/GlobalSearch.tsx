"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, FileTextIcon, ListTodoIcon } from "lucide-react";
import type { RequestItem } from "@/hooks/useRequests";
import type { DocNode } from "@/hooks/useDocTree";
import { cn } from "@/lib/utils";

/* ── Types ── */

type SearchResultItem = {
  type: "task" | "doc";
  id: string;
  displayId: string;
  title: string;
  status?: string;
  href: string;
};

type Props = {
  requestItems: RequestItem[];
  docTree: DocNode[];
};

/* ── Helpers ── */

function flattenDocs(nodes: DocNode[]): { id: string; title: string }[] {
  const result: { id: string; title: string }[] = [];
  for (const node of nodes) {
    if (node.type === "doc") {
      result.push({ id: node.id, title: node.title });
    }
    if (node.children?.length) {
      result.push(...flattenDocs(node.children));
    }
  }
  return result;
}

function padId(num: string): string {
  return num.padStart(3, "0");
}

/* ── Component ── */

export function GlobalSearch({ requestItems, docTree }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build searchable items
  const allItems = useMemo<SearchResultItem[]>(() => {
    const tasks: SearchResultItem[] = requestItems.map((r) => ({
      type: "task",
      id: r.id,
      displayId: r.id,
      title: r.title,
      status: r.status,
      href: `/tasks/${r.id}`,
    }));

    const docs: SearchResultItem[] = flattenDocs(docTree).map((d) => ({
      type: "doc",
      id: d.id,
      displayId: d.id,
      title: d.title,
      href: `/docs/${d.id}`,
    }));

    return [...tasks, ...docs];
  }, [requestItems, docTree]);

  // Filter results based on query
  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Prefix search: task:XXX or t:XXX
    const taskMatch = q.match(/^(?:task|t):(\d*)$/);
    if (taskMatch) {
      const num = taskMatch[1];
      if (!num) return allItems.filter((i) => i.type === "task");
      const padded = padId(num);
      return allItems.filter(
        (i) => i.type === "task" && i.displayId.includes(padded),
      );
    }

    // Prefix search: doc:XXX or d:XXX
    const docMatch = q.match(/^(?:doc|d):(.*)$/);
    if (docMatch) {
      const sub = (docMatch[1] ?? "").trim();
      if (!sub) return allItems.filter((i) => i.type === "doc");
      return allItems.filter(
        (i) =>
          i.type === "doc" &&
          (i.title.toLowerCase().includes(sub) ||
            i.id.toLowerCase().includes(sub)),
      );
    }

    // General search: match title or id
    return allItems.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.displayId.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q),
    );
  }, [query, allItems]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement;
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const navigate = useCallback(
    (item: SearchResultItem) => {
      router.push(item.href);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) navigate(item);
    }
  }

  const statusColors: Record<string, string> = {
    stopped: "text-violet-500 bg-violet-500/10",
    in_progress: "text-blue-500 bg-blue-500/10",
    pending: "text-yellow-500 bg-yellow-500/10",
    reviewing: "text-orange-400 bg-orange-400/10",
    done: "text-emerald-500 bg-emerald-500/10",
    rejected: "text-red-500 bg-red-500/10",
  };

  const statusLabel: Record<string, string> = {
    stopped: "중지",
    in_progress: "진행중",
    pending: "대기",
    reviewing: "리뷰",
    done: "완료",
    rejected: "반려",
  };

  return (
    <div className="global-search-wrapper">
      <div
        className={cn(
          "global-search",
          isOpen && results.length > 0 && "search-open",
        )}
      >
        <SearchIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="검색 — task:001, doc:제목 (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.trim() && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <>
          <div className="search-backdrop" onClick={() => setIsOpen(false)} />
          <div className="search-dropdown" ref={listRef}>
            {(() => {
              const sliced = results.slice(0, 20);
              const taskItems = sliced.filter((i) => i.type === "task");
              const docItems = sliced.filter((i) => i.type === "doc");
              const hasBoth = taskItems.length > 0 && docItems.length > 0;
              let globalIdx = 0;

              return (
                <>
                  {taskItems.length > 0 && (
                    <>
                      {hasBoth && (
                        <div className="search-group-label">Tasks</div>
                      )}
                      {taskItems.map((item) => {
                        const idx = sliced.indexOf(item);
                        globalIdx++;
                        return (
                          <button
                            key={`task-${item.id}`}
                            className={cn(
                              "search-item",
                              idx === activeIndex && "search-item-active",
                            )}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => navigate(item)}
                          >
                            <span className="search-item-icon">
                              <ListTodoIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="search-item-id font-mono">
                              {item.displayId}
                            </span>
                            <span className="search-item-title">
                              {item.title}
                            </span>
                            {item.status && (
                              <span
                                className={cn(
                                  "search-item-status",
                                  statusColors[item.status],
                                )}
                              >
                                {statusLabel[item.status] || item.status}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {docItems.length > 0 && (
                    <>
                      {hasBoth && (
                        <div className="search-group-label">Docs</div>
                      )}
                      {docItems.map((item) => {
                        const idx = sliced.indexOf(item);
                        return (
                          <button
                            key={`doc-${item.id}`}
                            className={cn(
                              "search-item",
                              idx === activeIndex && "search-item-active",
                            )}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => navigate(item)}
                          >
                            <span className="search-item-icon">
                              <FileTextIcon className="h-3.5 w-3.5" />
                            </span>
                            <span className="search-item-id font-mono">
                              {item.displayId}
                            </span>
                            <span className="search-item-title">
                              {item.title}
                            </span>
                            <span className="search-item-type">Doc</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </>
              );
            })()}
            {results.length > 20 && (
              <div className="search-more">
                +{results.length - 20}개 더 있음
              </div>
            )}
          </div>
        </>
      )}

      {/* No results */}
      {isOpen && query.trim() && results.length === 0 && (
        <>
          <div className="search-backdrop" onClick={() => setIsOpen(false)} />
          <div className="search-dropdown">
            <div className="search-empty">검색 결과 없음</div>
          </div>
        </>
      )}
    </div>
  );
}
