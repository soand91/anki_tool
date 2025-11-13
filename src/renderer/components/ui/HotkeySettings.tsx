import React, { useEffect, useMemo, useState, useRef } from 'react';
import Button from './Button';

type Mode = 'modal' | 'embedded';

type Row = { id: string; label: string };

const ROWS: Row[] = [
  { id: 'note.captureFront', label: 'Capture → Front' },
  { id: 'note.captureBack',  label: 'Capture → Back' },
  { id: 'note.add',          label: 'Add Note' },
  { id: 'note.undoCapture',  label: 'Undo Last Capture' },
  { id: 'app.showWindow',    label: 'Open & Focus Window' },
];

type Snapshot = {
  effective: Record<string, string>;
  issues?: Record<string, string | undefined>;
};

function coerceSnapshot(raw: any): Snapshot {
  // Accept both shapes: either { effective, issues } or a plain map
  if (raw && typeof raw === 'object' && raw.effective) {
    return { effective: raw.effective ?? {}, issues: raw.issues ?? {} };
  }
  return { effective: (raw ?? {}) as Record<string, string>, issues: {} };
}

const isMac = navigator.userAgent.includes('Mac');

function prettyAccelerator(accel: string): string {
  if (!accel) return '';
  return accel.split('+').map((part) => {
    switch (part) {
      case 'CommandOrControl':
      case 'CmdOrCtrl':
        return isMac ? 'Command' : 'Ctrl';
      case 'Meta':
        return isMac ? 'Command' : 'Meta';
      case 'Alt':
        return isMac ? 'Option' : 'Alt'
      case 'Shift':
        return 'Shift';
      case 'Plus':
        return '+';
      case 'Esc':
        return 'Esc';
      case 'Space':
        return 'Space';
      default:
        return part;
    }
  }).join('+');
}

function formatCombo(ev: KeyboardEvent) {
  // Build Electron-style accelerator string
  // require at least one modifier for safety
  const mods: string[] = [];
  if (ev.ctrlKey || ev.metaKey) mods.push('CommandOrControl');
  if (ev.shiftKey) mods.push('Shift');
  if (ev.altKey) mods.push('Alt');

  let key = ev.key;

  // normalize common keys to Electron's expectations
  const alias: Record<string, string> = {
    ' ': 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Esc: 'Esc', 
    ArrowUp: 'Up', 
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right', 
    '+': 'Plus',
    '=': '=',
    '-': '-',
    '_': '-',
  };

  if (alias[key]) key = alias[key];

  // single-letter keys: uppercase
  if (key.length === 1) key = key.toUpperCase();

  // block pure modifier keys as a 'key'
  const isPureModifier = ['Shift', 'Control', 'Alt', 'Meta'].includes(key);
  if (isPureModifier) return '';

  const combo = [...mods, key].join('+');
  // disallow no-modifier combos
  if (mods.length === 0) return '';
  return combo;
}

type Props = { mode?: Mode; registerReset?: (fn: () => Promise<void> | void) => void };

