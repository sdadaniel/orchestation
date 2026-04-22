import { parseFrontmatter } from "../lib/frontmatter-utils";

export interface WorkflowStepDef {
  /** stable key within a task (e.g. "work", "review") */
  key: string;
  /** semantic type (e.g. "task", "review", "check") */
  type: string;
  /** optional per-step max attempts (retry). null/undefined means engine default */
  maxAttempts?: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function defaultWorkflow(): WorkflowStepDef[] {
  return [
    { key: "work", type: "task" },
    { key: "review", type: "review" },
  ];
}

/**
 * Parse per-task workflow definition from tasks.content frontmatter.
 *
 * Supported shapes:
 * - workflow:
 *     - { key: work, type: task }
 *     - { key: review, type: review }
 *
 * If missing/invalid → returns default workflow.
 */
export function parseWorkflowFromTaskContent(
  rawTaskContent: string,
): WorkflowStepDef[] {
  const { data } = parseFrontmatter(rawTaskContent || "");
  const wf = data["workflow"];
  if (!Array.isArray(wf) || wf.length === 0) return defaultWorkflow();

  const steps: WorkflowStepDef[] = [];
  for (const item of wf) {
    if (!isRecord(item)) continue;
    const key = String(item["key"] ?? "").trim();
    const type = String(item["type"] ?? "").trim();
    if (!key || !type) continue;

    const maxAttemptsRaw = item["maxAttempts"];
    const maxAttempts =
      typeof maxAttemptsRaw === "number"
        ? Math.trunc(maxAttemptsRaw)
        : typeof maxAttemptsRaw === "string" && maxAttemptsRaw.trim()
          ? Math.trunc(Number(maxAttemptsRaw.trim()))
          : undefined;

    steps.push({
      key,
      type,
      ...(maxAttempts && maxAttempts > 0 ? { maxAttempts } : {}),
    });
  }

  return steps.length > 0 ? steps : defaultWorkflow();
}
