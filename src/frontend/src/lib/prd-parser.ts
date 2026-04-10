import path from "path";
import { parseFrontmatter, getString } from "./frontmatter-utils";
import { parseAllFromDirectory } from "./parser";
import fs from "fs";

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
  return parseAllFromDirectory<PrdData>(
    PRD_DIR,
    parsePrdFile,
    (f) => f.startsWith("PRD-"),
    (a, b) => a.id.localeCompare(b.id)
  );
}
