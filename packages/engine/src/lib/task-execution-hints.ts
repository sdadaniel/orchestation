import { parseFrontmatter } from "./content/frontmatter-utils";

export interface TaskExecutionHints {
  edit_files: string[];
  read_only_files: string[];
  do_not_explore: string[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function parseTaskExecutionHints(
  rawTaskContent: string,
): TaskExecutionHints | null {
  const { data } = parseFrontmatter(rawTaskContent || "");
  const execution =
    data.execution && typeof data.execution === "object"
      ? (data.execution as Record<string, unknown>)
      : null;

  if (!execution) return null;

  const hints: TaskExecutionHints = {
    edit_files: toStringArray(execution.edit_files),
    read_only_files: toStringArray(execution.read_only_files),
    do_not_explore: toStringArray(execution.do_not_explore),
  };

  if (
    hints.edit_files.length === 0 &&
    hints.read_only_files.length === 0 &&
    hints.do_not_explore.length === 0
  ) {
    return null;
  }

  return hints;
}
