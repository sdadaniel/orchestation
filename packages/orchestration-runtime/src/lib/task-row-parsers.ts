import type { TaskRow } from "../service/task-store";

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function parseScope(task: TaskRow): string[] {
  return parseJsonStringArray(task.scope);
}

export function parseDependsOn(task: TaskRow): string[] {
  return parseJsonStringArray(task.depends_on);
}

export function parseContext(task: TaskRow): string[] {
  return parseJsonStringArray(task.context);
}

