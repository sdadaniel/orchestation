import type { WorkerMode } from "@/lib/config/settings";

export interface AppSettings {
  apiKey: string;
  srcPaths: string[];
  model: string;
  baseBranch: string;
  maxParallel: number;
  maxReviewRetry: number;
  workerMode: WorkerMode;
}
