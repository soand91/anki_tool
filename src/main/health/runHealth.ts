import { BrowserWindow, ipcMain } from "electron";
import { HEALTH_ORDER, HealthReport, HealthStatus, HealthCheckId, HealthCheckResult } from "../../shared/health/types";
import { checkAnkiProcess, checkAnkiConnectHttp, checkAnkiConnectVersion, checkAddNoteDryRun } from "./detectors";
import { sleep, jitter, friendly, isFresh, noteFailFastHit, breakerOpen, dlog } from './utils';

type CheckFn = () => Promise<{ status: 'ok' | 'warn' | 'fail'; detail?: string }>;

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
let refreshInFlight = false;
let pollTimer: NodeJS.Timeout | null = null;

export function startHealthPolling(intervalMs = 8000) {
  if (pollTimer) return;
  dlog('poll:start', { intervalMs });
  const tick = async () => {
    try { await runAllChecks(); } catch (e) {
      console.warn('[health:poll] runAllChecks failed:', friendly({ err: e }));
    }
    pollTimer = setTimeout(tick, jitter(intervalMs));
  };
  pollTimer = setTimeout(tick, jitter(intervalMs));
}

export function stopHealthPolling() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  dlog('poll:stop');
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
  const fails = statuses.filter(s => s === 'fail').length;
  const warns = statuses.filter(s => s === 'warn').length;
  const checking = statuses.includes('checking');
  if (checking) return 'checking';

  if (fails === 0 && warns === 0) return 'ok';
  if (fails === total) return 'fail';

  return 'warn'
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
      status: 'fail',
      detail: 'Unknown health check id',
      startedAt: started,
      finishedAt: finished,
      durationMs: 0,
    };
    return result;
  }
  const started = Date.now();
  dlog('check:begin', { id });
  broadcast('health:update', { type: 'BEGIN_CHECK', id, startedAt: started });

  let status: 'ok' | 'warn' | 'fail' = 'fail';
  let detail: string | undefined;
  try {
    const res = await fn();
    status = res.status;
    detail = res.detail;
  } catch (e: any) {
    status = 'fail';
    detail = friendly({ err: e });
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
  current.overall = computeOverall();

  const result: HealthCheckResult = current.checks[id];
  broadcast('health:update', {
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
    return current;
  }
  // 4) Version
  let rVer = await runCheck('ankiconnect.version');
  if (rVer.status === 'fail') {
    // warm-up retry
    await sleep(400);
    rVer = await runCheck('ankiconnect.version');
    if (rVer.status === 'fail') {
      await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Version check failed.');
      dlog('runAll:shortcircuit', { at: 'version', status: rVer.status });
      return current;
    }
  }
  // 5) Dry run
  await runCheck('ankiconnect.addNoteDryRun');
  dlog('runAll:end', { overall: current.overall });
  return current;
}

async function skipCheck(id: HealthCheckId, detail: string) {
  const started = Date.now();
  broadcast('health:update', { type: 'BEGIN_CHECK', id, startedAt: started });
  const finished = Date.now();
  current.checks[id] = {
    id, 
    label: LABELS[id],
    status: 'fail',
    detail,
    startedAt: started,
    finishedAt: finished,
    durationMs: Math.max(0, finished - started),
  };
  current.overall = computeOverall();
  broadcast('health:update', { type: 'END_CHECK', id, status: 'fail', detail, startedAt: started, finishedAt: finished });
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
  if (current.overall === 'fail') {
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
      throw new Error('Checking Anki status… please try again in a moment.');
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
  ipcMain.handle('health:polling:start', async(_e, intervalMs?: number) => {
    dlog('ipc:invoke health:polling:start', { intervalMs });
    startHealthPolling(typeof intervalMs === 'number' ? intervalMs: 8000);
  });
  ipcMain.handle('health:polling:stop', async () => {
    dlog('ipc:invoke health:polling:stop');
    stopHealthPolling();
  });
  ipcMain.handle('health:mini', async () => {
    dlog('ipc:invoke health:mini');
    await runMiniChecks();
    return getReport();
  });
}