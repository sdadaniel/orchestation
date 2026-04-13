import { cn } from "@/lib/utils";
import { Pencil, Check, X, Plus, Trash2, GitMerge } from "lucide-react";
import { DependsOnSelector } from "@/components/DependsOnSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { AnalyzedTask, TaskOption } from "./types";
import { PRIORITY_COLORS } from "./types";

export interface TaskPreviewCardProps {
  task: AnalyzedTask;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<AnalyzedTask>) => void;
  onRemove: () => void;
  totalTasks: number;
  existingTasks: TaskOption[];
  availableRoles?: string[];
}

export function TaskPreviewCard({
  task,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onRemove,
  totalTasks,
  existingTasks,
  availableRoles,
}: TaskPreviewCardProps) {
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
        {task.role && task.role !== "general" && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium">
            {task.role}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onEdit}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          title={isEditing ? "Done editing" : "Edit"}
        >
          {isEditing ? (
            <Check className="h-3 w-3" />
          ) : (
            <Pencil className="h-3 w-3" />
          )}
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
          <Input
            type="text"
            value={task.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Task title..."
            autoFocus
          />
          <Textarea
            value={task.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description..."
            rows={3}
          />
          <div className="flex gap-2">
            <Select
              size="inline"
              value={task.priority}
              onChange={(e) =>
                onUpdate({
                  priority: e.target.value as AnalyzedTask["priority"],
                })
              }
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select
              size="inline"
              value={task.role ?? "general"}
              onChange={(e) => onUpdate({ role: e.target.value })}
            >
              {(availableRoles ?? ["general"]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          {/* Depends On (external) - edit */}
          <div>
            <Label
              size="sm"
              className="block mb-1 flex items-center gap-1 text-[11px]"
            >
              <GitMerge className="h-3 w-3" />
              Depends On (existing tasks)
            </Label>
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
              <Label size="sm" className="block mb-1 text-[11px]">
                Within-batch dependencies
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: totalTasks }, (_, i) => i)
                  .filter((i) => i !== index)
                  .map((i) => {
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
            <Label size="sm" className="block mb-1 text-[11px]">
              Completion Criteria
            </Label>
            {task.criteria.map((c, ci) => (
              <div key={ci} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  size="sm"
                  type="text"
                  value={c}
                  onChange={(e) => {
                    const newCriteria = [...task.criteria];
                    newCriteria[ci] = e.target.value;
                    onUpdate({ criteria: newCriteria });
                  }}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newCriteria = task.criteria.filter(
                      (_, i) => i !== ci,
                    );
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
            <Label size="sm" className="block mb-1 text-[11px]">
              Scope (작업 범위 파일)
            </Label>
            {(task.scope ?? []).map((s, si) => (
              <div key={si} className="flex items-center gap-1 mb-1">
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  size="sm"
                  type="text"
                  value={s}
                  onChange={(e) => {
                    const newScope = [...(task.scope ?? [])];
                    newScope[si] = e.target.value;
                    onUpdate({ scope: newScope });
                  }}
                  className="flex-1 font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newScope = (task.scope ?? []).filter(
                      (_, i) => i !== si,
                    );
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
            <p className="text-xs text-muted-foreground mt-1">
              {task.description}
            </p>
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
                  <li
                    key={ci}
                    className="text-xs text-muted-foreground flex items-start gap-1.5"
                  >
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
                  <li
                    key={si}
                    className="text-xs text-muted-foreground font-mono flex items-start gap-1.5"
                  >
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
