#!/usr/bin/env tsx
/**
 * CLI entry point for NightWorkerManager.
 * Replaces: bash scripts/night-worker.sh
 */
import nightWorkerManager from "../engine/night-worker";

// Parse CLI args
const args = process.argv.slice(2);
const options: Record<string, string | undefined> = {};

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--until" && args[i + 1]) options.until = args[++i];
  else if (args[i] === "--budget" && args[i + 1]) options.budget = args[++i];
  else if (args[i] === "--max-tasks" && args[i + 1])
    options.maxTasks = args[++i];
  else if (args[i] === "--types" && args[i + 1]) options.types = args[++i];
}

// Watch state for completion
const checkInterval = setInterval(() => {
  const state = nightWorkerManager.getState();
  // Print new logs
  const newLogs = state.logs.slice(lastLogIndex);
  for (const line of newLogs) console.log(line);
  lastLogIndex = state.logs.length;

  if (state.status !== "running" && state.status !== "idle") {
    clearInterval(checkInterval);
    process.exit(state.status === "completed" ? 0 : 1);
  }
}, 1000);

let lastLogIndex = 0;

// Graceful shutdown
const shutdown = () => {
  console.log("\nStopping Night Worker...");
  nightWorkerManager.stop();
  setTimeout(() => process.exit(0), 3000);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const result = nightWorkerManager.run({
  until: options.until,
  budget: options.budget ? parseFloat(options.budget) : undefined,
  maxTasks: options.maxTasks ? parseInt(options.maxTasks, 10) : undefined,
  types: options.types,
});

if (!result.success) {
  console.error("Failed to start Night Worker:", result.error);
  process.exit(1);
}
