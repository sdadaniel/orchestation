import path from "path";

// Centralize path/dir constants for gateway-host.
// Keep this file side-effect free (no fs reads/writes).

export const PACKAGE_DIR = path.resolve(__dirname, ".."); // packages/gateway-host
export const WORKSPACE_ROOT = path.resolve(PACKAGE_DIR, "..", ".."); // repo root

export const DASHBOARD_DIR =
  process.env.DASHBOARD_DIR ?? path.resolve(WORKSPACE_ROOT, "packages", "dashboard");

export const PROJECT_ROOT = process.env.PROJECT_ROOT ?? WORKSPACE_ROOT;

export const CRASH_LOG = path.resolve(PROJECT_ROOT, ".orchestration", "output", "crash.log");
export const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "output");
export const ORCH_OUTPUT_DIR = path.resolve(PROJECT_ROOT, ".orchestration", "output");

