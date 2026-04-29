import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-36" />
      {[1, 2].map((i) => (
        <div key={i} className="border-b border-border pb-2">
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-1 w-16" />
          </div>
          <div className="flex flex-col gap-0.5 pl-5">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-7 w-full rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
