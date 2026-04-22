#!/usr/bin/env tsx
/**
 * CLI entry point for job-review.
 * Replaces: bash scripts/job-review.sh
 * Used by iTerm mode to run review in a separate tab.
 */
import { runJobReview } from "../engine/job-review";

const taskId = process.argv[2];

if (!taskId) {
  console.error("Usage: run-review.ts <taskId>");
  process.exit(1);
}

runJobReview(taskId, (line) => console.log(line))
  .then((result) => {
    console.log(`Review complete: ${result.status}`);
    process.exit(result.status === "review-approved" ? 0 : 1);
  })
  .catch((err) => {
    console.error("Review failed:", err);
    process.exit(1);
  });
