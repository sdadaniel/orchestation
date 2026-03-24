"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Pencil, Check, X, Plus, Trash2 } from "lucide-react";

interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

type Step = "input" | "preview";

export default function NewTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AnalyzedTask[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleAnalyze = async () => {
    if (!title.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setTasks(data.tasks);
      setStep("preview");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      for (const task of tasks) {
        const content = [
          task.description,
          "",
          "## Completion Criteria",
          ...task.criteria.map((c) => `- ${c}`),
        ].join("\n");

        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            content,
            priority: task.priority,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create task");
        }
      }
      router.push("/tasks");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to create tasks");
    } finally {
      setConfirming(false);
    }
  };

  const updateTask = (idx: number, updates: Partial<AnalyzedTask>) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)),
    );
  };

  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      { title: "", description: "", priority: "medium", criteria: [""] },
    ]);
    setEditingIdx(tasks.length);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === "preview") {
              setStep("input");
            } else {
              router.push("/tasks");
            }
          }}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold">
          {step === "input" ? "New Task" : "AI Analysis Result"}
        </h1>
      </div>

      {/* Step 1: Input */}
      {step === "input" && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              What needs to be done?
            </label>
            <input
              type="text"
              placeholder="Task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleAnalyze();
              }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Details (optional)
            </label>
            <textarea
              placeholder="Describe the task in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary resize-y"
            />
          </div>

          {analyzeError && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
              {analyzeError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="filter-pill text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!title.trim() || analyzing}
              className={cn(
                "filter-pill text-xs flex items-center gap-1.5",
                title.trim() && !analyzing ? "active" : "opacity-50 cursor-not-allowed",
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
      )}

      {/* Step 2: AI Preview */}
      {step === "preview" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            AI has proposed {tasks.length} task{tasks.length !== 1 ? "s" : ""}. You can edit before confirming.
          </p>

          {tasks.map((task, idx) => (
            <TaskPreviewCard
              key={idx}
              task={task}
              index={idx}
              isEditing={editingIdx === idx}
              onEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
              onUpdate={(updates) => updateTask(idx, updates)}
              onRemove={() => removeTask(idx)}
              totalTasks={tasks.length}
            />
          ))}

          <button
            type="button"
            onClick={addTask}
            className="w-full rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3 w-3" />
            Add Task
          </button>

          {analyzeError && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
              {analyzeError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.push("/tasks")}
              className="filter-pill text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep("input")}
              className="filter-pill text-xs"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming || tasks.length === 0 || tasks.some((t) => !t.title.trim())}
              className={cn(
                "filter-pill text-xs flex items-center gap-1.5",
                !confirming && tasks.length > 0 && tasks.every((t) => t.title.trim())
                  ? "active"
                  : "opacity-50 cursor-not-allowed",
              )}
            >
              {confirming ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3" />
                  Confirm ({tasks.length} task{tasks.length !== 1 ? "s" : ""})
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskPreviewCard({
  task,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
  totalTasks,
}: {
  task: AnalyzedTask;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<AnalyzedTask>) => void;
  onRemove: () => void;
  totalTasks: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          Task {index + 1}
        </span>
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border font-medium",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {task.priority}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onEdit}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title={isEditing ? "Done editing" : "Edit"}
        >
          {isEditing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </button>
        {totalTasks > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400"
            title="Remove"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={task.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Task title..."
            className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-primary"
            autoFocus
          />
          <textarea
            value={task.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            rows={3}
            className="w-full bg-muted border border-border rounded px-2 py-1.5 text-sm outline-none focus:border-primary resize-y"
          />
          <select
            value={task.priority}
            onChange={(e) =>
              onUpdate({ priority: e.target.value as AnalyzedTask["priority"] })
            }
            className="bg-muted border border-border rounded px-2 py-1 text-xs outline-none"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Completion Criteria
            </label>
            {task.criteria.map((c, ci) => (
              <div key={ci} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <input
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const newCriteria = [...task.criteria];
                    newCriteria[ci] = e.target.value;
                    onUpdate({ criteria: newCriteria });
                  }}
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newCriteria = task.criteria.filter((_, i) => i !== ci);
                    onUpdate({ criteria: newCriteria });
                  }}
                  className="p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({ criteria: [...task.criteria, ""] })}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              Add criterion
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-medium">{task.title || "(Untitled)"}</h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          )}
          {task.criteria.length > 0 && (
            <div className="mt-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Completion Criteria:
              </span>
              <ul className="mt-1 space-y-0.5">
                {task.criteria.map((c, ci) => (
                  <li key={ci} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">-</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
