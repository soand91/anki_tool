import React, { useEffect, useMemo, useState } from "react";
import type { HealthReport, HealthCheckId, HealthStatus } from "../../../shared/health/types";

function statusToClasses(s: HealthStatus) {
  if (s === "ok") return "bg-emerald-500";
  if (s === "warning") return "bg-amber-400";
  if (s === "error") return "bg-rose-500";
  if (s === "checking") return "bg-yellow-300 animate-pulse";
  return "bg-zinc-400";
}

export default function LiveHealthPip() {
  const [report, setReport] = useState<HealthReport | null>(null);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | null = null;

    const scheduleFetch = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        window.api.health.getHealthReport()
          .then(r => { if (!cancelled) setReport(r); })
          .catch(() => {});
      }, 120);
    };
    (async () => {
      try {
        // start global poller
        await window.api.health.startHealthPolling(8000);
      } catch {}
      // seed quickly
      try {
        const seed = await window.api.health.getHealthReport();
        if (!cancelled) setReport(seed);
      } catch {}
      // subscribe to live updates
      unsub = window.api.health.onUpdate((msg: any) => {
        if (msg?.type === 'END_CHECK') {
          scheduleFetch();
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
      window.api.health.stopHealthPolling().catch(() => {});
    };
  }, []);

  const overall = useMemo<HealthStatus>(() => report?.overall ?? "unknown", [report]);
  const tooltip = useMemo(() => {
    if (!report) return "Health: unknown";
    const lines = Object.values(report.checks).map((c) => {
      const s = c.status.toUpperCase();
      const d = c.detail ? ` ${c.detail}` : "";
      return `${c.label}: ${s}${d}`;
    });
    return lines.join("\n");
  }, [report]);

  return (
    <div className="fixed bottom-2.5 left-2.5 z-40 select-none cursor-help flex items-center justify-center" title={tooltip}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full shadow ${statusToClasses(overall)}`} />
    </div>
  );
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
