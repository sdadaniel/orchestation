"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { useNewTaskCreationStore } from "@/store/newTaskCreationStore";
import { useSuggestStore } from "@/store/suggestStore";
import { useTasksStore } from "@/store/tasksStore";
import type { NewTaskIntakeTab, TaskOption } from "../types";
import type { AnalyzedTask } from "@/app/tasks/new/types";
import { EFFORT_LABEL } from "@/app/tasks/new/types";
import type { Phase } from "../types";

export const useNewTaskPage = () => {
  const router = useRouter();
  const [intakeTab, setIntakeTab] = useState<NewTaskIntakeTab>("create");
  const [phase, setPhase] = useState<Phase>("draft");
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
  const {
    fetchSuggestions: handleSuggest,
    toggleSelection: toggleSuggestion,
    selectAll,
    deselectAll,
  } = useSuggestStore();

  const wizardCreatedItems = useNewTaskCreationStore((s) => s.createdItems);
  const wizardLastFinishedAt = useNewTaskCreationStore((s) => s.lastFinishedAt);
  const wizardLastOutcome = useNewTaskCreationStore((s) => s.lastOutcome);
  const wizardLastError = useNewTaskCreationStore((s) => s.lastError);

  const creationRecovery = useMemo(() => {
    if (
      !wizardLastFinishedAt ||
      wizardCreatedItems.length === 0 ||
      wizardLastOutcome === "idle"
    ) {
      return null;
    }
    return {
      items: wizardCreatedItems,
      variant: wizardLastOutcome === "success" ? ("success" as const) : ("error" as const),
      message: wizardLastError,
      onDismiss: () => useNewTaskCreationStore.getState().clearRecovery(),
    };
  }, [
    wizardCreatedItems,
    wizardLastError,
    wizardLastFinishedAt,
    wizardLastOutcome,
  ]);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: TaskOption[]) => {
        if (Array.isArray(data)) setExistingTasks(data);
      })
      .catch(() => {
        // silently ignore fetch errors
      });
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (Array.isArray(data)) setAvailableRoles(data);
      })
      .catch(() => {});
  }, []);

  const createFromSuggestions = useCallback(async () => {
    setCreatingSuggestions(true);
    const creation = useNewTaskCreationStore.getState();
    creation.startBatch();
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
        const res = await fetch("/api/requests", {
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
        if (!res.ok) throw new Error("태스크 생성 실패");
        const created: { id?: string } = await res.json();
        if (created?.id) {
          creation.recordCreated({ id: String(created.id), title: s.title });
        }
      }
      useSuggestStore.getState().clear();
      creation.completeBatchSuccess();
      await useTasksStore.getState().fetchRequests();
      router.push("/tasks");
    } catch {
      useSuggestStore.setState({ error: "태스크 생성 실패" });
      creation.completeBatchError("태스크 생성 실패");
    } finally {
      setCreatingSuggestions(false);
    }
  }, [router, selectedSuggestions, suggestions]);

  const handleAnalyze = useCallback(async () => {
    if (!title.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        let errMsg = `Analysis failed (HTTP ${res.status})`;
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          // non-JSON error response
        }
        if (res.status === 500) {
          errMsg +=
            "\n\nClaude CLI가 설치되어 있고 인증되었는지 확인하세요. (터미널에서 'claude --version' 실행)";
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      const analyzedTasks: AnalyzedTask[] = data.tasks;
      if (inputExternalDeps.length > 0 && analyzedTasks.length > 0) {
        analyzedTasks[0] = {
          ...analyzedTasks[0],
          external_depends_on: inputExternalDeps,
        };
      }
      setTasks(analyzedTasks);
      setIntakeTab("create");
      setPhase("review");
    } catch (err) {
      setAnalyzeError(getErrorMessage(err, "Analysis failed"));
    } finally {
      setAnalyzing(false);
    }
  }, [description, inputExternalDeps, title]);

  const handleConfirm = useCallback(async () => {
    setConfirming(true);
    const creation = useNewTaskCreationStore.getState();
    creation.startBatch();
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
        const resolvedBatchDeps = (task.depends_on ?? [])
          .filter((idx) => idx >= 0 && idx < createdIds.length)
          .map((idx) => createdIds[idx]);
        const dependsOn = [
          ...resolvedBatchDeps,
          ...(task.external_depends_on ?? []),
        ];
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            content,
            priority: task.priority,
            scope: task.scope ?? [],
            context: task.context ?? [],
            depends_on: dependsOn,
            role: task.role ?? "general",
          }),
        });
        if (!res.ok) throw new Error("Failed to create task");
        const created = await res.json();
        createdIds.push(created.id);
        creation.recordCreated({
          id: String(created.id),
          title: task.title,
        });
      }
      creation.completeBatchSuccess();
      await useTasksStore.getState().fetchRequests();
      router.push("/tasks");
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to create tasks");
      creation.completeBatchError(msg);
      setAnalyzeError(msg);
    } finally {
      setConfirming(false);
    }
  }, [router, tasks]);

  const updateTask = useCallback((idx: number, updates: Partial<AnalyzedTask>) => {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)),
    );
  }, []);

  const removeTask = useCallback((idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addTask = useCallback(() => {
    setTasks((prev) => [
      ...prev,
      { title: "", description: "", priority: "medium", criteria: [""] },
    ]);
    setEditingIdx(tasks.length);
  }, [tasks.length]);

  const canConfirm = useMemo(
    () =>
      !confirming &&
      tasks.length > 0 &&
      tasks.every((t) => t.title.trim()),
    [confirming, tasks],
  );

  return {
    intakeTab,
    setIntakeTab,
    phase,
    setPhase,
    title,
    description,
    analyzing,
    analyzeError,
    tasks,
    editingIdx,
    setEditingIdx,
    confirming,
    existingTasks,
    inputExternalDeps,
    setInputExternalDeps,
    availableRoles,
    suggestions,
    suggestLoading,
    suggestError,
    selectedSuggestions,
    handleSuggest,
    toggleSuggestion,
    selectAll,
    deselectAll,
    createFromSuggestions,
    creatingSuggestions,
    setTitle,
    setDescription,
    handleAnalyze,
    handleConfirm,
    updateTask,
    removeTask,
    addTask,
    canConfirm,
    goToTasks: () => router.push("/tasks"),
    creationRecovery,
  };
};
