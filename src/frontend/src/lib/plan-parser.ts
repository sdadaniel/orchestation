import fs from "fs";
import path from "path";
import matter from "gray-matter";

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
  if (!fs.existsSync(PLANS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));
  const plans: PlanFrontmatter[] = [];

  for (const file of files) {
    const plan = parsePlanFile(path.join(PLANS_DIR, file));
    if (plan) {
      plans.push(plan);
    }
  }

  return plans;
}
