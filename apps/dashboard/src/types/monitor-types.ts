export interface ClaudeProcess {
  pid: number;
  cpu: number;
  mem: number;
  memMB: number;
  command: string;
  label: string; // 터미널 식별 라벨
  isWorker: boolean; // 오케스트레이트 워커 프로세스 여부
  taskId?: string; // 워커인 경우 TASK-XXX ID
}
