import { HealthReport, HealthCheckId, HealthStatus } from "./types";

export type HealthAction = 
  | { type: "BEGIN_CHECK"; id: HealthCheckId; at?: number }
  | { 
      type: "END_CHECK"; 
      id: HealthCheckId; 
      status: HealthStatus;       // expect: 'ok' | 'warn' | 'fail'
      detail?: string; 
      at?: number;                // end timestamp (optional)
      expectedStartedAt?: number; // race guard: accept only if matches current startedAt
    };

export function emptyReport(): HealthReport {
  return {
    overall: "unknown",
    checks: {
      "anki.process": { id: "anki.process", label: "Anki app running", status: "unknown" },
      "ankiconnect.http": { id: "ankiconnect.http", label: "AnkiConnect reachable", status: "unknown" },
      "ankiconnect.version": { id: "ankiconnect.version", label: "AnkiConnect version", status: "unknown" },
      "ankiconnect.addNoteDryRun": { id: "ankiconnect.addNoteDryRun", label: "Add-note dry run", status: "unknown" },
    },
  }
}

function calcOverall(checks: HealthReport["checks"]): HealthStatus {
  const statuses = Object.values(checks).map(c => c.status);
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  if (statuses.every(s => s === "ok")) return "ok";
  if (statuses.includes("checking")) return "checking";
  return "unknown"
}

export function healthReducer(state: HealthReport, action: HealthAction): HealthReport {
  if (action.type === "BEGIN_CHECK") {
    const c = state.checks[action.id];
    const now = action.at ?? Date.now();
    const updated = {
      ...state.checks, 
      [action.id]: {
        ...c, 
        status: 'checking',
        startedAt: now,
        finishedAt: undefined,
        durationMs: undefined,
        detail: undefined
      }
    };
    return { ...state, checks: updated, overall: calcOverall(updated) };
  }
  if (action.type === "END_CHECK") {
    const c = state.checks[action.id];
    if (!c) return state;                 //unknown id
    // race guard: if caller supplied expectedStartedAt, only accept if it matches current
    if (action.expectedStartedAt !== undefined && c.startedAt !== action.expectedStartedAt) {
      return state;
    }
    const finishedAt = action.at ?? Date.now();
    const durationMs = c.startedAt ? Math.max(0, finishedAt - c.startedAt) : undefined;
    // normalize illegal statuses just in case
    const nextStatus: HealthStatus = (action.status === 'unknown' || action.status === 'checking')
      ? 'fail' 
      : action.status;
    const updated = {
      ...state.checks,
      [action.id]: {
        ...c,
        status: nextStatus,
        detail: action.detail,
        finishedAt,
        durationMs
      }
    };
    return { ...state, checks: updated, overall: calcOverall(updated) };
  }
  return state;
}

export function selectSnapshotUpdatedAt(state: HealthReport): number | undefined {
  // if any check is 'checking', we don't have a stable snapshot
  for (const id in state.checks) {
    if (state.checks[id as HealthCheckId].status === 'checking') return undefined
  }
  let maxFinished: number | undefined = undefined;
  for (const id in state.checks) {
    const t = state.checks[id as HealthCheckId].finishedAt;
    if (typeof t === 'number') {
      maxFinished = maxFinished === undefined ? t: Math.max(maxFinished, t);
    }
  }
  return maxFinished;
}

export function selectIsFresh(state: HealthReport, opts?: { ttlMs?: number; now?: number }): boolean{
  const ttl = opts?.ttlMs ?? 7000;
  const now = opts?.now ?? Date.now();
  const snap = selectSnapshotUpdatedAt(state);
  return typeof snap === 'number' && now - snap <= ttl;
}

export function selectShouldFailFast(state: HealthReport): boolean {
  return state.overall === 'fail';
} 

export function selectCanProceedOptimistic(
  state: HealthReport,
  opts?: { ttlMs?: number, now?: number }
): boolean {
  const healthyish = state.overall === 'ok' || state.overall === 'warn';
  return healthyish && selectIsFresh(state, opts);
}