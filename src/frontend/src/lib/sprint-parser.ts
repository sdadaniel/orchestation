import fs from "fs";
import path from "path";

export interface BatchData {
  name: string;
  tasks: string[];
}

export interface SprintData {
  id: string;
  title: string;
  status: string;
  tasks: string[];
  batches: BatchData[];
}

const SPRINTS_DIR = path.join(process.cwd(), "../../docs/sprint");
const ARCHIVE_DIR = path.join(SPRINTS_DIR, "archive");

export function parseSprintFile(filePath: string): SprintData | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    const titleMatch = content.match(/^#\s+Sprint\s+\d+:\s+(.+)$/m);
    if (!titleMatch) {
      return null;
    }

    const id = path.basename(filePath, ".md");
    const title = titleMatch[1].trim();

    // Parse status from frontmatter
    let status = "";
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const statusMatch = fmMatch[1].match(/^status:\s*(.+)$/m);
      if (statusMatch) {
        status = statusMatch[1].trim();
      }
    }

    // Parse all task IDs (backward compatible)
    const taskIds: string[] = [];
    const taskPattern = /- (TASK-\d+)[:\s]/g;
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
      taskIds.push(match[1]);
    }

    // Parse batch structure
    const batches: BatchData[] = [];
    const batchPattern = /^###\s+(.+)$/gm;
    let batchMatch;
    const batchPositions: { name: string; start: number }[] = [];

    while ((batchMatch = batchPattern.exec(content)) !== null) {
      batchPositions.push({
        name: batchMatch[1].trim(),
        start: batchMatch.index + batchMatch[0].length,
      });
    }

    for (let i = 0; i < batchPositions.length; i++) {
      const start = batchPositions[i].start;
      const end =
        i + 1 < batchPositions.length
          ? batchPositions[i + 1].start
          : content.length;
      const section = content.slice(start, end);

      const batchTasks: string[] = [];
      const bTaskPattern = /- (TASK-\d+)[:\s]/g;
      let bMatch;
      while ((bMatch = bTaskPattern.exec(section)) !== null) {
        batchTasks.push(bMatch[1]);
      }

      batches.push({ name: batchPositions[i].name, tasks: batchTasks });
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
