"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, Pencil, Check, Plus, Sparkles } from "lucide-react";
import { useSuggestStore } from "@/store/suggestStore";
import { useTasksStore } from "@/store/tasksStore";
import type { TaskOption } from "@/components/DependsOnSelector";
import type { AnalyzedTask } from "./types";
import { EFFORT_LABEL } from "./types";
import { TaskPreviewCard } from "./TaskPreviewCard";
import { SuggestionsTab } from "./SuggestionsTab";
import { InputForm } from "./InputForm";

type Step = "input" | "preview";

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
  const [creatingSuggestions, setCreatingSuggestions] = useState(false);
  const [existingTasks, setExistingTasks] = useState<TaskOption[]>([]);
  const [inputExternalDeps, setInputExternalDeps] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>(["general"]);

  const suggestions = useSuggestStore((s) => s.suggestions);
  const suggestLoading = useSuggestStore((s) => s.isLoading);
  const suggestError = useSuggestStore((s) => s.error);
  const selectedSuggestions = useSuggestStore((s) => s.selectedIndices);
  const { fetchSuggestions: handleSuggest, toggleSelection: toggleSuggestion, selectAll, deselectAll } = useSuggestStore();

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TaskOption[]) => { if (Array.isArray(data)) setExistingTasks(data); })
      .catch((err) => { console.error("[NewTask] existingTasks fetch error:", err); });
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data: string[]) => { if (Array.isArray(data)) setAvailableRoles(data); })
      .catch(() => {});
  }, []);

  const createFromSuggestions = async () => {
    setCreatingSuggestions(true);
    try {
      for (const idx of selectedSuggestions) {
        const s = suggestions[idx];
        const content = [
          s.description, "",
          `**카테고리:** ${s.category}`,
          `**예상 작업량:** ${EFFORT_LABEL[s.effort] || s.effort}`,
          "", "## Completion Criteria", "- 위 설명의 개선 사항이 반영되었다",
        ].join("\n");
        await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: s.title, content, priority: s.priority, scope: s.scope, depends_on: [] }),
        });
      }
      useSuggestStore.getState().clear();
      await useTasksStore.getState().fetchRequests();
      router.push("/tasks");
    } catch {
      useSuggestStore.setState({ error: "태스크 생성 실패" });
    } finally {
      setCreatingSuggestions(false);
    }
  };

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
      if (inputExternalDeps.length > 0 && analyzedTasks.length > 0) {
        analyzedTasks[0] = { ...analyzedTasks[0], external_depends_on: inputExternalDeps };
      }
      setTasks(analyzedTasks);
      setStep("preview");
    } catch (err) {
      setAnalyzeError(getErrorMessage(err, "Analysis failed"));
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
        const content = [task.description, "", "## Completion Criteria", ...task.criteria.map((c) => `- ${c}`)].join("\n");
        const resolvedBatchDeps = (task.depends_on ?? [])
          .filter((idx) => idx >= 0 && idx < createdIds.length)
          .map((idx) => createdIds[idx]);
        const dependsOn = [...resolvedBatchDeps, ...(task.external_depends_on ?? [])];
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: task.title, content, priority: task.priority, scope: task.scope ?? [], depends_on: dependsOn, role: (task as unknown as Record<string, unknown>).role ?? "general" }),
        });
        if (!res.ok) throw new Error("Failed to create task");
        const created = await res.json();
        createdIds.push(created.id);
      }
      await useTasksStore.getState().fetchRequests();
      router.push("/tasks");
    } catch (err) {
      setAnalyzeError(getErrorMessage(err, "Failed to create tasks"));
    } finally {
      setConfirming(false);
    }
  };

  const updateTask = (idx: number, updates: Partial<AnalyzedTask>) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };
  const removeTask = (idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  };
  const addTask = () => {
    setTasks((prev) => [...prev, { title: "", description: "", priority: "medium", criteria: [""] }]);
    setEditingIdx(tasks.length);
  };

  const canConfirm = !confirming && tasks.length > 0 && tasks.every((t) => t.title.trim());

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { step === "preview" ? setStep("input") : router.push("/tasks"); }}
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

      {pageTab === "suggest" && step === "input" && (
        <SuggestionsTab
          suggestions={suggestions} suggestLoading={suggestLoading} suggestError={suggestError}
          selectedSuggestions={selectedSuggestions} creatingSuggestions={creatingSuggestions}
          onSuggest={handleSuggest} onToggle={toggleSuggestion}
          onSelectAll={selectAll} onDeselectAll={deselectAll}
          onCreateFromSuggestions={createFromSuggestions}
        />
      )}

      {step === "input" && pageTab === "write" && (
        <InputForm
          title={title} description={description} analyzing={analyzing}
          analyzeError={analyzeError} inputExternalDeps={inputExternalDeps}
          existingTasks={existingTasks} onTitleChange={setTitle}
          onDescriptionChange={setDescription} onExternalDepsChange={setInputExternalDeps}
          onAnalyze={handleAnalyze} onCancel={() => router.push("/tasks")}
        />
      )}

      {step === "preview" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">원본 입력</div>
            <div className="text-sm font-medium">{title}</div>
            {description && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{description}</div>}
          </div>
          <p className="text-xs text-muted-foreground">
            AI가 {tasks.length}개 Task로 분해했습니다. 수정 후 컨펌하세요.
            {tasks.length > 1 && " (위에서 아래 순서로 실행됩니다)"}
          </p>
          {tasks.map((task, idx) => (
            <TaskPreviewCard
              key={idx} task={task} index={idx} isEditing={editingIdx === idx}
              onEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
              onUpdate={(updates) => updateTask(idx, updates)}
              onRemove={() => removeTask(idx)}
              totalTasks={tasks.length} existingTasks={existingTasks} availableRoles={availableRoles}
            />
          ))}
          <button type="button" onClick={addTask} className="w-full rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5">
            <Plus className="h-3 w-3" /> Add Task
          </button>
          {analyzeError && <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">{analyzeError}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={() => router.push("/tasks")} className="filter-pill text-xs">Cancel</button>
            <button type="button" onClick={() => setStep("input")} className="filter-pill text-xs">Back</button>
            <button
              type="button" onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn("filter-pill text-xs flex items-center gap-1.5", canConfirm ? "active" : "opacity-50 cursor-not-allowed")}
            >
              {confirming
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Creating...</>
                : <><Check className="h-3 w-3" /> Confirm ({tasks.length} task{tasks.length !== 1 ? "s" : ""})</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
