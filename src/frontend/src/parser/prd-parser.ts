import fs from "fs";
import path from "path";
import { parseFrontmatter, getString } from "../lib/frontmatter-utils";

export interface PrdData {
  id: string;
  title: string;
  status: string;
  content: string;
}

const PRD_DIR = path.join(process.cwd(), "../../docs/prd");

export function parsePrdFile(filePath: string): PrdData | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    // frontmatter 파싱
    const { data, content } = parseFrontmatter(raw);

    if (Object.keys(data).length === 0) return null;

    const id = getString(data, "id") || path.basename(filePath, ".md");
    const title = getString(data, "title");
    const status = getString(data, "status") || "draft";

    return { id, title, status, content };
  } catch {
    return null;
  }
}

export function parseAllPrds(): PrdData[] {
  if (!fs.existsSync(PRD_DIR)) return [];

  const files = fs
    .readdirSync(PRD_DIR)
    .filter((f) => f.startsWith("PRD-") && f.endsWith(".md"));
  const prds: PrdData[] = [];

  for (const file of files) {
    const prd = parsePrdFile(path.join(PRD_DIR, file));
    if (prd) prds.push(prd);
  }

  return prds.sort((a, b) => a.id.localeCompare(b.id));
}
