import { z } from "zod";
import orchestrationManager from "@/orchestrate/orchestration-manager";
import { registerRpc } from "../registry";

registerRpc({
  name: "orchestrate.start",
  idempotent: false,
  paramsSchema: z.object({}).strict(),
  handler: async () => {
    if (orchestrationManager.isRunning()) {
      throw { code: "ALREADY_RUNNING", message: "orchestration is already running" };
    }
    const result = await orchestrationManager.start();
    if (!result.success) {
      throw { code: "START_FAILED", message: result.error ?? "start-failed" };
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
    const result = await orchestrationManager.stop();
    if (!result.success) {
      throw { code: "STOP_FAILED", message: result.error ?? "stop-failed" };
    }
    return { status: orchestrationManager.getStatus() };
  },
});

registerRpc({
  name: "orchestrate.reloadConfig",
  idempotent: true,
  paramsSchema: z.object({}).strict(),
  handler: async () => orchestrationManager.reloadEngineConfigFromDisk(),
});
