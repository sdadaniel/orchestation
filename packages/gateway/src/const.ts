import path from "path";

// Centralize path/dir constants for gateway.
// Keep this file side-effect free (no fs reads/writes).

export const PACKAGE_DIR = path.resolve(__dirname, ".."); // packages/gateway
export const WORKSPACE_ROOT = path.resolve(PACKAGE_DIR, "..", ".."); // repo root

export const DASHBOARD_DIR =
  process.env.DASHBOARD_DIR ?? path.resolve(WORKSPACE_ROOT, "packages", "dashboard");

export const PROJECT_ROOT = process.env.PROJECT_ROOT ?? WORKSPACE_ROOT;

export const CRASH_LOG = path.resolve(PROJECT_ROOT, ".orchestration", "output", "crash.log");
export const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "output");
export const ORCH_OUTPUT_DIR = path.resolve(PROJECT_ROOT, ".orchestration", "output");

export const IS_DEV = process.env.NODE_ENV !== "production";
export const DEFAULT_HOSTNAME = "localhost";
export const DEFAULT_PORT = 3000;
export const TERM_NAME = "xterm-256color";
export const TERM_COLS = 80;
export const TERM_ROWS = 24;
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