export default function HotkeySettings({ mode = 'embedded', registerReset }: Props) {
  const api = (window as any).api;
  const [open, setOpen] = useState(mode === 'embedded');
  const [recording, setRecording] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ effective: {}, issues: {} });
  const [pending, setPending] = useState<Record<string, string | null | undefined>>({});
  const detachListenerRef = useRef<(() => void) | null>(null);

  // Conflict helper (client-side)
  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const eff = snapshot.effective || {};
    ROWS.forEach(r => {
      const v = (pending[r.id] ?? eff[r.id]) || '';
      if (!v) return;
      const list = map.get(v) ?? [];
      list.push(r.id);
      map.set(v, list);
    });
    return map;
  }, [snapshot, pending]);
  
  // Open flow
  useEffect(() => {
    if (mode === 'embedded') {
      (async () => {
        try {
          await api.settings.hotkeys.suspend(true);
          const s = await api.settings.hotkeys.list();
          setSnapshot(coerceSnapshot(s));
          setPending({});
        } catch {}
      })();
      const offChanged = api.settings.hotkeys.onChanged?.((s: any) => {
        setSnapshot(coerceSnapshot(s));
      });
      return () => {
        if (typeof offChanged === 'function') offChanged();
        api.settings.hotkeys.suspend(false).catch(() => {});
      };
    } else {
      // legacy: open via IPC (open-settings with section='hotkeys' OR dedicated channel)
      const off = api.settings.onOpen?.((payload?: any) => {
        if (payload?.section === 'hotkeys' || payload?.section === undefined) {
          (async () => {
            setOpen(true);
            try {
              await api.settings.hotkeys.suspend(true);
              const s = await api.settings.hotkeys.list();
              setSnapshot(coerceSnapshot(s));
              setPending({});
            } catch {}
          })();
        }
      });
      const offChanged = api.settings.hotkeys.onChanged?.((s: any) => {
        setSnapshot(coerceSnapshot(s));
      });
      return () => {
        if (typeof off === 'function') off();
        if (typeof offChanged === 'function') offChanged();
      };
    }
  }, [mode]);

  // Key recorder
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const combo = formatCombo(ev);
      if (!combo) return; // ignore invalid/no-mod combos

      setPending(prev => ({ ...prev, [recording]: combo }));
      setRecording(null);
      // resume hotkeys immediately so user can keep using the app
      api.settings.hotkeys.suspend(false).catch(() => {});
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    detachListenerRef.current = () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    return () => {
      if (detachListenerRef.current) {
        detachListenerRef.current();
        detachListenerRef.current = null;
      }
    };
  }, [recording]);

  // Exposed reset function 
  useEffect(() => {
    if (!registerReset) return;
    registerReset(async () => {
      const api = (window as any).api.settings.hotkeys;
      await api.resetAll();
      const s = await api.list();
      setSnapshot(coerceSnapshot(s));
      setPending({});
    });
  }, [registerReset]);

  const effective = snapshot.effective || {};
  const issues = snapshot.issues || {};

  // UI blocks
  const Header = mode === 'modal' ? (
    <div className='flex items-center justify-between border-b border-zinc-200 px-4 py-3'>
      <div className='text-sm font-medium text-zinc-800'>Hotkeys</div>
      <div className='flex items-center gap-2'>
        <Button
          variant='solid'
          onClick={async () => {
            await api.settings.hotkeys.resetAll();
            const s = await api.settings.hotkeys.list();
            setSnapshot(coerceSnapshot(s));
            setPending({});
          }}
        >
          Reset to defaults
        </Button>
        <Button
          variant='outline'
          onClick={async () => {
            setOpen(false);
            await api.settings.hotkeys.suspend(false);
          }}
        >
          Close
        </Button>
      </div>
    </div>
  ) : null;

  const Table = (
    <table className='w-full text-sm'>
      <thead>
        <tr className='text-left text-xs text-zinc-500'>
          <th className='py-1'>Action</th>
          <th className='py-1'>Shortcut</th>
          <th className='py-1 w-48'>Set</th>
          <th className='py-1 w-28'></th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(r => {
          const current = (pending[r.id] ?? effective[r.id]) || '';
          const list = conflictMap.get(current) ?? [];
          const isConflicted = !!current && list.length > 1;
          const issue = issues[r.id];

          return (
            <tr key={r.id} className='border-t border-zinc-200'>
              <td className='py-2 min-w-[140px]'>{r.label}</td>
              <td className='py-2 min-w-[150px] pr-3'>
                <span
                  className={`rounded-md border px-2 py-1 ${
                    isConflicted ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-zinc-300 bg-white text-zinc-800'
                  }`}
                >
                  {current 
                    ? prettyAccelerator(current)
                    : <span className='text-zinc-400'>—</span>
                  }
                </span>
                {issue && <span className='ml-2 text-xs text-red-600'>{issue}</span>}
              </td>
              <td className='py-2 space-x-1.5'>
                {recording === r.id ? (
                  <span className='rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700'>
                    Press modifiers then a key…
                  </span>
                ) : (
                  <Button
                    variant='solid'
                    onClick={async () => {
                      await api.settings.hotkeys.suspend(true);
                      setRecording(r.id);
                    }}
                  >
                    Record
                  </Button>
                )}
                <Button
                  variant='outline'
                  onClick={() => setPending(prev => ({ ...prev, [r.id]: null }))}
                  title='Revert to default'
                >
                  Revert
                </Button>
              </td>
              <td className='py-2 text-right'>
                <Button
                  variant='outline'
                  disabled={isConflicted}
                  onClick={async () => {
                    const accel = pending[r.id] ?? null; // null => default
                    const res = await api.settings.hotkeys.set(r.id, accel);
                    if (!res?.ok) {
                      alert(`Failed: ${res?.reason ?? 'unknown'}`);
                    }
                    const s = await api.settings.hotkeys.list();
                    setSnapshot(coerceSnapshot(s));
                    setPending(prev => ({ ...prev, [r.id]: undefined }));
                  }}
                >
                  Save
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  if (mode === 'embedded') {
    return (
      <div className='px-1 py-1'>
        <div className='max-h-[60vh] overflow-auto'>{Table}</div>
        <div className='mt-2 text-[11px] text-zinc-500'>
          Require at least one modifier (Ctrl/Cmd/Alt/Shift). Some system shortcuts may be blocked by the OS.
        </div>
      </div>
    );
  }

  // modal mode
  if (!open) return null;
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
      <div className='w-[560px] max-w-[90vw] rounded-xl bg-white shadow-xl'>
        {Header}
        <div className='max-h-[70vh] overflow-auto px-4 py-3'>{Table}</div>
        <div className='border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-500'>
          Require at least one modifier (Ctrl/Cmd/Alt/Shift). Some system shortcuts may be blocked by the OS.
        </div>
      </div>
    </div>
  );
}
