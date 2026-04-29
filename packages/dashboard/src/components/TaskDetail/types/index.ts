export interface TerminalEntry {
  type: "tool_use" | "tool_result" | "thinking" | "text" | "system";
  name?: string;
  detail?: string;
  timestamp?: string;
}
