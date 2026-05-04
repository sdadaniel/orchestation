import type { WorkerMode } from "@/lib/config/settings";

export interface AppSettings {
  apiKey: string;
  srcPaths: string[];
  model: string;
  baseBranch: string;
  maxParallel: number;
  maxReviewRetry: number;
  orchestrateLogRetentionDays: number;
  workerMode: WorkerMode;
  /** PUT /api/settings 시 게이트웨이가 실행 중 엔진에 설정을 다시 읽었는지 (게이트웨이 없으면 null) */
  engineConfigReload?: { reloaded: boolean; reason?: string } | null;
}
