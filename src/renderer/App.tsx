import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Button } from './components/ui/Button';
import LiveHealthPip from './components/health/LiveHealthPip';
import type { HealthCheckId, HealthStatus, HealthCheckResult } from '../shared/health/types';
import { useIdleSleep } from './hooks/useIdleSleep';

type HealthCheckRow = {
  id: HealthCheckId;
  label: string;
  status: HealthStatus;
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
};

type HealthUpdateMessage = 
  | { type: "BEGIN_CHECK"; id: HealthCheckId; startedAt?: number }
  | { type: "END_CHECK"; id: HealthCheckId; status: HealthStatus; detail?: string; finishedAt?: number };

function hasPreloadApi(): boolean {
  return typeof window !== 'undefined' && !!(window as any).api;
}

const CHECKS: Array<{ id: HealthCheckId; label: string }> = [
  { id: 'anki.process',               label: 'Anki Process' },
  { id: 'ankiconnect.http',           label: 'AnkiConnect HTTP' },
  { id: 'ankiconnect.version',        label: 'AnkiConnect Version' },
  { id: 'ankiconnect.addNoteDryRun',  label: 'Add Note (Dry Run)' }
]

// small helper for the pip color
function statusToClasses(s: HealthStatus) {
  if (s === 'ok') return 'bg-emerald-500';
  if (s === 'warn') return 'bg-amber-400';
  if (s === 'fail') return 'bg-rose-500';
  if (s === 'checking') return 'bg-yellow-300 animate-pulse';
  return 'bg-zinc-400';
}

