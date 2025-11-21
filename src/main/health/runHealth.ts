import { BrowserWindow, ipcMain } from "electron";
import type { HealthReport, HealthStatus, HealthCheckId, HealthCheckResult } from "../../shared/health/types";
import { HEALTH_ORDER } from "./order";
import { checkAnkiProcess, checkAnkiConnectHttp, checkAnkiConnectVersion, checkAddNoteDryRun } from "./detectors";
import { sleep, jitter, isFresh, noteFailFastHit, breakerOpen, dlog } from './utils';

type CheckFn = () => Promise<{ status: 'ok' | 'warning' | 'error'; detail?: string }>;

const map: Record<string, CheckFn> = {
  'anki.process': checkAnkiProcess,
  'ankiconnect.http': checkAnkiConnectHttp,
  'ankiconnect.version': () => checkAnkiConnectVersion(6),
  'ankiconnect.addNoteDryRun': checkAddNoteDryRun,
};

// Stable display names for the UI and HealthReport.label
const LABELS: Record<HealthCheckId, string> = {
  'anki.process': 'Anki Process',
  'ankiconnect.http': 'AnkiConnect HTTP',
  'ankiconnect.version': 'AnkiConnect Version',
  'ankiconnect.addNoteDryRun': 'Add Note (Dry Run)',
}

let current: HealthReport = makeInitialReport();
let polling = false;
let pollTimer: NodeJS.Timeout | null = null;
let refreshInFlight = false;
let pollOwners = new Set<string>(); // e.g., 'main-window', 'pip'
let pollIntervalMs = 8000;

export function startHealthPolling(ownerId = 'unknown', intervalMs = 8000) {
  const owner = ownerId || 'unknown';
  pollOwners.add(owner);
  if (typeof intervalMs === 'number' && !Number.isNaN(intervalMs)) {
    pollIntervalMs = intervalMs;
  }
  if (polling) return;
  polling = true;
  dlog('poll:start', { intervalMs: pollIntervalMs, owners: Array.from(pollOwners) });
  const tick = async () => {
    if (!polling) return;
    if (refreshInFlight) return;
    refreshInFlight = true;
    try { await runAllChecks(); } catch (e) {
      console.warn('[health:poll] runAllChecks failed:', e);
    } finally {
      refreshInFlight = false;
      if (polling) { 
        pollTimer = setTimeout(tick, jitter(pollIntervalMs));
      }
    }
  };
  pollTimer = setTimeout(tick, jitter(pollIntervalMs));
}

export function stopHealthPolling(ownerId = 'unknown') {
  const owner = ownerId || 'unknown';
  pollOwners.delete(owner);
  if (pollOwners.size > 0) return;
  if (!polling) return;
  polling = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  dlog('poll:stop', { owners: Array.from(pollOwners) });
}

function makeInitialReport(): HealthReport {
  const checks = {} as HealthReport['checks'];
  for (const id of HEALTH_ORDER) {
    checks[id] = {
      id, 
      label: LABELS[id],
      status: 'unknown',
      detail: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      durationMs: undefined,
    };
  }
  return { overall: 'unknown', checks };
}

function computeOverall(): HealthStatus {
  const statuses = Object.values(current.checks).map(c => c.status);

  const total = statuses.length;
  const fails = statuses.filter(s => s === 'error').length;
  const warns = statuses.filter(s => s === 'warning').length;
  const checking = statuses.includes('checking');
  if (checking) return 'checking';

  if (fails === 0 && warns === 0) return 'ok';
  if (fails === total) return 'error';

  return 'warning'
}

function broadcastWithOverall(payload: Record<string, unknown>) {
  current.overall = computeOverall();
  broadcast('health:update', { ...payload, overall: current.overall });
}

function broadcast(channel: string, payload: unknown) {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    try { w.webContents.send(channel, payload); } catch {}
  }
  dlog('broadcast', channel, { to: wins.length, type: (payload as any)?.type, id: (payload as any)?.id });
}

export function getReport(): HealthReport {
  dlog('getReport', { overall: current.overall });
  return current;
}

