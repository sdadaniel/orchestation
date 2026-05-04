import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * packages/engine 패키지 루트
 * 이 파일: src/lib/config → 상위 3단계 (config→lib→src→engine)
 */
const ENGINE_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * orchestration CLI 배포 루트 (cli.js, packages/ 가 있는 디렉터리)
 * monorepo: engine 루트의 상위 2단계 = repo 루트
 */
export const PACKAGE_DIR =
  process.env.PACKAGE_DIR || path.resolve(ENGINE_ROOT, "..", "..");

/** 사용자 프로젝트 루트 — env 없을 때는 PACKAGE_DIR과 동일(로컬 개발) */
export const PROJECT_ROOT = process.env.PROJECT_ROOT || PACKAGE_DIR;

/** Next 대시보드 앱 루트 (template/ 등) */
export const DASHBOARD_DIR = path.join(PACKAGE_DIR, "packages", "dashboard");

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
/** 리포에 포함되는 기본 설정 템플릿 (`config.json` 없을 때 `loadSettings` 폴백) */
export const CONFIG_DEFAULT_PATH = path.join(PACKAGE_DIR, "config-default.json");
export const DB_DIR = ORCH_DIR;

/** docs/roles/ 경로 — 패키지 내부 우선, 프로젝트 fallback */
export const ROLES_DIR = (() => {
  const pkg = path.join(PACKAGE_DIR, "docs", "roles");
  if (fs.existsSync(pkg)) return pkg;
  return path.join(PROJECT_ROOT, "docs", "roles");
})();

