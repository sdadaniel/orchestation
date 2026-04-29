import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-6 py-2 border-b border-border">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
