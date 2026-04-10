import { cn } from "@/lib/utils";
import { Loader2, GitMerge } from "lucide-react";
import { DependsOnSelector } from "@/components/DependsOnSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { TaskOption } from "./types";

export interface InputFormProps {
  title: string;
  description: string;
  analyzing: boolean;
  analyzeError: string | null;
  inputExternalDeps: string[];
  existingTasks: TaskOption[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onExternalDepsChange: (ids: string[]) => void;
  onAnalyze: () => void;
  onCancel: () => void;
}

export function InputForm({
  title,
  description,
  analyzing,
  analyzeError,
  inputExternalDeps,
  existingTasks,
  onTitleChange,
  onDescriptionChange,
  onExternalDepsChange,
  onAnalyze,
  onCancel,
}: InputFormProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <Label size="sm" className="block mb-1.5">
          What needs to be done?
        </Label>
        <Input
          type="text"
          placeholder="Task title..."
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) onAnalyze();
          }}
          autoFocus
        />
      </div>

      <div>
        <Label size="sm" className="block mb-1.5">
          Details (optional)
        </Label>
        <Textarea
          placeholder="Describe the task in detail..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={5}
        />
      </div>

      <div>
        <Label size="sm" className="block mb-1.5 flex items-center gap-1.5">
          <GitMerge className="h-3 w-3" />
          Depends On (optional)
        </Label>
        <DependsOnSelector
          selected={inputExternalDeps}
          onChange={onExternalDepsChange}
          tasks={existingTasks}
          placeholder="Select tasks this depends on..."
        />
        {inputExternalDeps.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Applied to first task in the analysis result
          </p>
        )}
      </div>

      {analyzeError && (
        <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
          {analyzeError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="filter-pill text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!title.trim() || analyzing}
          className={cn(
            "filter-pill text-xs flex items-center gap-1.5",
            title.trim() && !analyzing
              ? "active"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {analyzing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            "Analyze"
          )}
        </button>
      </div>
    </div>
  );
}
