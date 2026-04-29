export type LogLine = {
  id: number;
  receivedAtIso: string;
  line: string;
};

export type UiLogRow = {
  time: string; // "HH:MM:SS" or "--:--:--"
  level: "info";
  source: string; // e.g. "engine" | "dashboard" | "orchestrate"
  message: string;
};

