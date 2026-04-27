import { z } from "zod";
import orchestrationManager from "@/gateway/orchestration-manager";
import { registerRpc } from "../registry";

registerRpc({
  name: "orchestrate.run",
  idempotent: false,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    if (orchestrationManager.isRunning()) {
      throw { code: "ALREADY_RUNNING", message: "orchestration is already running" };
    }
    const result = orchestrationManager.run();
    if (!result.success) {
      throw { code: "RUN_FAILED", message: result.error ?? "run-failed" };
    }
    return { status: orchestrationManager.getStatus() };
  },
});

registerRpc({
  name: "orchestrate.stop",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    if (!orchestrationManager.isRunning()) {
      return { status: orchestrationManager.getStatus(), alreadyStopped: true };
    }
    const result = orchestrationManager.stop();
    if (!result.success) {
      throw { code: "STOP_FAILED", message: result.error ?? "stop-failed" };
    }
    return { status: orchestrationManager.getStatus() };
  },
});
