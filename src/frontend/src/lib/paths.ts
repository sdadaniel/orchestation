import fs from "fs";
import path from "path";

export const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..", "..");

// 패키지 설치 경로 (docs/roles/ 등 패키지 내부 리소스 참조용)
export const PACKAGE_DIR = process.env.PACKAGE_DIR || path.resolve(process.cwd(), "..", "..");

// ── .orchestration 하위 경로 일괄 정의 ──────────────────────
const ORCH_DIR = path.join(PROJECT_ROOT, ".orchestration");

export const OUTPUT_DIR = (() => {
  const o = path.join(ORCH_DIR, "output");
  return fs.existsSync(o) ? o : path.join(PROJECT_ROOT, "output");
})();

export const SIGNALS_DIR = path.join(ORCH_DIR, "signals");
export const NOTICES_DIR = path.join(ORCH_DIR, "notices");
export const LOGS_DIR = path.join(ORCH_DIR, "output", "logs");
export const TEMPLATE_DIR = path.join(ORCH_DIR, "template");
export const CONFIG_PATH = path.join(ORCH_DIR, "config.json");
export const DB_DIR = ORCH_DIR;

/** docs/roles/ 경로 — 패키지 내부 우선, 프로젝트 fallback */
export const ROLES_DIR = (() => {
  const pkg = path.join(PACKAGE_DIR, "docs", "roles");
  if (fs.existsSync(pkg)) return pkg;
  return path.join(PROJECT_ROOT, "docs", "roles");
})();
