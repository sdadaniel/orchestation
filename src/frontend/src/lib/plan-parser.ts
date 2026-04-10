import path from "path";
import matter from "gray-matter";
import fs from "fs";
import { parseAllFromDirectory } from "./parser";

export interface PlanFrontmatter {
  id: string;
  title: string;
  status: string;
}

const PLANS_DIR = path.join(process.cwd(), "../../docs/plan");

export function parsePlanFile(filePath: string): PlanFrontmatter | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content);

    if (!data.id || !data.title) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      status: data.status ?? "draft",
    };
  } catch {
    return null;
  }
}

export function parseAllPlans(): PlanFrontmatter[] {
  return parseAllFromDirectory<PlanFrontmatter>(PLANS_DIR, parsePlanFile);
}
