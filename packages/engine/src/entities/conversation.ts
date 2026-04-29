export interface TokenUsageEntity {
  id: number;
  task_id: string;
  step_id: string | null;
  phase: "task" | "review" | "model_selection" | string;
  model: string | null;
  input_tokens: number;
  cache_create: number;
  cache_read: number;
  output_tokens: number;
  turns: number;
  duration_ms: number;
  cost_usd: number;
  timestamp: string;
}

export interface ConversationEntity {
  id: number;
  task_id: string;
  step_id: string | null;
  phase: "task" | "review" | string;
  line_number: number | null;
  type: string | null;
  subtype: string | null;
  tool_name: string | null;
  content: string | null;
  timestamp: string;
}
