import { ChildProcess } from "child_process";

/**
 * Pipes stdout/stderr of a ChildProcess to an appendLog callback, line by line.
 *
 * @param proc        - The child process to attach handlers to
 * @param appendLog   - Called with each non-empty line (stderr lines are prefixed with "[stderr] ")
 * @param onStdoutLine - Optional extra callback called for each non-empty stdout line (before appendLog)
 */
export function pipeProcessLogs(
  proc: ChildProcess,
  appendLog: (line: string) => void,
  onStdoutLine?: (line: string) => void
): void {
  proc.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString("utf-8").split("\n");
    for (const line of lines) {
      if (line.trim()) {
        appendLog(line);
        onStdoutLine?.(line);
      }
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString("utf-8").split("\n");
    for (const line of lines) {
      if (line.trim()) {
        appendLog(`[stderr] ${line}`);
      }
    }
  });
}

/**
 * Gracefully terminates a ChildProcess.
 *
 * Sends SIGTERM to the process group (if pid is available), falling back to
 * killing the process directly. After timeoutMs milliseconds, sends SIGKILL
 * if the process is still alive.
 *
 * @param proc      - The child process to terminate
 * @param timeoutMs - Milliseconds to wait before force-killing (default: 5000)
 */
export function killProcessGracefully(proc: ChildProcess, timeoutMs = 5000): void {
  try {
    if (proc.pid) {
      process.kill(-proc.pid, "SIGTERM");
    } else {
      proc.kill("SIGTERM");
    }
  } catch {
    // Fallback: kill just the process
    try {
      proc.kill("SIGTERM");
    } catch {
      // Process may have already exited
    }
  }

  setTimeout(() => {
    if (proc && !proc.killed) {
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }, timeoutMs);
}
