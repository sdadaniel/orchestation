#!/usr/bin/env tsx
/**
 * CLI entry point for job-task.
 * Replaces: bash scripts/job-task.sh
 * Used by iTerm mode to run task in a separate tab.
 */
import { runJobTask } from "../engine/job-task";

const taskId = process.argv[2];
const feedbackFile = process.argv[3] || undefined;

if (!taskId) {
  console.error("Usage: run-task.ts <taskId> [feedbackFile]");
  process.exit(1);
}

runJobTask(taskId, feedbackFile, (line) => console.log(line))
  .then((result) => {
    console.log(`Task complete: ${result.status}`);
    process.exit(result.status === "task-done" ? 0 : 1);
  })
  .catch((err) => {
    console.error("Task failed:", err);
    process.exit(1);
  });
