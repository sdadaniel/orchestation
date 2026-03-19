import fs from "fs";
import path from "path";

export interface SprintData {
  id: string;
  title: string;
  tasks: string[];
}

const SPRINTS_DIR = path.join(process.cwd(), "../../docs/sprint");

export function parseSprintFile(filePath: string): SprintData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    const titleMatch = content.match(/^#\s+Sprint\s+\d+:\s+(.+)$/m);
    if (!titleMatch) {
      return null;
    }

    const id = path.basename(filePath, ".md");
    const title = titleMatch[1].trim();

    const taskIds: string[] = [];
    const taskPattern = /- (TASK-\d+)[:\s]/g;
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
      taskIds.push(match[1]);
    }

    return { id, title, tasks: taskIds };
  } catch {
    return null;
  }
}

export function parseAllSprints(): SprintData[] {
  if (!fs.existsSync(SPRINTS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(SPRINTS_DIR)
    .filter((f) => f.startsWith("SPRINT-") && f.endsWith(".md"));

  const sprints: SprintData[] = [];

  for (const file of files) {
    const sprint = parseSprintFile(path.join(SPRINTS_DIR, file));
    if (sprint) {
      sprints.push(sprint);
    }
  }

  return sprints;
}
