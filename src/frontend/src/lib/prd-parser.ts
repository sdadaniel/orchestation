import fs from "fs";
import path from "path";

export interface PrdData {
  id: string;
  title: string;
  status: string;
  sprints: string[];
  content: string;
}

const PRD_DIR = path.join(process.cwd(), "../../docs/prd");

export function parsePrdFile(filePath: string): PrdData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    // frontmatter 파싱
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fm = fmMatch[1];
    const id = fm.match(/^id:\s*(.+)$/m)?.[1]?.trim() || path.basename(filePath, ".md");
    const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim() || "";
    const status = fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() || "draft";

    // sprints 리스트 파싱
    const sprints: string[] = [];
    const sprintsMatch = fm.match(/^sprints:\n((?:\s+-\s+.+\n?)*)/m);
    if (sprintsMatch) {
      const lines = sprintsMatch[1].split("\n");
      for (const line of lines) {
        const m = line.match(/^\s+-\s+(.+)/);
        if (m) sprints.push(m[1].trim());
      }
    }

    // body content (frontmatter 이후)
    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();

    return { id, title, status, sprints, content };
  } catch {
    return null;
  }
}

export function parseAllPrds(): PrdData[] {
  if (!fs.existsSync(PRD_DIR)) return [];

  const files = fs.readdirSync(PRD_DIR).filter((f) => f.startsWith("PRD-") && f.endsWith(".md"));
  const prds: PrdData[] = [];

  for (const file of files) {
    const prd = parsePrdFile(path.join(PRD_DIR, file));
    if (prd) prds.push(prd);
  }

  return prds.sort((a, b) => a.id.localeCompare(b.id));
}
