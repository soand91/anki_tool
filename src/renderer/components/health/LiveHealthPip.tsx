import React, { useEffect, useMemo, useState } from "react";
import type { HealthReport, HealthCheckId, HealthStatus } from "../../shared/health/types";

function statusToClasses(s: HealthStatus) {
  if (s === "ok") return "bg-emerald-500";
  if (s === "warn") return "bg-amber-400";
  if (s === "fail") return "bg-rose-500";
  if (s === "checking") return "bg-yellow-300 animate-pulse";
  return "bg-zinc-400";
}

export default function LiveHealthPip() {
  const [report, setReport] = useState<HealthReport | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;

      // seed from cached report
    (async () => {
      try {
        const snap = await window.api.getHealthReport();
        setReport(snap);
      } catch {
        // ignore; will update on future pushes
      }
    })();

    // subscribe to push updates
    unsub = window.api.onUpdate<any>((msg) => {
      // Expect messages from main: BEGIN_CHECK / END_CHECK (you already send these)
      // We optimistically update a minimal local rollup for instant feedback.
      setReport((prev) => {
        if (!prev) return prev;
        if (!msg || !msg.type || !msg.id) return prev;

        const id = msg.id as HealthCheckId;
        const next = structuredClone(prev);

        if (msg.type === "BEGIN_CHECK") {
          const c = next.checks[id];
          if (c) {
            c.status = "checking";
            c.detail = undefined;
            c.startedAt = msg.startedAt ?? Date.now();
            c.finishedAt = undefined;
            c.durationMs = undefined;
          }
        } else if (msg.type === "END_CHECK") {
          const c = next.checks[id];
          if (c) {
            c.status = msg.status as HealthStatus;
            c.detail = msg.detail;
            c.finishedAt = msg.finishedAt ?? Date.now();
            c.durationMs = typeof c.startedAt === "number" ? Math.max(0, (c.finishedAt ?? 0) - c.startedAt) : undefined;
          }
        }

        // recompute overall
        next.overall = computeOverall(next);
        return next;
      });
    });

    return () => { if (unsub) unsub(); };
  }, []);

  const overall = useMemo<HealthStatus>(() => report?.overall ?? "unknown", [report]);
  const tooltip = useMemo(() => {
    if (!report) return "Health: unknown";
    const lines = Object.values(report.checks).map((c) => {
      const s = c.status.toUpperCase();
      const d = c.detail ? ` – ${c.detail}` : "";
      return `${c.label}: ${s}${d}`;
    });
    return lines.join("\n");
  }, [report]);

  return (
    <div className="fixed bottom-3 right-3 z-40 select-none cursor-help" title={tooltip}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full shadow ${statusToClasses(overall)}`} />
    </div>
  );
}

function computeOverall(rep: HealthReport): HealthStatus {
  const statuses = Object.values(rep.checks).map(c => c.status);

  const total = statuses.length;
  const fails = statuses.filter(s => s === 'fail').length;
  const warns = statuses.filter(s => s === 'warn').length;
  const checking = statuses.includes('checking');
  if (checking) return 'checking';

  if (fails === 0 && warns === 0) return 'ok';
  if (fails === total) return 'fail';

  return 'warn'
}
