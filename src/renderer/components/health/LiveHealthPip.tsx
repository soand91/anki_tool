import React, { useEffect, useMemo, useState } from "react";
import type { HealthReport, HealthStatus } from "../../../shared/health/types";

function statusToClasses(s: HealthStatus) {
  if (s === "ok") return "bg-emerald-500";
  if (s === "warning") return "bg-amber-400";
  if (s === "error") return "bg-rose-500";
  if (s === "checking") return "bg-amber-400";
  return "bg-zinc-400";
}

type Props = {
  idle?: boolean;
  waking?: boolean;
}

export default function LiveHealthPip({ idle = false, waking = false }: Props) {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [holdAmber, setHoldAmber] = useState(false);
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
        await window.api.health.startHealthPolling('main-window', 8000);
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
      window.api.health.stopHealthPolling('main-window').catch(() => {});
    };
  }, []);

  const overall = useMemo<HealthStatus>(() => report?.overall ?? "unknown", [report]);
  const tooltip = useMemo(() => {
    if (!report) return idle ? "Health paused (idle)" : "Health: unknown";
    const lines = Object.values(report.checks).map((c) => {
      const s = c.status.toUpperCase();
      const d = c.detail ? ` ${c.detail}` : "";
      return `${c.label}: ${s}${d}`;
    });
    if (idle) {
      lines.unshift("Health paused (idle); showing last known status.");
    } else if (waking) {
      lines.unshift("Waking: updating health shortly.");
    }
    return lines.join("\n");
  }, [report, idle, waking]);

  // Keep the amber state through idle/wake transitions to mask status flicker.
  useEffect(() => {
    if (idle || waking) {
      setHoldAmber(true);
      return;
    }
    const t = setTimeout(() => setHoldAmber(false), 200);
    return () => clearTimeout(t);
  }, [idle, waking]);

  const restingStatusClass = statusToClasses(overall);
  const pipClass = holdAmber ? "bg-amber-400" : restingStatusClass;

  return (
    <div className="fixed bottom-2.5 left-2.5 z-40 select-none cursor-help flex items-center justify-center" title={tooltip}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full shadow ${pipClass}`} />
    </div>
  );
}
