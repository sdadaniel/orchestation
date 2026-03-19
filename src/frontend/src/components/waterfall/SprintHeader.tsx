import type { WaterfallGroup } from "@/types/waterfall";

type SprintHeaderProps = {
  sprint: WaterfallGroup["sprint"];
  progress: WaterfallGroup["progress"];
};

export function SprintHeader({ sprint, progress }: SprintHeaderProps) {
  const percent =
    progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b">
      <h3 className="text-sm font-semibold">{sprint.title}</h3>
      <span className="text-xs text-muted-foreground">
        {progress.done}/{progress.total} ({percent}%)
      </span>
    </div>
  );
}
