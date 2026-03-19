import type { WaterfallGroup } from "@/types/waterfall";
import { SprintHeader } from "./SprintHeader";

type WaterfallContainerProps = {
  groups: WaterfallGroup[];
};

export function WaterfallContainer({ groups }: WaterfallContainerProps) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.sprint.id} className="rounded-lg border bg-card">
          <SprintHeader sprint={group.sprint} progress={group.progress} />
          <div className="flex flex-col gap-1 p-4">
            {group.tasks.length > 0 ? (
              group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="h-10 rounded-md bg-muted/30"
                  data-task-id={task.id}
                />
              ))
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                배정된 태스크가 없습니다
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
