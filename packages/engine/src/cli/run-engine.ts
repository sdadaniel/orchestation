#!/usr/bin/env tsx
/**
 * CLI entry point for OrchestrateEngine.
 * Replaces: bash scripts/orchestrate.sh
 */
import { OrchestrateEngine } from "../orchestrate/orchestrate-engine";

const engine = new OrchestrateEngine({
  onLog: (line) => console.log(line),
  onStatusChanged: (status) => {
    if (status === "idle") {
      process.exit(0);
    }
  },
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
