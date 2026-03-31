import fs from "fs";
import path from "path";

export const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..", "..");

// 패키지 설치 경로 (template/, docs/roles/ 등 패키지 내부 리소스 참조용)
export const PACKAGE_DIR = process.env.PACKAGE_DIR || path.resolve(process.cwd(), "..", "..");

export const TASKS_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "tasks");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "docs", "task");
})();

export const OUTPUT_DIR = (() => {
  const o = path.join(PROJECT_ROOT, ".orchestration", "output");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "output");
})();

/** docs/roles/ 경로 — 패키지 내부 우선, 프로젝트 fallback */
export const ROLES_DIR = (() => {
  const pkg = path.join(PACKAGE_DIR, "docs", "roles");
  if (fs.existsSync(pkg)) return pkg;
  return path.join(PROJECT_ROOT, "docs", "roles");
})();
