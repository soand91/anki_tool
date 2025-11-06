import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HealthReport, HealthCheckRow, HealthStatus, HealthCheckId } from '../../shared/health/types';

type BeginCheckEvt = { type: 'BEGIN_CHECK'; id: HealthCheckId; startedAt?: number };
type EndCheckEvt = {
  type: 'END_CHECK';
  id: HealthCheckId;
  status: HealthStatus;
  detail?: string;
  finishedAt?: number;
}
type IncrementalEvt = BeginCheckEvt | EndCheckEvt;

export function useHealthChecks() {
  const LIVE_PREF_KEY = 'healthModalLivePref';
  const readLivePref = () => sessionStorage.getItem(LIVE_PREF_KEY) === '1';
  const writelivePref = (v: boolean) => sessionStorage.setItem(LIVE_PREF_KEY, v ? '1' : '0');

  const [report, setReport] = useState<HealthReport | null>(null);
  const overall = useMemo<HealthStatus>(() => report?.overall ?? 'unknown', [report]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [modalDefaultLive, setModalDefaultLive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  // first-launch modal: shown once per session unless you manually open it
  useEffect(() => {
    const key = 'healthShownOnce';
    if (!sessionStorage.getItem(key)) {
      setShowHealthModal(true);
      setModalDefaultLive(true);
      sessionStorage.setItem(key, '1');
    }
  }, []);

  const setLivePref = useCallback((v: boolean) => {
    writelivePref(v);
    setModalDefaultLive(v);
  }, []);

  // subscribe to health stream
  useEffect(() => {
    let unsub: undefined | (() => void);
    (async () => {
      try { 
        const snap = await window.api.getHealthReport();
        setReport(snap);
      } catch {
        // ignore; will be updated by pushes
      }
    })();
    // push updates (BEGIN_CHECK / END_CHECK or full snapshots)
    unsub = window.api.onUpdate<IncrementalEvt | HealthReport>((msg) => {
      // full snapshot path
      if ((msg as HealthReport).checks && (msg as HealthReport).overall) {
        setReport(msg as HealthReport);
        return;
      }
      // incremental per-check path
      const evt = msg as IncrementalEvt;
      setReport((prev) => {
        if (!prev) return prev;
        const id = (evt as any).id as HealthCheckId | undefined;
        if (!id || !prev.checks[id]) return prev;
        const next = structuredClone(prev);
        const c = next.checks[id];
        if (evt.type === 'BEGIN_CHECK') {
          c.status = 'checking';
          c.detail = undefined;
          c.startedAt = evt.startedAt ?? Date.now();
          c.finishedAt = undefined;
          c.durationMs = undefined;
        } else if (evt.type === 'END_CHECK') {
          c.status = evt.status;
          c.detail = evt.detail;
          c.finishedAt = evt.finishedAt ?? Date.now();
          c.durationMs = typeof c.startedAt === 'number'
            ? Math.max(0, (c.finishedAt ?? 0) -c.startedAt)
            : undefined;
        }
        // recompute overall similar to LiveHealthPip
        next.overall = computeOverall(next)
        return next;
      });
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const runAllChecks = useCallback(async () => {
    setModalDefaultLive(readLivePref());
    setShowHealthModal(true);
  }, []);

  const rows = useMemo(() => {
    if (!report) return [];
    return Object.entries(report.checks).map(([id, c]) => ({
      id, 
      label: c.label,
      status: c.status as HealthStatus,
      detail: c.detail,
    }));
  }, [report]);

  const anyFailed = useMemo(() => {
    return rows.some((r) => r.status === 'error' || r.status === 'warning');
  }, [rows]);
  const allDone = useMemo(() => {
    if (!rows.length) return false;
    return rows.every((r) => r.status !== 'checking' && r.status !== 'unknown');
  }, [rows]);

  return {
    rows,
    overall,
    anyFailed,
    allDone,
    startedAt,
    finishedAt,
    showHealthModal,
    setShowHealthModal,
    modalDefaultLive,
    setLivePref,
    runAllChecks,
  };
}

function computeOverall(rep: HealthReport): HealthStatus {
  const statuses = Object.values(rep.checks).map(c => c.status);

  const total = statuses.length;
  const fails = statuses.filter(s => s === 'error').length;
  const warns = statuses.filter(s => s === 'warning').length;
  const checking = statuses.includes('checking');
  if (checking) return 'checking';

  if (fails === 0 && warns === 0) return 'ok';
  if (fails === total) return 'error';

  return 'warning'
  // const hasChecking = statuses.includes('checking');
  // if (hasChecking) return 'checking';
  // if (statuses.includes('error')) return 'error';
  // if (statuses.includes('warning')) return 'warning';
  // if (statuses.length === 0) return 'unknown';
  // return 'ok'
}