import { LucideAlignStartHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type UseIdleOptions = {
  idleMs?: number;
  pollIntervalMs?: number;
}

export function useIdleSleep(opts: UseIdleOptions = {}) {
  const idleMs = opts.idleMs ?? 3 * 60_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 8000;
  
  const [idle, setIdle] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
      if (idle) {
        // WAKING: do a mini health refresh and resume polling
        setIdle(false);
        // fire-and-forget, don't block UI
        (async () => {
          try { await window.api.health.runMini(); } catch {}
          try { await window.api.health.startHealthPolling(pollIntervalMs); } catch {}
        })();
      }
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focus',
    ];
    activityEvents.forEach(ev => window.addEventListener(ev, markActive, { passive: true }));

    // background watcher that flips to idle and pauses polling
    const tick = () => {
      const now = Date.now();
      const idleNow = (now - lastActiveRef.current) >= idleMs;
      if (idleNow && !idle) {
        setIdle(true);
        // pause polling while idle
        (async () => { try { await window.api.health.stopHealthPolling(); } catch {} })();
      }
      timerRef.current = window.setTimeout(tick, 5_000);
    }
    timerRef.current = window.setTimeout(tick, 5_000);
    
    return () => {
      activityEvents.forEach(ev => window.removeEventListener(ev, markActive));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [idle, idleMs, pollIntervalMs]);

  return { idle };
}