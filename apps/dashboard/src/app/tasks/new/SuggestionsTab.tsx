import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Sparkles,
  CheckSquare,
  Square as SquareIcon,
} from "lucide-react";
import { PRIORITY_COLORS, CATEGORY_ICON, EFFORT_LABEL } from "./types";

interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: string;
  effort: string;
  scope: string[];
}

export interface SuggestionsTabProps {
  suggestions: Suggestion[];
  suggestLoading: boolean;
  suggestError: string | null;
  selectedSuggestions: Set<number>;
  creatingSuggestions: boolean;
  onSuggest: () => void;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateFromSuggestions: () => void;
}

export function SuggestionsTab({
  suggestions,
  suggestLoading,
  suggestError,
  selectedSuggestions,
  creatingSuggestions,
  onSuggest,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onCreateFromSuggestions,
}: SuggestionsTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        프로젝트를 분석하여 개선이 필요한 항목을 추천합니다. 원하는 항목을
        선택하여 태스크로 생성하세요.
      </p>

      {!suggestLoading && suggestions.length === 0 && (
        <button
          type="button"
          onClick={onSuggest}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/25 transition-colors font-medium"
        >
          <Sparkles className="h-3.5 w-3.5" />
          추천받기
        </button>
      )}

      {suggestLoading && (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">프로젝트 분석 중... (1-2분 소요)</span>
        </div>
      )}

      {suggestError && (
        <div className="text-xs text-red-400">{suggestError}</div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {suggestions.length}개 추천 / {selectedSuggestions.size}개 선택
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedSuggestions.size === suggestions.length)
                  onDeselectAll();
                else onSelectAll();
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedSuggestions.size === suggestions.length
                ? "전체 해제"
                : "전체 선택"}
            </button>
          </div>

          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onToggle(i)}
                className={cn(
                  "w-full text-left rounded-lg border p-3 transition-colors",
                  selectedSuggestions.has(i)
                    ? "border-yellow-500/40 bg-yellow-500/5"
                    : "border-border hover:border-border/80",
                )}
              >
                <div className="flex items-start gap-3">
                  {selectedSuggestions.has(i) ? (
                    <CheckSquare className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  ) : (
                    <SquareIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{CATEGORY_ICON[s.category] || "\uD83D\uDCCB"}</span>
                      <span className="text-sm font-medium">{s.title}</span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0",
                          PRIORITY_COLORS[s.priority],
                        )}
                      >
                        {s.priority}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {EFFORT_LABEL[s.effort] || s.effort}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {s.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {s.scope.map((p, j) => (
                        <span
                          key={j}
                          className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedSuggestions.size > 0 && (
            <button
              type="button"
              onClick={onCreateFromSuggestions}
              disabled={creatingSuggestions}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium",
                creatingSuggestions && "opacity-50 cursor-not-allowed",
              )}
            >
              {creatingSuggestions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              선택한 {selectedSuggestions.size}개 태스크 생성
            </button>
          )}
        </>
      )}
    </div>
  );
}
