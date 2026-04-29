export type GatewayLogEntry = {
  atIso: string;
  level: "info";
  source: string;
  message: string;
};

export function toDisplayLogLine(entry: GatewayLogEntry): string {
  const d = new Date(entry.atIso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} ${entry.level} ${entry.source} ${entry.message}`;
}
