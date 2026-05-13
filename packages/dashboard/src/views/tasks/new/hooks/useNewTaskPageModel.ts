"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFunnel } from "@/hooks/useFunnel";
import { getErrorMessage } from "@/lib/errors/error-utils";
import { useNewTaskCreationStore } from "@/store/newTaskCreationStore";
import {
  selectedSuggestionIndicesToSet,
  useNewTaskPageDraftStore,
} from "@/store/newTaskPageDraftStore";
import { useTasksStore } from "@/store/tasksStore";
import { getQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import type { AnalyzedTask } from "@/app/tasks/new/types";
import { EFFORT_LABEL } from "@/app/tasks/new/types";
import type { NewTaskIntakeTab, Phase } from "../types";
import type { TaskOption } from "../components/types";
import type { NewTaskPageGetValue, NewTaskPageSetValue } from "../context/types";

type CreateFunnelContext = Record<string, never>;

function renderYamlList(values: string[], indent: number): string[] {
  const prefix = " ".repeat(indent);
  if (values.length === 0) return [`${prefix}[]`];
  return values.map((value) => `${prefix}- ${value}`);
}

function buildTaskContent(task: AnalyzedTask): string {
  const execution = task.execution;
  const hasExecution =
    (execution?.edit_files?.length ?? 0) > 0 ||
    (execution?.read_only_files?.length ?? 0) > 0 ||
    (execution?.do_not_explore?.length ?? 0) > 0;

  const body = [
    task.description,
    "",
    "## Completion Criteria",
    ...task.criteria.map((c) => `- ${c}`),
  ].join("\n");

  if (!hasExecution) return body;

  const lines = [
    "---",
    "execution:",
    "  edit_files:",
    ...renderYamlList(execution?.edit_files ?? [], 4),
    "  read_only_files:",
    ...renderYamlList(execution?.read_only_files ?? [], 4),
    "  do_not_explore:",
    ...renderYamlList(execution?.do_not_explore ?? [], 4),
    "---",
    "",
    body,
  ];

  return lines.join("\n");
}

export function useNewTaskPageModel(): {
  getValue: NewTaskPageGetValue;
  setValue: NewTaskPageSetValue;
} {
  const router = useRouter();
  const createFunnel = useFunnel<Phase, CreateFunnelContext>({
    initialStep: "draft",
    initialContext: {} as CreateFunnelContext,
  });
  const createFunnelRef = useRef(createFunnel);
  createFunnelRef.current = createFunnel;

  const intakeTab = useNewTaskPageDraftStore((s) => s.intakeTab);
  const title = useNewTaskPageDraftStore((s) => s.title);
  const description = useNewTaskPageDraftStore((s) => s.description);
  const analyzing = useNewTaskPageDraftStore((s) => s.analyzing);
  const revising = useNewTaskPageDraftStore((s) => s.revising);
  const revisionNotes = useNewTaskPageDraftStore((s) => s.revisionNotes);
  const refineAbortRef = useRef<AbortController | null>(null);
  const analyzeError = useNewTaskPageDraftStore((s) => s.analyzeError);
  const tasks = useNewTaskPageDraftStore((s) => s.tasks);
  const editingIdx = useNewTaskPageDraftStore((s) => s.editingIdx);
  const confirming = useNewTaskPageDraftStore((s) => s.confirming);
  const creatingSuggestions = useNewTaskPageDraftStore((s) => s.creatingSuggestions);
  const inputExternalDeps = useNewTaskPageDraftStore((s) => s.inputExternalDeps);
  const [existingTasks, setExistingTasks] = useState<TaskOption[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>(["general"]);

  const suggestions = useNewTaskPageDraftStore((s) => s.suggestions);
  const suggestLoading = useNewTaskPageDraftStore((s) => s.suggestLoading);
  const suggestError = useNewTaskPageDraftStore((s) => s.suggestError);
  const selectedSuggestionIndices = useNewTaskPageDraftStore(
    (s) => s.selectedSuggestionIndices,
  );
  const selectedSuggestions = useMemo(
    () => selectedSuggestionIndicesToSet(selectedSuggestionIndices),
    [selectedSuggestionIndices],
  );

  const setIntakeTab = useCallback((tab: NewTaskIntakeTab) => {
    useNewTaskPageDraftStore.getState().setIntakeTab(tab);
  }, []);

  const phase = createFunnel.step;

  const setPhase = useCallback(
    (next: Phase) => {
      const draft = useNewTaskPageDraftStore.getState();
      if (next === "review") {
        if (createFunnel.step !== "review") createFunnel.push("review");
        draft.setFunnelStep("review");
      } else if (createFunnel.step !== "draft") {
        createFunnel.back();
        draft.setFunnelStep("draft");
      }
    },
    [createFunnel.back, createFunnel.push, createFunnel.step],
  );

  const setTitle = useCallback((v: string) => {
    useNewTaskPageDraftStore.getState().setTitle(v);
  }, []);

  const setDescription = useCallback((v: string) => {
    useNewTaskPageDraftStore.getState().setDescription(v);
  }, []);

  const setInputExternalDeps = useCallback((ids: string[]) => {
    useNewTaskPageDraftStore.getState().setInputExternalDeps(ids);
  }, []);

  const setEditingIdx = useCallback((idx: number | null) => {
    useNewTaskPageDraftStore.getState().setEditingIdx(idx);
  }, []);

  const setRevisionNotes = useCallback((v: string) => {
    useNewTaskPageDraftStore.getState().setRevisionNotes(v);
  }, []);

  useLayoutEffect(() => {
    let cancelled = false;
    void (async () => {
      await useNewTaskPageDraftStore.persist.rehydrate();
      await useNewTaskCreationStore.persist.rehydrate();
      if (cancelled) return;
      const d = useNewTaskPageDraftStore.getState();
      const cf = createFunnelRef.current;
      if (d.funnelStep === "review" && d.tasks.length > 0) {
        if (cf.step === "draft") {
          cf.push("review");
        }
      } else if (d.funnelStep === "review" && d.tasks.length === 0) {
        d.setFunnelStep("draft");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wizardCreatedItems = useNewTaskCreationStore((s) => s.createdItems);
  const wizardLastFinishedAt = useNewTaskCreationStore((s) => s.lastFinishedAt);
  const wizardLastOutcome = useNewTaskCreationStore((s) => s.lastOutcome);
  const wizardLastError = useNewTaskCreationStore((s) => s.lastError);

  const dismissCreationRecovery = useCallback(() => {
    useNewTaskCreationStore.getState().clearRecovery();
  }, []);

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
      onDismiss: dismissCreationRecovery,
    };
  }, [
    dismissCreationRecovery,
    wizardCreatedItems,
    wizardLastError,
    wizardLastFinishedAt,
    wizardLastOutcome,
  ]);

  useEffect(() => {
    fetch("/api/tasks/graph")
      .then((r) => r.json())
      .then((data: TaskOption[]) => {
        if (Array.isArray(data)) setExistingTasks(data);
      })
      .catch(() => {});
    fetch("/api/roles")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (Array.isArray(data)) setAvailableRoles(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      refineAbortRef.current?.abort();
    };
  }, []);

  const goToTasks = useCallback(() => {
    router.push("/tasks");
  }, [router]);

  const handleSuggest = useCallback(() => {
    void useNewTaskPageDraftStore.getState().fetchSuggestions();
  }, []);

  const toggleSuggestion = useCallback((index: number) => {
    useNewTaskPageDraftStore.getState().toggleSuggestionSelection(index);
  }, []);

  const selectAll = useCallback(() => {
    useNewTaskPageDraftStore.getState().selectAllSuggestions();
  }, []);

  const deselectAll = useCallback(() => {
    useNewTaskPageDraftStore.getState().deselectAllSuggestions();
  }, []);

  const createFromSuggestions = useCallback(async () => {
    const draft = useNewTaskPageDraftStore.getState();
    draft.setCreatingSuggestions(true);
    const creation = useNewTaskCreationStore.getState();
    creation.startBatch();
    const idxList = draft.selectedSuggestionIndices;
    const sugList = draft.suggestions;
    try {
      for (const idx of idxList) {
        const s = sugList[idx];
        const content = [
          s.description,
          "",
          `**카테고리:** ${s.category}`,
          `**예상 작업량:** ${EFFORT_LABEL[s.effort] || s.effort}`,
          "",
          "## Completion Criteria",
          "- 위 설명의 개선 사항이 반영되었다",
        ].join("\n");
        const res = await fetch("/api/tasks", {
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
      draft.clearSuggestions();
      creation.completeBatchSuccess();
      useNewTaskPageDraftStore.getState().resetDraft();
      useNewTaskCreationStore.getState().clearRecovery();
      await useTasksStore.getState().fetchTasksSummary();
      void getQueryClient().invalidateQueries({ queryKey: queryKeys.tasks.all });
      router.push("/tasks");
    } catch {
      useNewTaskPageDraftStore.getState().setSuggestError("태스크 생성 실패");
      creation.completeBatchError("태스크 생성 실패");
    } finally {
      useNewTaskPageDraftStore.getState().setCreatingSuggestions(false);
    }
  }, [router]);

  const handleAnalyze = useCallback(async () => {
    if (!title.trim()) return;
    const draft = useNewTaskPageDraftStore.getState();
    draft.setAnalyzing(true);
    draft.setAnalyzeError(null);
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
      draft.setTasks(analyzedTasks);
      draft.setIntakeTab("create");
      draft.setFunnelStep("review");
      createFunnel.push("review");
    } catch (err) {
      draft.setAnalyzeError(getErrorMessage(err, "Analysis failed"));
    } finally {
      draft.setAnalyzing(false);
    }
  }, [createFunnel.push, description, inputExternalDeps, title]);

  const cancelRefineTasks = useCallback(() => {
    refineAbortRef.current?.abort();
  }, []);

  const handleRefineTasks = useCallback(async () => {
    const notes = revisionNotes.trim();
    if (!title.trim() || !notes || tasks.length === 0) return;
    refineAbortRef.current?.abort();
    const controller = new AbortController();
    refineAbortRef.current = controller;
    const draft = useNewTaskPageDraftStore.getState();
    draft.setRevising(true);
    draft.setAnalyzeError(null);
    try {
      const res = await fetch("/api/tasks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          revision_notes: notes,
          current_tasks: tasks,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        let errMsg = `Refine failed (HTTP ${res.status})`;
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
      const merged: AnalyzedTask[] = analyzedTasks.map((t, i) => ({
        ...t,
        external_depends_on:
          i === 0 && inputExternalDeps.length > 0
            ? inputExternalDeps
            : tasks[i]?.external_depends_on,
      }));
      draft.setTasks(merged);
      draft.setRevisionNotes("");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        draft.setAnalyzeError(null);
        return;
      }
      draft.setAnalyzeError(getErrorMessage(err, "Refine failed"));
    } finally {
      refineAbortRef.current = null;
      draft.setRevising(false);
    }
  }, [description, inputExternalDeps, revisionNotes, tasks, title]);

  const handleConfirm = useCallback(async () => {
    const draft = useNewTaskPageDraftStore.getState();
    draft.setConfirming(true);
    const creation = useNewTaskCreationStore.getState();
    creation.startBatch();
    try {
      const createdIds: string[] = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const content = buildTaskContent(task);
        const resolvedBatchDeps = (task.depends_on ?? [])
          .filter((idx) => idx >= 0 && idx < createdIds.length)
          .map((idx) => createdIds[idx]);
        const dependsOn = [
          ...resolvedBatchDeps,
          ...(task.external_depends_on ?? []),
        ];
        const res = await fetch("/api/tasks", {
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
      draft.resetDraft();
      useNewTaskCreationStore.getState().clearRecovery();
      await useTasksStore.getState().fetchTasksSummary();
      void getQueryClient().invalidateQueries({ queryKey: queryKeys.tasks.all });
      router.push("/tasks");
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to create tasks");
      creation.completeBatchError(msg);
      draft.setAnalyzeError(msg);
    } finally {
      draft.setConfirming(false);
    }
  }, [router, tasks]);

  const updateTask = useCallback((idx: number, updates: Partial<AnalyzedTask>) => {
    useNewTaskPageDraftStore.getState().setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)),
    );
  }, []);

  const removeTask = useCallback((idx: number) => {
    useNewTaskPageDraftStore.getState().setTasks((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addTask = useCallback(() => {
    useNewTaskPageDraftStore.setState((s) => {
      const nextTasks = [
        ...s.tasks,
        { title: "", description: "", priority: "medium" as const, criteria: [""] },
      ];
      return {
        tasks: nextTasks,
        editingIdx: nextTasks.length - 1,
      };
    });
  }, []);

  const canConfirm = useMemo(
    () =>
      !confirming &&
      !revising &&
      tasks.length > 0 &&
      tasks.every((t) => t.title.trim()),
    [confirming, revising, tasks],
  );

  const getValue = useMemo<NewTaskPageGetValue>(
    () => ({
      intakeTab,
      phase,
      createFunnel,
      title,
      description,
      analyzing,
      analyzeError,
      tasks,
      editingIdx,
      confirming,
      creatingSuggestions,
      existingTasks,
      inputExternalDeps,
      availableRoles,
      suggestions,
      suggestLoading,
      suggestError,
      selectedSuggestions,
      canConfirm,
      revisionNotes,
      revising,
      creationRecovery,
    }),
    [
      analyzeError,
      analyzing,
      availableRoles,
      canConfirm,
      confirming,
      createFunnel,
      creationRecovery,
      description,
      editingIdx,
      existingTasks,
      inputExternalDeps,
      intakeTab,
      revisionNotes,
      revising,
      selectedSuggestions,
      suggestError,
      suggestLoading,
      suggestions,
      tasks,
      title,
      creatingSuggestions,
    ],
  );

  const setValue = useMemo<NewTaskPageSetValue>(
    () => ({
      setIntakeTab,
      setPhase,
      setTitle,
      setDescription,
      setInputExternalDeps,
      setEditingIdx,
      handleSuggest,
      toggleSuggestion,
      selectAll,
      deselectAll,
      createFromSuggestions,
      handleAnalyze,
      handleRefineTasks,
      cancelRefineTasks,
      setRevisionNotes,
      handleConfirm,
      updateTask,
      removeTask,
      addTask,
      goToTasks,
    }),
    [
      addTask,
      cancelRefineTasks,
      createFromSuggestions,
      deselectAll,
      handleAnalyze,
      handleRefineTasks,
      handleConfirm,
      handleSuggest,
      removeTask,
      selectAll,
      setPhase,
      setRevisionNotes,
      toggleSuggestion,
      updateTask,
      goToTasks,
      setIntakeTab,
      setTitle,
      setDescription,
      setInputExternalDeps,
      setEditingIdx,
    ],
  );

  return { getValue, setValue };
}
