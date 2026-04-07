#!/usr/bin/env tsx
/**
 * CLI entry point for OrchestrateEngine.
 * Replaces: bash scripts/orchestrate.sh
 */
import { OrchestrateEngine } from "../engine/orchestrate-engine";

const engine = new OrchestrateEngine();

engine.on("log", (line: string) => {
  console.log(line);
});

engine.on("status-changed", (status: string) => {
  if (status === "completed" || status === "failed") {
    process.exit(status === "completed" ? 0 : 1);
  }
});

// Graceful shutdown
const shutdown = () => {
  console.log("\nShutting down...");
  engine.stop();
  setTimeout(() => process.exit(0), 1000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const result = engine.start();
if (!result.success) {
  console.error("Failed to start engine:", result.error);
  process.exit(1);
}
