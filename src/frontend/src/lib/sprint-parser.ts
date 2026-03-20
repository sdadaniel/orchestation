import fs from "fs";
import path from "path";

export interface SprintBatch {
  name: string;
  tasks: string[];
}

export interface SprintData {
  id: string;
  title: string;
  status: string;
  tasks: string[];
  batches: SprintBatch[];
}

const SPRINTS_DIR = path.join(process.cwd(), "../../docs/sprint");
const ARCHIVE_DIR = path.join(SPRINTS_DIR, "archive");

function parseFrontmatter(content: string): { status: string; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { status: "", body: content };
  }
  const statusMatch = fmMatch[1].match(/^status:\s*(.+)$/m);
  return {
    status: statusMatch ? statusMatch[1].trim() : "",
    body: fmMatch[2],
  };
}

function parseBatches(body: string): SprintBatch[] {
  const batches: SprintBatch[] = [];
  const batchPattern = /###\s+(.+)\n([\s\S]*?)(?=\n###\s|\n##\s|$)/g;
  let match;
  while ((match = batchPattern.exec(body)) !== null) {
    const name = match[1].trim();
    const section = match[2];
    const tasks: string[] = [];
    const taskPattern = /- (TASK-\d+)[:\s]/g;
    let taskMatch;
    while ((taskMatch = taskPattern.exec(section)) !== null) {
      tasks.push(taskMatch[1]);
    }
    if (tasks.length > 0) {
      batches.push({ name, tasks });
    }
  }
  return batches;
}

export function parseSprintFile(filePath: string): SprintData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    const titleMatch = content.match(/^#\s+Sprint\s+\d+:\s+(.+)$/m);
    if (!titleMatch) {
      return null;
    }

    const id = path.basename(filePath, ".md");
    const title = titleMatch[1].trim();
    const { status, body } = parseFrontmatter(content);
    const batches = parseBatches(body);

    const taskIds: string[] = [];
    const taskPattern = /- (TASK-\d+)[:\s]/g;
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
      taskIds.push(match[1]);
    }

    return { id, title, status, tasks: taskIds, batches };
  } catch {
    return null;
  }
}

function readSprintFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("SPRINT-") && f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

export function parseAllSprints(): SprintData[] {
  const files = [...readSprintFiles(SPRINTS_DIR), ...readSprintFiles(ARCHIVE_DIR)];

  const sprints: SprintData[] = [];

  for (const file of files) {
    const sprint = parseSprintFile(file);
    if (sprint) {
      sprints.push(sprint);
    }
  }

  return sprints;
}
