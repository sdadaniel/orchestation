#!/usr/bin/env tsx
/**
 * Headless orchestration: runs OrchestrationManager until the session ends.
 * Dashboard+gateway use the same engine in-process; this entry is for `orchestrate run` only.
 */
import orchestrationManager from "../orchestrate/orchestration-manager";

let printedLogLines = 0;

function flushNewLogs() {
  const { logs } = orchestrationManager.getState();
  if (logs.length < printedLogLines) printedLogLines = 0;
  for (; printedLogLines < logs.length; printedLogLines++) {
    const line = logs[printedLogLines];
    if (line != null) console.log(line);
  }
}

async function main() {
  const result = await orchestrationManager.start();
  if (!result.success) {
    console.error("Failed to start orchestration:", result.error ?? "unknown");
    process.exit(1);
  }

  const logIv = setInterval(flushNewLogs, 400);
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      if (!orchestrationManager.isRunning()) {
        clearInterval(iv);
        resolve();
      }
    }, 250);
  });
  clearInterval(logIv);
  flushNewLogs();

  const { exitCode } = orchestrationManager.getState();
  if (exitCode != null && exitCode !== 0 && exitCode !== 130) {
    process.exit(exitCode);
  }
  process.exit(0);
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  process.stderr.write("\nStopping orchestration...\n");
  await orchestrationManager.stop();
  process.exit(130);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
