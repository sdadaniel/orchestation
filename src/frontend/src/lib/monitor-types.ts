export interface ClaudeProcess {
  pid: number;
  cpu: number;
  mem: number;
  memMB: number;
  command: string;
  label: string; // 터미널 식별 라벨
}