export function App() {
  useIdleSleep({ idleMs: 3 * 60_000, pollIntervalMs: 8000 });
  // first-launch-only gate (renderer-only, no main wiring)
  const [showHealthModal, setShowHealthModal] = useState(false);
  // table set for the four checks
  const [rows, setRows] = useState<HealthCheckRow[]>(
    CHECKS.map(c => ({ id: c.id, label: c.label, status: 'unknown' }))
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const allDone = useMemo(
    () => rows.every(r => r.status !== "checking" && r.status !== "unknown"),
    [rows]
  );
  const anyFailed = useMemo(
    () => rows.some(r => r.status === "fail" || r.status === "warn"),
    [rows]
  );
  // first-launch only: block with modal and run health once
  useEffect(() => {
    // 'launch' scoped: sessionStorage resets when this BrowserWindow is recreated
    const flag = sessionStorage.getItem('healthLaunchDone');
    if (!flag) {
      setShowHealthModal(true);
      runAllChecks();             // fire-and-forget; modal will close on completion
    }
    // else do nothing on later focuses/opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // kick off all four checks in parallel
  const runAllChecks = useCallback(async () => {
    setStartedAt(Date.now());
    // set all to checking
    setRows(prev => prev.map(r => ({ ...r, status: "checking", detail: undefined, startedAt: Date.now(), finishedAt: undefined })));
    // pause poller while modal is running
    try { await window.api?.stopHealthPolling?.(); } catch {}
    // subscribe to progress so the modal animates BEGIN/END
    const unsub = window.api?.onUpdate<HealthUpdateMessage>((msg) => {
      if (!msg || !msg.type || !msg.id) return;
      setRows((prev): HealthCheckResult[] => {
        const next = prev.map((r): HealthCheckResult => {
          if (r.id !== msg.id) return r;
          if (msg.type === 'BEGIN_CHECK') {
            const startedAt = typeof msg.startedAt === "number" ? msg.startedAt : Date.now();
            return {
              ...r,
              status: "checking",
              detail: undefined,
              startedAt,
              finishedAt: undefined,
              durationMs: undefined
            };
          }
          if (msg.type === 'END_CHECK') {
            const finishedAt = typeof msg.finishedAt === "number" ? msg.finishedAt : Date.now();
            const status: HealthStatus = msg.status; // narrow to union
            const durationMs =
            typeof r.startedAt === "number" ? Math.max(0, finishedAt - r.startedAt) : undefined;
            return {
              ...r,
              status,
              detail: msg.detail,
              finishedAt,
              durationMs
            };
          }
          return r;
        });
        return next;
      });
    });
    try {
      await window.api.runAll();
      const snap = await window.api.getHealthReport();
      setRows(CHECKS.map(c => ({ ...snap.checks[c.id] })));
      setFinishedAt(Date.now());
    } finally {
      unsub?.();
      sessionStorage.setItem('healthLaunchDone', '1');
      // resume poller after modal completes
      try { await window.api.startHealthPolling?.(8000); } catch {};
      // auto close after a brief timeout
      // setTimeout(() => setShowHealthModal(false), 600);
    }
  }, []);

  // overall headline status (for the modal header)
  const overall: HealthStatus = useMemo(() => {
    if (rows.some(r => r.status === "fail")) return "fail";
    if (rows.some(r => r.status === "checking")) return "checking";
    if (rows.some(r => r.status === "warn")) return "warn";
    if (rows.every(r => r.status === "ok")) return "ok";
    return "unknown";
  }, [rows]);

  const [pingResult, setPingResult] = useState<string>('');
  const [decks, setDecks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  
  const apiAvailable = hasPreloadApi();

  // Sanity ping-pong
  useEffect(() => {
    if (!apiAvailable) return;
    (async () => {
      try {
        const pong = await (window as any).api.ping();
        setPingResult(pong);
        // log.info('[renderer] ping ok:', pong);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        // log.error('[renderer] ping failed:', e);
      }
    })();
  }, [apiAvailable]);

  // Sanity fetch deck
  const fetchDecks = async () => {
    if (!apiAvailable) return;
    setLoading(true);
    setErr(null);
    try {
      const list: string[] = await (window as any).api.deckNames();
      setDecks(list);
      // TEMP: popup
      alert(JSON.stringify(list, null, 2));
      // log.info('[renderer] decks:', list);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      // log.error('[renderer] deckNames failed:', e)
    } finally {
      setLoading(false);
    }
  };

  interface PanelSizes {
    leftPanel: number;
    topRightPanel: number;
  }
  // default sizes
  const defaultSizes: PanelSizes = {
    leftPanel: 40,
    topRightPanel: 50,
  }
  // current size state
  const [sizes, setSizes] = useState<PanelSizes>(defaultSizes);
  const [isResizing, setIsResizing] = useState<'left' | 'topRight' | null>(null);
  const [showSnapIndicators, setShowSnapIndicators] = useState(false);

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // snap threshold
  const snapThreshold = 10;

  // update layout styles
  const updateLayout = useCallback((newSizes: PanelSizes) => {
    if (leftPanelRef.current) {
      leftPanelRef.current.style.width = `${newSizes.leftPanel}%`;
    }
  }, []);

  // left panel resize handlers
  const initResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('left');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeLeft);
    document.addEventListener('mouseup', stopResizeLeft);
  }, [])

  const resizeLeft = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isResizing) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // calculate new width for left panel
    const newLeftWidth = ((e.clientX - containerRect.left) / containerWidth) * 100;
    
    // apply constraints (min 20%, max 70%)
    const constrainedWidth = Math.max(20, Math.min(70, newLeftWidth));

    // check for snap to default
    let finalWidth = constrainedWidth;
    if (Math.abs(constrainedWidth - defaultSizes.leftPanel) < (snapThreshold / containerWidth) * 100) {
      finalWidth = defaultSizes.leftPanel;
    }
    setSizes(prev => ({ ...prev, leftPanel: finalWidth }));
  }, [isResizing]);
  
  const stopResizeLeft = useCallback(() => {
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeLeft);
    document.removeEventListener('mouseup', stopResizeLeft);
  }, [resizeLeft]);

  // top right panel resize handlers
  const initResizeTopRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing('topRight');
    document.body.classList.add('resizing');
    document.addEventListener('mousemove', resizeTopRight);
    document.addEventListener('mouseup', stopResizeTopRight);
  }, []);

  const resizeTopRight = useCallback((e: MouseEvent) => {
    if (!containerRef.current || !isResizing) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerHeight = containerRect.height;

    // calculate new height for top right panel
    const newTopHeight = ((containerRect.bottom - e.clientY) / containerHeight) * 100;

    // apply constraints (min 20%, max 70%)
    const constrainedHeight = Math.max(20, Math.min(70, newTopHeight));

    // check for snap to default
    let finalHeight = constrainedHeight;
    if (Math.abs(constrainedHeight - defaultSizes.topRightPanel) < (snapThreshold / containerHeight) * 100) {
      finalHeight = defaultSizes.topRightPanel;
    }
    setSizes(prev => ({ ...prev, topRightPanel: finalHeight }));
  }, [isResizing]);

  const stopResizeTopRight = useCallback(() => {
    setIsResizing(null);
    document.body.classList.remove('resizing');
    document.removeEventListener('mousemove', resizeTopRight);
    document.removeEventListener('mouseup', stopResizeTopRight);
  }, [resizeTopRight]);

  // reset to default layout
  const resetLayout = useCallback(() => {
    setSizes(defaultSizes);
    setShowSnapIndicators(true);
    setTimeout(() => setShowSnapIndicators(false), 1000);
  }, []);

  // update layout when sizes change
  useEffect(() => {
    updateLayout(sizes);
  }, [sizes, updateLayout]);

  // cleanup event listeners
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', resizeLeft);
      document.removeEventListener('mouseup', stopResizeLeft);
      document.removeEventListener('mousemove', resizeTopRight);
      document.removeEventListener('mouseup', stopResizeTopRight);
    };
  }, [resizeLeft, stopResizeLeft, resizeTopRight, stopResizeTopRight]);
  
  return (
    <div className='min-h-screen bg-background text-foreground p-4 space-y-4'>
      <div className='container mx-auto max-w-6xl'>
        {/* <div className='flex flex-row space-x-2'>
          <h1 className='text-2xl font-bold mb-4'>Three Column Layout</h1>
          <div className='text-sm opacity-80'>
            Ping result: <span className='font-mono'>{pingResult || '...'}</span>
          </div>
          <div className='flex items-center gap-2'>
            <Button onClick={fetchDecks} disabled={loading}>
              {loading ? 'Loading decks...' : 'Get Decks'}
            </Button>
            {err && <span className='text-red-600 text-sm'>Error: {err}</span>}
          </div>
          {decks.length > 0 && (
            <ul className='list-disc pl-6'>
              {decks.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div> */}
        <div ref={containerRef} className='flex flex-col md:flex-row gap-4 h-[calc(100vh-6rem)]'>
          {/* Left Column - 40% width, full height */}
          <div ref={leftPanelRef} className='h-full overflow-hidden relative flex'>
            {/* Content area with scrollbar */}
            <div className='flex-1 p-2 pr-1 h-full overflow-y-auto'>
              <div className='flex flex-row space-x-4 border-b-1 mb-1.5'>
                <h2 className='text-lg font-semibold'>Decks</h2>
                <div className='flex items-center gap-2'>
                  <Button onClick={fetchDecks} disabled={loading} className='bg-blue-100'>
                    {loading ? 'Loading decks…' : 'Get Decks'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-sm font-normal">
                <div className="p-1 bg-blue-50 rounded-full">Item 1</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 2</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 3</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 4</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 5</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 6</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 7</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 8</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 9</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 10</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 11</div>
                <div className="p-1 bg-blue-50 rounded-full">Item 12</div>
              </div>
            </div>
            {/* Vertical resize handler for left column */}
            <div onMouseDown={initResizeLeft} className={`resize-handle horizontal w-3 flex-shrink-0 ${isResizing === 'left' ? 'active' : ''}`} style={{ pointerEvents: 'auto' }}
            />
          {/* Snap indicator for left column default position */}
          </div>
          <div className={`snap-indicator horizontal absolute ${showSnapIndicators ? 'active' : ''}`} style={{ right: `${100-defaultSizes.leftPanel}%`, top: '8rem', bottom: '2rem' }}
          />
          {/* Right Column - 60% width */}
          <div className='flex flex-col h-full overflow-hidden relative' style={{ width: `${100 - sizes.leftPanel}%` }}>
            {/* Top Row - 50% height */}
            <div className='overflow-hidden relative' style={{ height: `${sizes.topRightPanel}%` }}>
              {/* Content area with scrollbar (maybe) */}
              <div className='p-4 h-[calc(100%-8px)] overflow-y-auto'>
                <h2 className='text-xl font-semibold mb-4'>Top Right Row (50%)</h2>
                <div className='mt-4 space-y-2'>
                  <div className='p-2 bg-green-50 rounded'>Content A</div>
                  <div className='p-2 bg-green-50 rounded'>Content B</div>
                  <div className='p-2 bg-green-50 rounded'>Content C</div>
                </div>
              </div>
              {/* Horizontal resize handle for top right panel */}
              <div onMouseDown={initResizeTopRight} className={`resize-handle vertical h-3 w-full ${isResizing === 'topRight' ? 'active' : ''}`}style={{ pointerEvents: 'auto' }}/>
            </div>
            {/* Snap indicator for top right panel defalt position */}
            <div className={`snap-indicator vertical absolute ${showSnapIndicators ? 'active' : ''}`} style={{ bottom: `${100 - defaultSizes.topRightPanel}%`, left: '40%', right: '2rem' }}/>
            {/* Bottom Row - 50% height */}
            <div className='overflow-hidden' style={{ height: `${100 - sizes.topRightPanel}%` }}>
              <div className='p-4 h-full overflow-y-auto'>
                <h2 className='text-xl font-semibold mb-4'>Bottom Right Row (50%)</h2>
                <div className='mt-4 space-y-2'>
                  <div className='p-2 bg-yellow-50 rounded'>Content X</div>
                  <div className='p-2 bg-yellow-50 rounded'>Content Y</div>
                  <div className='p-2 bg-yellow-50 rounded'>Content Z</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Launch Health Modal (blocks via overlay) */}
      {showHealthModal && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop that "freezes" the app by capturing interactions */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Centered modal */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-2xl">
              <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusToClasses(overall)}`} />
                <h2 className="text-lg font-semibold">
                  App Health Check
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    {overall === "checking" ? "Checking…" : overall.toUpperCase()}
                  </span>
                </h2>
                <div className="ml-auto text-xs text-zinc-500">
                  {startedAt && <span>Started {new Date(startedAt).toLocaleTimeString()}</span>}
                  {finishedAt && <span className="ml-2">Finished {new Date(finishedAt).toLocaleTimeString()}</span>}
                </div>
              </div>

              <div className="px-4 py-3">
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusToClasses(r.status)}`} />
                        <span className="font-medium">{r.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs">
                          {r.status === "checking" && <span className="italic text-zinc-500">Checking…</span>}
                          {r.status === "ok" && <span className="text-emerald-600">OK</span>}
                          {r.status === "warn" && <span className="text-amber-600">Warning</span>}
                          {r.status === "fail" && <span className="text-rose-600">Failed</span>}
                          {r.status === "unknown" && <span className="text-zinc-500">Unknown</span>}
                        </div>
                        {r.detail && <div className="mt-0.5 text-[11px] text-zinc-500">{r.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-zinc-500">
                    {anyFailed
                      ? "Some checks failed. You can continue, but Anki-dependent actions may fail."
                      : allDone
                      ? "Health snapshot complete."
                      : "Running checks… please wait."
                    }
                  </div>
                  <div className="flex gap-2">
                    <button
                      className={anyFailed
                        ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
                        : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"}
                      onClick={runAllChecks}
                    >
                      Retry
                    </button>
                    <button
                      className={anyFailed
                        ? "rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                        : "rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"}
                      onClick={() => setShowHealthModal(false)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <>
        <LiveHealthPip />
      </>
      <style>{`
        .resize-handle {
          background-color: #e5e7eb;
          transition: background-color 0.2s;
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto !important;
        }
        
        .resize-handle:hover, .resize-handle.active {
          background-color: #3b82f6;
        }
        
        .resize-handle.horizontal {
          cursor: col-resize;
          width: 8px;
        }
        
        .resize-handle.vertical {
          cursor: row-resize;
          height: 8px;
        }
        
        .resize-handle::after {
          content: '';
          position: static;
          background-color: #9ca3af;
          transition: background-color 0.2s;
        }
        
        .resize-handle.horizontal::after {
          width: 2px;
          height: 24px;
          border-radius: 1px;
        }
        
        .resize-handle.vertical::after {
          width: 24px;
          height: 2px;
          border-radius: 1px;
        }
        
        .resize-handle:hover::after, .resize-handle.active::after {
          background-color: white;
        }
        
        .snap-indicator {
          position: absolute;
          background-color: #3b82f6;
          opacity: 0;
          transition: opacity 0.2s;
          z-index: 5;
        }
        
        .snap-indicator.active {
          opacity: 1;
        }
        
        .snap-indicator.horizontal {
          width: 2px;
        }
        
        .snap-indicator.vertical {
          width: 100%;
          height: 2px;
        }

        /* During resize, capture all pointer events */
        body.resizing {
          cursor: col-resize; /* or row-resize based on active resize */
          user-select: none;
        }

        body.resizing * {
          pointer-events: none;
        }

        body.resizing .resize-handle {
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
}