export async function runCheck(id: HealthCheckId): Promise<HealthCheckResult> {
  const fn = map[id];
  if (!fn) {
    // unknown id -> mark fail with detail
    const started = Date.now();
    const finished = started;
    const result: HealthCheckResult = {
      id,
      label: (LABELS as any)[id] ?? id,
      status: 'warning',
      detail: 'Unknown health check id',
      startedAt: started,
      finishedAt: finished,
      durationMs: 0,
    };
    return result;
  }
  const started = Date.now();
  dlog('check:begin', { id });
  current.checks[id] = {
    ...current.checks[id],
    status: 'checking',
    detail: undefined,
    startedAt: started,
    finishedAt: undefined,
    durationMs: undefined,
  };
  broadcastWithOverall({ type: 'BEGIN_CHECK', id, startedAt: started });

  let status: 'ok' | 'warning' | 'error' = 'error';
  let detail: string | undefined;
  try {
    const res = await fn();
    status = res.status;
    detail = res.detail;
  } catch (e: any) {
    status = 'error';
    detail = e;
  }
  const finished = Date.now();
  const durationMs = Math.max(0, finished - started);
  
  // update cached report
  current.checks[id] = {
    id, 
    label: LABELS[id],
    status,
    detail,
    startedAt: started,
    finishedAt: finished,
    durationMs, 
  };

  const result: HealthCheckResult = current.checks[id];
  broadcastWithOverall({
    type: 'END_CHECK',
    id, 
    status,
    detail,
    startedAt: started,
    finishedAt: finished
  });
  dlog('check:end', { id, status, durationMs, detail: detail?.slice(0, 120) });
  return result
}

export async function runAllChecks(): Promise<HealthReport> {
  dlog('runAll:start');
  // 1) Process
  const rProcess = await runCheck('anki.process');
  if (rProcess.status !== 'ok') {
    await skipCheck('ankiconnect.http', 'Skipped: Anki is not running.');
    await skipCheck('ankiconnect.version', 'Skipped: Anki is not running.');
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Anki is not running.');
    broadcastWithOverall({ type: 'RUN_ALL_END' });
    return current;
  }
  // 2) Grace after process OK 
  await sleep(400);
  // 3) HTTP
  const rHttp = await runCheck('ankiconnect.http');
  if (rHttp.status !== 'ok') {
    await skipCheck('ankiconnect.version', 'Skipped: Ankiconnect HTTP not reachable.');
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Ankiconnect HTTP not reachable.');
    dlog('runAll:shortcircuit', { at: 'http', status: rHttp.status });
    broadcastWithOverall({ type: 'RUN_ALL_END' });
    return current;
  }
  // 4) Version
  let rVer = await runCheck('ankiconnect.version');
  if (rVer.status === 'error') {
    // warm-up retry
    await sleep(400);
    rVer = await runCheck('ankiconnect.version');
    if (rVer.status === 'error') {
      await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Version check failed.');
      dlog('runAll:shortcircuit', { at: 'version', status: rVer.status });
      broadcastWithOverall({ type: 'RUN_ALL_END' });
      return current;
    }
  }
  // 5) Dry run
  await runCheck('ankiconnect.addNoteDryRun');
  dlog('runAll:end', { overall: current.overall });

  broadcastWithOverall({ type: 'RUN_ALL_END' });

  return current;
}

async function skipCheck(id: HealthCheckId, detail: string) {
  const started = Date.now();
  broadcast('health:update', { type: 'BEGIN_CHECK', id, startedAt: started });
  current.checks[id] = {
    ...current.checks[id],
    status: 'checking',
    detail: undefined,
    startedAt: started,
    finishedAt: undefined,
    durationMs: undefined,
  }
  broadcastWithOverall({ type: 'BEGIN_CHECK', id, startedAt: started });
  const finished = Date.now();
  current.checks[id] = {
    id, 
    label: LABELS[id],
    status: 'warning',
    detail,
    startedAt: started,
    finishedAt: finished,
    durationMs: Math.max(0, finished - started),
  };
  broadcastWithOverall({
    type: 'END_CHECK',
    id, 
    status: 'warning',
    detail, 
    startedAt: started,
    finishedAt: finished,
  });
  dlog('check:skip', { id, reason: detail });
}

