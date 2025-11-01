import { BrowserWindow, ipcMain } from "electron";
import { HEALTH_ORDER, HealthReport, HealthStatus, HealthCheckId, HealthCheckResult } from "../../shared/health/types";
import { checkAnkiProcess, checkAnkiConnectHttp, checkAnkiConnectVersion, checkAddNoteDryRun } from "./detectors";
import { pl } from "zod/v4/locales";

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
let pollTimer: NodeJS.Timeout | null = null;
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function jitter(baseMs: number, pct = 0.2) {
  const delta = baseMs * pct;
  return Math.floor(baseMs + (Math.random() * 2 - 1) * delta);
}

export function startHealthPolling(intervalMs = 8000) {
  if (pollTimer) return;
  const tick = async () => {
    try { await runAllChecks(); } catch {}
    pollTimer = setTimeout(tick, jitter(intervalMs));
  };
  pollTimer = setTimeout(tick, jitter(intervalMs));
}

export function stopHealthPolling() {
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
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
}

export function getReport(): HealthReport {
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
      startedAt: started,
      finishedAt: finished,
      durationMs: 0,
    };
    return result
  }
  const started = Date.now();
  broadcast('health:update', { type: 'BEGIN_CHECK', id, startedAt: started });

  let status: 'ok' | 'warn' | 'fail' = 'fail';
  let detail: string | undefined;
  try {
    const res = await fn();
    status = res.status;
    detail = res.detail;
  } catch (e: any) {
    status = 'fail';
    detail = e?.message ?? String(e);
  }
  const finished = Date.now();
  
  // update cached report
  const entry = current.checks[id];
  current.checks[id] = {
    id, 
    label: LABELS[id],
    status,
    detail,
    startedAt: started,
    finishedAt: finished,
    durationMs: Math.max(0, finished - started),
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
  return result
}

export async function runAllChecks(): Promise<HealthReport> {
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
  const rHTTP = await runCheck('ankiconnect.http');
  if (rHTTP.status !== 'ok') {
    await skipCheck('ankiconnect.version', 'Skipped: Ankiconnect HTTP not reachable');
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Ankiconnect HTTP not reachable');
    return current;
  }
  // 4) Version
  const rVer = await runCheck('ankiconnect.version');
  if (rVer.status === 'fail') {
    await skipCheck('ankiconnect.addNoteDryRun', 'Skipped: Version check failed');
    return current;
  }
  // 5) Dry run
  await runCheck('ankiconnect.addNoteDryRun');
  return current;
}

export function registerHealthIpc() {
  ipcMain.handle('health:check', async (_e, id: HealthCheckId) => {
    return runCheck(id);
  });
  ipcMain.handle('health:getReport', async () => {
    return getReport();
  });
  ipcMain.handle('health:runAll', async () => {
    await runAllChecks();
    return getReport();
  })
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
}