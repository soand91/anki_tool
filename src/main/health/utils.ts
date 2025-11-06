import { HealthReport, HealthCheckResult } from '../../shared/health/types';

// sleep
export function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

// jitter around a base interval (±pct) 
export function jitter(baseMs: number, pct = 0.2) {
  const delta = baseMs * pct;
  return Math.floor(baseMs + (Math.random() * 2 - 1) * delta);
}

// logger
export function dlog(...args: any[]) {
  console.debug('[health]', ...args);
}

// latest finishedAt among checks (only when none are 'checking')
function snapshotUpdatedAt(report: HealthReport): number | undefined {
  const checks: HealthCheckResult[] = Object.values(report.checks);
  if (checks.some(c => c.status === 'checking')) return undefined;
  let max = -1;
  for (const c of checks) if (typeof c.finishedAt === 'number') max = Math.max(max, c.finishedAt);
  return max >= 0 ? max : undefined;
}

// is the report fresh within ttlMs?
export function isFresh(report: HealthReport, ttlMs: number, now = Date.now()): boolean {
  const t = snapshotUpdatedAt(report);
  return typeof t === 'number' && now - t <= ttlMs;
}

// simple circuit-breaker bookkeeping (module-local state)
let failFastHits: number[] = [];
export function noteFailFastHit(now = Date.now()) {
  // keep last 30s of events
  failFastHits.push(now);
  const cutoff = now - 30_000;
  while (failFastHits.length && failFastHits[0] < cutoff) failFastHits.shift();
}
export function breakerOpen(windowMs = 15_000, threshold = 3, now = Date.now()): boolean {
  const cutoff = now - windowMs;
  let count = 0;
  for (let i = failFastHits.length - 1; i >= 0; i--) {
    if (failFastHits[i] >= cutoff) count++;
    else break;
  }
  return count >= threshold;
}