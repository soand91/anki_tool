export type HealthCheckId = 
  | "anki.process"
  | "ankiconnect.http"
  | "ankiconnect.version"
  | "ankiconnect.addNoteDryRun";

export type HealthStatus = "checking" | "ok" | "warning" | "error" | "unknown";

export type HealthCheckRow = { id: string; label: string; status: HealthStatus; detail?: string };

export interface HealthCheckResult {
  id: HealthCheckId;
  label: string;
  status: HealthStatus;
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface HealthReport {
  overall: HealthStatus;
  checks: Record<HealthCheckId, HealthCheckResult>;
}

export const HEALTH_ORDER: HealthCheckId[] = [
  "anki.process",
  "ankiconnect.http",
  "ankiconnect.version",
  "ankiconnect.addNoteDryRun"
]