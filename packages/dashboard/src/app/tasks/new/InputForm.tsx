"use client";

import { cn } from "@/lib/utils";
import { Loader2, GitMerge } from "lucide-react";
import { DependsOnSelector } from "@/views/tasks/new/components";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useNewTaskPageGet,
  useNewTaskPageSet,
} from "@/views/tasks/new/hooks/useNewTaskPage";

export function InputForm() {
  const get = useNewTaskPageGet();
  const set = useNewTaskPageSet();

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div>
        <Label size="sm" className="block mb-1.5">
          What needs to be done?
        </Label>
        <Input
          type="text"
          placeholder="Task title..."
          value={get.title}
          onChange={(e) => set.setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && get.title.trim()) void set.handleAnalyze();
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
          value={get.description}
          onChange={(e) => set.setDescription(e.target.value)}
          rows={5}
        />
      </div>

      <div>
        <Label size="sm" className="block mb-1.5 flex items-center gap-1.5">
          <GitMerge className="h-3 w-3" />
          Depends On (optional)
        </Label>
        <DependsOnSelector
          selected={get.inputExternalDeps}
          onChange={set.setInputExternalDeps}
          tasks={get.existingTasks}
          placeholder="Select tasks this depends on..."
        />
        {get.inputExternalDeps.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Applied to first task in the analysis result
          </p>
        )}
      </div>

      {get.analyzeError && (
        <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
          {get.analyzeError}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={set.goToTasks}
          className="filter-pill text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void set.handleAnalyze()}
          disabled={!get.title.trim() || get.analyzing}
          className={cn(
            "filter-pill text-xs flex items-center gap-1.5",
            get.title.trim() && !get.analyzing
              ? "active"
              : "opacity-50 cursor-not-allowed",
          )}
        >
          {get.analyzing ? (
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
