import type { TaskOption } from "../components/types";

export type Phase = "draft" | "review";

/** New-task page: manual create vs AI suggestions (drives `TabGroup` value). */
export type NewTaskIntakeTab = "create" | "suggest";

export type { TaskOption };