export async function runMiniChecks(): Promise<HealthReport> {
  dlog('runMini:start');
  const rProcess = await runCheck('anki.process');
  if (rProcess.status !== 'ok') {
    await skipCheck('ankiconnect.http', 'Skipped: Anki is not running.');
    await skipCheck('ankiconnect.version', 'Skipped by mini run.');
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped by mini run.');
    dlog('runMini:shortcircuit', { at: 'process', status: rProcess.status });
    return current;
  }
  await sleep(300);
  const rHttp = await runCheck('ankiconnect.http');
  if (rHttp.status !== 'ok') {
    await skipCheck('ankiconnect.version', 'Skipped: HTTP not reachable (mini).');
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: HTTP not reachable (mini).');
    dlog('runMini:shortcircuit', { at: 'http', status: rHttp.status });
    return current;
  }
  await skipCheck('ankiconnect.version', 'Skipped by mini run.');
  await skipCheck('ankiconnect.addNoteDryRun', 'Skipped by mini run.');
  dlog('runMini:end', { overall: current.overall });
  return current;
}

export async function ensureHealthyOrThrow(opts?: {
  ttlMs?: number;
  allowProceedIfStale?: boolean;
  refreshIfStale?: boolean;
}): Promise<void> {
  const ttlMs = opts?.ttlMs ?? 10_000;
  const allowProceedIfStale = opts?.allowProceedIfStale ?? true;
  const refreshIfStale = opts?.refreshIfStale ?? true;

  const now = Date.now();

  dlog('gate:begin', { ttlMs, allowProceedIfStale, refreshIfStale });
  // Circuit breaker: too many fail-fasts recently? back off.
  if (breakerOpen(15_000, 3, now)) {
    dlog('gate:breakerOpen');
    throw new Error('Health temporarily unavailable. Please wait a few seconds and try again.');
  }
  // If known bad, fail fast (and count it)
  if (current.overall === 'error') {
    noteFailFastHit(now);
    // optional: kick a refresh once when failing to help recover
    if (!refreshInFlight) {
      refreshInFlight = true;
      runAllChecks().catch(() => {}).finally(() => { refreshInFlight = false; });
    }
    dlog('gate:failFast');
    throw new Error('Anki is not ready. Open Anki and enable AnkiConnect, then try again.');
  }
  // Healthy-ish but stale?
  if (!isFresh(current, ttlMs, now)) {
    if (refreshIfStale && !refreshInFlight) {
      refreshInFlight = true;
      runAllChecks().catch(() => {}).finally(() => { refreshInFlight = false; });
      dlog('gate:staleRefresh:kicked');
    }
    if (!allowProceedIfStale) {
      // block if you configured no-stale proceeds
      dlog('gate:stale:block');
      throw new Error('Checking Anki status... please try again in a moment.');
    }
    // proceed optimistically
    dlog('gate:stale:proceed');
  }
  // Fresh & ok/warn -> proceed
  dlog('gate:proceed', { overall: current.overall });
}

export function registerHealthIpc() {
  dlog('ipc:register');
  ipcMain.handle('health:check', async (_e, id: HealthCheckId) => {
    dlog('ipc:invoke health:check', { id });
    return runCheck(id);
  });
  ipcMain.handle('health:getReport', async () => {
    dlog('ipc:invoke health:getReport');
    return getReport();
  });
  ipcMain.handle('health:runAll', async () => {
    dlog('ipc:invoke health:runAll');
    await runAllChecks();
    return getReport();
  });
  ipcMain.handle('health:polling:start', async(_e, ownerId: string, intervalMs?: number) => {
    dlog('ipc:invoke health:polling:start', { ownerId, intervalMs });
    startHealthPolling(ownerId, intervalMs);
  });
  ipcMain.handle('health:polling:stop', async (_e, ownerId: string) => {
    dlog('ipc:invoke health:polling:stop', { ownerId });
    stopHealthPolling(ownerId);
  });
  ipcMain.handle('health:mini', async () => {
    dlog('ipc:invoke health:mini');
    await runMiniChecks();
    return getReport();
  });
}
