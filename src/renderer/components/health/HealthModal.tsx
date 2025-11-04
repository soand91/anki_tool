import React, { useEffect, useMemo, useState } from 'react';
import type { HealthReport, HealthStatus, HealthCheckResult } from '../../../shared/health/types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  defaultLive?: boolean;
  onLivePrefChange?: (live: boolean) => void;
};

export default function HealthModal({ isOpen, onClose, defaultLive = false, onLivePrefChange }: Props) {
  const [live, setLive] = useState<boolean>(defaultLive);
  useEffect(() => { setLive(defaultLive); }, [defaultLive]);
  const onToggleLive = (next: boolean) => {
    setLive(next);
    onLivePrefChange?.(next); // persist preference
  }
  const [snapshot, setSnapshot] = useState<HealthReport | null>(null);
  const [asOf, setAsOf] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [liveReport, setLiveReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let unsub: (() => void) | undefined;

    if (live) {
      // live mode
      setErr(null);
      (async () => {
        try {
          // kick an immediate pull so UI isn't empty while waiting for the first push
          const initial = await window.api?.getHealthReport();
          setLiveReport(initial);
        } catch {}
        try {
          // start polling & subscribe to pushes
          await window.api?.startHealthPolling(8000);
        } catch {}
        unsub = window.api?.onUpdate((msg: any) => {
          if (msg?.type === 'END_CHECK' || msg?.type === 'BEGIN_CHECK') {
            window.api?.getHealthReport().then(setLiveReport).catch(() => {});
          }
        });
      })();
      return () => {
        unsub?.();
        window.api.stopHealthPolling().catch(() => {});
      };
    } else {
      // snapshot mode
      setErr(null);
      setLoading(true);
      (async () => {
        try {
          // do not keep polling in snapshot mode
          await window.api?.stopHealthPolling().catch(() => {});
          const rep = await window.api?.runAll();
          setSnapshot(rep);
          setAsOf(Date.now());
        } catch (e: any) {
          setErr(e?.message ?? String(e));
        } finally {
          setLoading(false);
        }
      })();
      return () => {
        // no-op on cleanup; caller may decide to start polling globally elsewhere
      };
    }
  }, [isOpen, live]);

  // manually refresh (snapshot only)
  const refreshOnce = async () => {
    setErr(null);
    setLoading(true);
    try {
      const rep = await window.api?.runAll();
      setSnapshot(rep);
      setAsOf(Date.now());
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // decide which report to render based on mode
  const reportToShow = live ? liveReport : snapshot;

  const rows = useMemo(() => {
    if (!reportToShow) return [];
    return Object.values(reportToShow.checks);
  }, [reportToShow]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">System Health</h2>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusToClasses(reportToShow?.overall ?? 'unknown')}`}>
              {(reportToShow?.overall ?? 'unknown').toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Snapshot timestamp / Live pill */}
            {live ? (
              <span className="text-xs font-medium rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                LIVE
              </span>
            ) : (
              <span className="text-xs text-zinc-500">
                Snapshot {asOf ? `• ${formatTime(asOf)}` : ''}
              </span>
            )}

            {/* Refresh (snapshot only) */}
            {!live && (
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 hover:shadow-sm transition-all duration-200 disabled:opacity-50 cursor-pointer"
                onClick={refreshOnce}
                disabled={loading}
                title="Run checks and refresh this snapshot"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            )}

            {/* Live toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none" title="Toggle between snapshot and live updates">
              <span className="text-xs text-zinc-600">Live</span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={live}
                onChange={(e) => onToggleLive(e.target.checked)}
              />
              <span className="block h-5 w-9 rounded-full bg-zinc-300 peer-checked:bg-emerald-500 relative transition-colors">
                <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
              </span>
            </label>

            {/* Close */}
            <button
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 hover:shadow-sm transition-all duration-200 cursor-pointer"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="max-h-[60vh] overflow-auto p-2">
          {err && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}
          {!reportToShow ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              {live ? 'Waiting for live data…' : loading ? 'Loading snapshot…' : 'No data available.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="border-b border-zinc-300 p-2 last:border-b-0">
                  {/* top row: label left, status pill right */}
                  <div className="flex items-center justify-between gap-3">
                    {/* status name/label */}
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot status={r.status} />
                      <div className="truncate font-medium">{r.label}</div>
                    </div>
                    {/* status pill */}
                    <div className={`rounded-full border px-2 py-0.5 text-xs ${statusToClasses(r.status)}`}>
                      {r.status.toUpperCase()}
                    </div>
                  </div>
                  {/* second row: detail (left, clamped) · meta (right, nowrap) */}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    {r.detail ? (
                      <p 
                        className={[
                          'min-w-0 flex-1 text-sm text-zinc-600 [overflow-wrap:anywhere]',
                          'line-clamp-2', 
                        ].join(' ')}
                        title={r.detail}
                      >
                        {r.detail}
                      </p>
                    ) : (
                      <p className="min-w-0 flex-1 text-sm text-zinc-500">No details.</p>
                    )}
                    <div className="shrink-0 whitespace-nowrap text-xs text-zinc-500 [font-variant-numeric:tabular-nums]">
                      {formatMeta(r.startedAt, r.finishedAt, r.durationMs, r.status)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-3 py-2 min-h-12.5">
          <div className="text-xs text-zinc-500">
            {live
              ? 'Live updates every ~8s.'
              : 'Static snapshot. Click Refresh to re-run checks.'}
          </div>
          {!live && (
            <div className="flex items-center gap-2">
              <button
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 hover:shadow-sm transition-all duration-200 disabled:opacity-50 cursor-pointer"
                onClick={refreshOnce}
                disabled={loading}
              >
                {loading ? 'Refreshing…' : 'Run Checks'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// helpers
function statusToClasses(status: HealthStatus) {
  switch (status) {
    case 'ok':
      return 'border-emerald-300 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'error':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'checking':
      return 'border-blue-300 bg-blue-50 text-blue-700';
    default:
      return 'border-zinc-300 bg-zinc-50 text-zinc-700';
  }
}

function StatusDot({ status }: { status: HealthStatus }) {
  const base = 'inline-block h-2.5 w-2.5 rounded-full';
  const cls =
    status === 'ok'
      ? 'bg-emerald-500'
      : status === 'warning'
      ? 'bg-amber-500'
      : status === 'error'
      ? 'bg-red-500'
      : status === 'checking'
      ? 'bg-blue-500 animate-pulse'
      : 'bg-zinc-400';
  return <span className={`${base} ${cls}`} />;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMeta(
  startedAt?: number,
  finishedAt?: number,
  durationMs?: number,
  status?: HealthStatus
) {
  if (status === 'checking') return 'Running…';
  const start = startedAt ? formatTime(startedAt) : '—';
  const end = finishedAt ? formatTime(finishedAt) : '—';
  const dur = durationMs != null ? `${durationMs} ms` : '—';
  return `${start} → ${end} • ${dur}`;
}