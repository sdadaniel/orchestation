import type { RequestItem } from "@/hooks/useRequests";

export interface RequestCardProps {
  req: RequestItem;
  onUpdate: (
    id: string,
    updates: Partial<
      Pick<RequestItem, "status" | "title" | "content" | "priority">
    >,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}
