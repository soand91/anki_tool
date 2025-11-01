import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from './components/ui/Button';
import { useAppStore } from './state/appStore';
import { runAllChecks } from '../main/health/runHealth';
import LiveHealthPip from './components/LiveHealthPip';

type HealthCheckId =
    | 'anki.process'
    | 'ankiconnect.http'
    | 'ankiconnect.version'
    | 'ankiconnect.addNoteDryRun';

type HealthStatus = 'unknown' | 'checking' | 'ok' | 'warn' | 'fail';

type HealthCheckRow = {
    id: HealthCheckId;
    label: string;
    status: HealthStatus;
    detail?: string;
    startedAt?: number;
    finishedAt?: number;
};

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
  // first-launch-only gate (renderer-only, no main wiring)
  const [showHealthModal, setShowHealthModal] = useState(false);
  // table set for the four checks
  const [rows, setRows] = useState<HealthCheckRow[]>(
    CHECKS.map(c => ({ id: c.id, label: c.label, status: 'unknown' }))
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const allDone = useMemo(() => rows.every(r => r.status !== 'checking' && r.status !== 'unknown'), [rows]);
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
    // util to call IPC (to be implemented later in preload/main)
    const callCheck = async (id: HealthCheckId) => {
      try {
        // @ts-ignore - will exist after you wire preload
        const res = await window.api?.healthCheck?.(id);
        // expected: { id, status: 'ok'|'warn'|'fail', detail?, startedAt? }   
        const status: HealthStatus = (res?.status === 'ok' || res?.status === 'warn' || res?.status === 'fail')
          ? res.status
          : 'fail';
        const detail: string | undefined = res?.detail ?? 'No detail';
        return { id, status, detail };
      } catch (e: any) {
        return { id, status: "fail" as HealthStatus, detail: e?.message ?? String(e) };      
      }
    };

    // run in parallel; you can swap to sequential if you prefer ordering
    const results = await Promise.all(CHECKS.map(c => callCheck(c.id)));

    const finished = Date.now();
    setRows(prev =>
      prev.map(r => {
        const got = results.find(x => x.id === r.id);
        return got
          ? { ...r, status: got.status, detail: got.detail, finishedAt: finished }
          : { ...r, status: "fail", detail: "No response", finishedAt: finished };
      })
    );
    setFinishedAt(finished);
    sessionStorage.setItem('healthLaunchDone', '1');
    // keep modal showing results briefly; auto-close after 600ms
    // setTimeout(() => setShowHealthModal(false), 600);
  }, []);

  // overall headline status (for the modal header)
  const overall: HealthStatus = useMemo(() => {
    if (rows.some(r => r.status === "fail")) return "fail";
    if (rows.some(r => r.status === "checking")) return "checking";
    if (rows.some(r => r.status === "warn")) return "warn";
    if (rows.every(r => r.status === "ok")) return "ok";
    return "unknown";
  }, [rows]);

  const { healthy, setHealthy } = useAppStore();
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

  return (
    <div className='min-h-screen bg-background text-foreground p-6 space-y-4'>
      <header>
        <h1 className='text-2xl font-semibold'>Hello, Electron + React</h1>
        <p className='mt-1'>Health: {healthy ? 'ok' : 'not ready'}</p>
        <Button className='mt-3' onClick={() => setHealthy(!healthy)}>
          Toggle Health
        </Button>
      </header>

      <section className='space-y-2'>
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
      </section>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Your App</h1>
        <p className="text-sm text-zinc-600">Renderer-first health slice — launch gate.</p>
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
                    {allDone
                      ? "Health snapshot complete."
                      : "Running checks… please wait."}
                  </div>
                  <div className="flex gap-2">
                    {!allDone && (
                      <button
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                        onClick={() => {
                          // allow manual retry while running (optional)
                          runAllChecks();
                        }}
                      >
                        Retry
                      </button>
                    )}
                    {allDone && (
                      <button
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
                        onClick={() => setShowHealthModal(false)}
                      >
                        Continue
                      </button>
                    )}
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
    </div>
  );
}