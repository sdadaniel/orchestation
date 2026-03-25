"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Pencil, Check, X, Plus, Trash2, GitMerge, Sparkles, CheckSquare, Square as SquareIcon } from "lucide-react";
import { DependsOnSelector, type TaskOption } from "@/components/DependsOnSelector";

interface AnalyzedTask {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  criteria: string[];
  scope?: string[];
  /** Within-batch dependency indices (0-based) */
  depends_on?: number[];
  /** Pre-existing TASK-XXX IDs this task depends on */
  external_depends_on?: string[];
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-green-500/15 text-green-500 border-green-500/30",
};

type Step = "input" | "preview";

interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: "high" | "medium" | "low";
  scope: string[];
  effort: "small" | "medium" | "large";
}

const CATEGORY_ICON: Record<string, string> = {
  bug: "🐛", refactor: "🔄", performance: "⚡", test: "🧪",
  docs: "📝", ux: "🎨", security: "🔒", cleanup: "🧹",
};

const EFFORT_LABEL: Record<string, string> = {
  small: "30분 이내", medium: "1-2시간", large: "반나절+",
};

export default function NewTaskPage() {
  const router = useRouter();
  const [pageTab, setPageTab] = useState<"write" | "suggest">("write");
  const [step, setStep] = useState<Step>("input");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AnalyzedTask[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Suggest tab state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [creatingSuggestions, setCreatingSuggestions] = useState(false);

  const handleSuggest = async () => {
    setSuggestLoading(true);
    setSuggestError(null);
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    try {
      const res = await fetch("/api/tasks/suggest", { method: "POST" });
      const data = await res.json();
      if (data.error) setSuggestError(data.error);
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {
      setSuggestError("추천 요청 실패");
    } finally {
      setSuggestLoading(false);
    }
  };

  const toggleSuggestion = (idx: number) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const createFromSuggestions = async () => {
    setCreatingSuggestions(true);
    try {
      for (const idx of selectedSuggestions) {
        const s = suggestions[idx];
        const content = [
          s.description,
          "",
          `**카테고리:** ${s.category}`,
          `**예상 작업량:** ${EFFORT_LABEL[s.effort] || s.effort}`,
          "",
          "## Completion Criteria",
          "- 위 설명의 개선 사항이 반영되었다",
        ].join("\n");

        await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: s.title,
            content,
            priority: s.priority,
            scope: s.scope,
            depends_on: [],
          }),
        });
      }
      router.push("/tasks");
    } catch {
      setSuggestError("태스크 생성 실패");
    } finally {
      setCreatingSuggestions(false);
    }
  };

  // Existing tasks for depends_on selection
  const [existingTasks, setExistingTasks] = useState<TaskOption[]>([]);
  // External deps selected on input step (applied to first task after analysis)
  const [inputExternalDeps, setInputExternalDeps] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TaskOption[]) => {
        if (Array.isArray(data)) setExistingTasks(data);
      })
      .catch(() => {});
  }, []);

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
      const analyzedTasks: AnalyzedTask[] = data.tasks;

      // Apply inputExternalDeps to the first task
      if (inputExternalDeps.length > 0 && analyzedTasks.length > 0) {
        analyzedTasks[0] = {
          ...analyzedTasks[0],
          external_depends_on: inputExternalDeps,
        };
      }

      setTasks(analyzedTasks);
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
      const createdIds: string[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const content = [
          task.description,
          "",
          "## Completion Criteria",
          ...task.criteria.map((c) => `- ${c}`),
        ].join("\n");

        // Resolve within-batch depends_on indices to actual TASK IDs
        const resolvedBatchDeps = (task.depends_on ?? [])
          .filter((idx) => idx >= 0 && idx < createdIds.length)
          .map((idx) => createdIds[idx]);

        // Merge with pre-existing external deps
        const dependsOn = [...resolvedBatchDeps, ...(task.external_depends_on ?? [])];

        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            content,
            priority: task.priority,
            scope: task.scope ?? [],
            depends_on: dependsOn,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create task");
        }
        const created = await res.json();
        createdIds.push(created.id);
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
    <div className="space-y-4 max-w-3xl mx-auto">
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
          {pageTab === "suggest" ? "태스크 추천" : step === "input" ? "New Task" : "AI Analysis Result"}
        </h1>
      </div>

      {/* Page Tabs */}
      {step === "input" && (
        <div className="flex items-center gap-1 border-b border-border">
          <button type="button" onClick={() => setPageTab("write")} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors", pageTab === "write" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Pencil className="h-3 w-3" />
            직접 작성
          </button>
          <button type="button" onClick={() => setPageTab("suggest")} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors", pageTab === "suggest" ? "border-yellow-400 text-yellow-400" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Sparkles className="h-3 w-3" />
            추천받기
          </button>
        </div>
      )}

      {/* Suggest Tab */}
      {pageTab === "suggest" && step === "input" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">프로젝트를 분석하여 개선이 필요한 항목을 추천합니다. 원하는 항목을 선택하여 태스크로 생성하세요.</p>

          {!suggestLoading && suggestions.length === 0 && (
            <button
              type="button"
              onClick={handleSuggest}
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
                <span className="text-xs text-muted-foreground">{suggestions.length}개 추천 / {selectedSuggestions.size}개 선택</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSuggestions.size === suggestions.length) setSelectedSuggestions(new Set());
                    else setSelectedSuggestions(new Set(suggestions.map((_, i) => i)));
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {selectedSuggestions.size === suggestions.length ? "전체 해제" : "전체 선택"}
                </button>
              </div>

              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSuggestion(i)}
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
                          <span>{CATEGORY_ICON[s.category] || "📋"}</span>
                          <span className="text-sm font-medium">{s.title}</span>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0", PRIORITY_COLORS[s.priority])}>{s.priority}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{EFFORT_LABEL[s.effort] || s.effort}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1.5">{s.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {s.scope.map((p, j) => (
                            <span key={j} className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
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
                  onClick={createFromSuggestions}
                  disabled={creatingSuggestions}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium",
                    creatingSuggestions && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {creatingSuggestions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  선택한 {selectedSuggestions.size}개 태스크 생성
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 1: Input (직접 작성) */}
      {step === "input" && pageTab === "write" && (
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

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <GitMerge className="h-3 w-3" />
              Depends On (optional)
            </label>
            <DependsOnSelector
              selected={inputExternalDeps}
              onChange={setInputExternalDeps}
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
          {/* 원본 입력 표시 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">원본 입력</div>
            <div className="text-sm font-medium">{title}</div>
            {description && (
              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{description}</div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            AI가 {tasks.length}개 Task로 분해했습니다. 수정 후 컨펌하세요.
            {tasks.length > 1 && " (위에서 아래 순서로 실행됩니다)"}
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
              existingTasks={existingTasks}
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
  existingTasks,
}: {
  task: AnalyzedTask;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<AnalyzedTask>) => void;
  onRemove: () => void;
  totalTasks: number;
  existingTasks: TaskOption[];
}) {
  // Within-batch deps labels: "Step N"
  const batchDepLabels = (task.depends_on ?? []).map((i) => `Step ${i + 1}`);
  const externalDeps = task.external_depends_on ?? [];
  const hasDeps = batchDepLabels.length > 0 || externalDeps.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">
          {totalTasks > 1 ? `Step ${index + 1}/${totalTasks}` : "Task"}
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

          {/* Depends On (external) - edit */}
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <GitMerge className="h-3 w-3" />
              Depends On (existing tasks)
            </label>
            <DependsOnSelector
              selected={externalDeps}
              onChange={(ids) => onUpdate({ external_depends_on: ids })}
              tasks={existingTasks}
              placeholder="Add dependency..."
            />
          </div>

          {/* Within-batch deps - edit as checkboxes */}
          {totalTasks > 1 && (
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Within-batch dependencies
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: totalTasks }, (_, i) => i).filter((i) => i !== index).map((i) => {
                  const checked = (task.depends_on ?? []).includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const cur = task.depends_on ?? [];
                        onUpdate({
                          depends_on: checked
                            ? cur.filter((d) => d !== i)
                            : [...cur, i].sort((a, b) => a - b),
                        });
                      }}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded border transition-colors",
                        checked
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/40",
                      )}
                    >
                      Step {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Scope (작업 범위 파일)
            </label>
            {(task.scope ?? []).map((s, si) => (
              <div key={si} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <input
                  type="text"
                  value={s}
                  onChange={(e) => {
                    const newScope = [...(task.scope ?? [])];
                    newScope[si] = e.target.value;
                    onUpdate({ scope: newScope });
                  }}
                  className="flex-1 bg-muted border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newScope = (task.scope ?? []).filter((_, i) => i !== si);
                    onUpdate({ scope: newScope });
                  }}
                  className="p-0.5 text-muted-foreground hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdate({ scope: [...(task.scope ?? []), ""] })}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" />
              Add file
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-medium">{task.title || "(Untitled)"}</h3>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
          )}

          {/* Depends On - view mode */}
          {hasDeps && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <GitMerge className="h-3 w-3" />
                Depends on:
              </span>
              {batchDepLabels.map((label, i) => (
                <span
                  key={`batch-${i}`}
                  className="text-[11px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border font-mono"
                >
                  {label}
                </span>
              ))}
              {externalDeps.map((id) => (
                <span
                  key={id}
                  className="text-[11px] px-1.5 py-0.5 rounded border bg-primary/15 text-primary border-primary/30 font-mono"
                >
                  {id}
                </span>
              ))}
            </div>
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
          {(task.scope?.length ?? 0) > 0 && (
            <div className="mt-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                Scope:
              </span>
              <ul className="mt-1 space-y-0.5">
                {(task.scope ?? []).map((s, si) => (
                  <li key={si} className="text-xs text-muted-foreground font-mono flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">-</span>
                    <span>{s}</span>
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
