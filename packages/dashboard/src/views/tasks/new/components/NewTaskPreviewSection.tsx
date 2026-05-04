"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskPreviewCard } from "@/app/tasks/new/TaskPreviewCard";
import {
  useNewTaskPageGet,
  useNewTaskPageSet,
} from "../hooks/useNewTaskPage";

const NewTaskPreviewSection = () => {
  const get = useNewTaskPageGet();
  const set = useNewTaskPageSet();

  const {
    title,
    description,
    tasks,
    editingIdx,
    analyzeError,
    confirming,
    canConfirm,
    existingTasks,
    availableRoles,
  } = get;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          원본 입력
        </div>
        <div className="text-sm font-medium">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
            {description}
          </div>
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
          onEdit={() =>
            set.setEditingIdx(editingIdx === idx ? null : idx)
          }
          onUpdate={(updates) => set.updateTask(idx, updates)}
          onRemove={() => set.removeTask(idx)}
          totalTasks={tasks.length}
          existingTasks={existingTasks}
          availableRoles={availableRoles}
        />
      ))}
      <button
        type="button"
        onClick={set.addTask}
        className="w-full rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="h-3 w-3" /> Add Task
      </button>
      {analyzeError && (
        <div className="text-sm text-red-500 bg-red-500/10 rounded px-3 py-2">
          {analyzeError}
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={set.goToTasks}
          className="filter-pill text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => set.setPhase("draft")}
          className="filter-pill text-xs"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void set.handleConfirm()}
          disabled={!canConfirm}
          className={cn(
            "filter-pill text-xs flex items-center gap-1.5",
            canConfirm ? "active" : "opacity-50 cursor-not-allowed",
          )}
        >
          {confirming ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Creating...
            </>
          ) : (
            <>
              <Check className="h-3 w-3" /> Confirm ({tasks.length} task
              {tasks.length !== 1 ? "s" : ""})
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NewTaskPreviewSection;
