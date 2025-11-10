import React, { useEffect, useMemo, useState } from 'react';

type Row = {
  id: string;
  label: string;
};

const ROWS: Row[] = [
  { id: 'note.captureFront', label: 'Capture → Front' },
  { id: 'note.captureBack',  label: 'Capture → Back' },
  { id: 'note.add',          label: 'Add Note' },
  { id: 'note.undoCapture',  label: 'Undo Last Capture' },
];

function normalizeAccelFromEvent(e: KeyboardEvent): string | null {
  const isMac = (window as any).env?.isMac === true;
  const mods: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) mods.push(isMac ? 'Command' : 'Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const key = e.key;
  if (!key) return null;

  // Must include a non-modifier key to finalize
  const isModifier = key === 'Shift' || key === 'Control' || key === 'Meta' || key === 'Alt';
  if (isModifier) return null; // keep waiting until user presses the actual key

  // Map some special keys to Electorn-friendly names
  const namedMap: Record<string, string> = {
    ArrowUp: 'Up', 
    ArrowDown: 'Down', 
    ArrowLeft: 'Left', 
    ArrowRight: 'Right', 
    ' ': 'Space', 
    Escape: 'Esc', 
    Enter: 'Enter',
    Backspace: 'Backspace', 
    Delete: 'Delete', 
    Tab: 'Tab',
  };
  let main = namedMap[key] ?? key;
  if (main.length === 1) main = main.toUpperCase();
  // Electron expects '+' literally; '=' key on US layout is '=' (Shift+= produces '+', but we want the base key label)

  // require at least one modifier 
  if (mods.length === 0) return null;
  return [...mods, main].join('+');
}

export default function HotkeySettings() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    defaults: Record<string, string>,
    overrides: Record<string, string>,
    effective: Record<string, string>,
    inactive: string[],
    issues: Record<string, string | undefined>
  } | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string | null>>({}); // id -> accelerator|null

  useEffect(() => {
    const unsubOpen = (window as any).api.noteHotkeys.onOpenPanel(async () => {
      setOpen(true);
      await (window as any).api.noteHotkeys.suspend(true);
      const s = await (window as any).api.noteHotkeys.getAll();
      setSnapshot(s);
      setPending({});
    });
    const unsubChanged = (window as any).api.noteHotkeys.onChanged((s: any) => {
      setSnapshot(s);
    });
    return () => {
      if (typeof unsubOpen === 'function') unsubOpen();
      if (typeof unsubChanged === 'function') unsubChanged();
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = async (e: KeyboardEvent) => {
      // Allow Esc to cancel recording
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setRecording(null);
        await (window as any).api.noteHotkeys.suspend(false);
        return;
      }
      // Allow Delete to revert to default (null override)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        setPending(prev => ({ ...prev, [recording]: null }));
        setRecording(null);
        await (window as any).api.noteHotkeys.suspend(false);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const accel = normalizeAccelFromEvent(e);
      if (!accel) {
        // still only modifiers pressed - keep waiting.
        return;
      }
      setPending(prev => ({ ...prev, [recording]: accel }));
      setRecording(null);
      await (window as any).api.noteHotkeys.suspend(false);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
  }, [recording]);

  useEffect(() => {
    return () => { (window as any).api.noteHotkeys.suspend(false).catch(() => {}); };
  }, []);

  const rows = ROWS;
  const effective = snapshot?.effective ?? {};
  const overrides = snapshot?.overrides ?? {};
  const issues = snapshot?.issues ?? {};

  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of rows.map(r => r.id)) {
      const eff = (pending[id] ?? effective[id]) as string | undefined;
      if (!eff) continue;
      const list = map.get(eff) ?? [];
      list.push(id);
      map.set(eff, list);
    }
    return map;
  }, [pending, effective, rows]);

  if (!open) return null;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
      <div className='w-[560px] max-w-[90vw] rounded-xl bg-white shadow-xl'>
        <div className='flex items-center justify-between border-b border-zinc-200 px-4 py-3'>
          <div className='text-sm font-medium text-zinc-800'>Hotkeys</div>
          <div className='flex items-center gap-2'>
            <button
              className='rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50'
              onClick={async () => {
                await (window as any).api.noteHotkeys.resetAll();
                const s = await (window as any).api.noteHotkeys.getAll();
                setSnapshot(s);
                setPending({});
              }}
            >
              Reset to defaults
            </button>
            <button
              className='rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-50'
              onClick={async () => {
                setOpen(false);
                await (window as any).api.noteHotkeys.suspend(false);
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div className='max-h-[70vh] overflow-auto px-4 py-3'>
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
              {rows.map(r => {
                const current = (pending[r.id] ?? effective[r.id]) || '';
                const isConflicted = (conflictMap.get(current)?.length ?? 0) > 1;
                const issue = issues[r.id];
                return (
                  <tr key={r.id} className='border-t border-zinc-100'>
                    <td className='py-2'>{r.label}</td>
                    <td className='py-2'>
                      <span className={`rounded-md border px-2 py-1 ${isConflicted ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-zinc-300 bg-white text-zinc-800'}`}>
                        {current || <span className='text-zinc-400'>—</span>}
                      </span>
                      {issue && <span className='ml-2 text-xs text-red-600'>{issue}</span>}
                    </td>
                    <td className='py-2'>
                      {recording === r.id ? (
                        <span className='rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700'>
                          Press modifiers then a key…
                        </span>
                      ) : (
                        <button
                          className='rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50'
                          onClick={async () => {
                            await (window as any).api.noteHotkeys.suspend(true);
                            setRecording(r.id);
                          }}
                        >
                          Record
                        </button>
                      )}
                      <button
                        className='ml-2 rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50'
                        onClick={() => setPending(prev => ({ ...prev, [r.id]: null }))}
                        title='Revert to default'
                      >
                        Revert
                      </button>
                    </td>
                    <td className='py-2 text-right'>
                      <button
                        className='rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50'
                        disabled={isConflicted}
                        onClick={async () => {
                          const accel = pending[r.id] ?? null; // null => default
                          const res = await (window as any).api.noteHotkeys.set(r.id, accel);
                          if (!res.ok) {
                            // naive error surface; replace with toast if you have one
                            alert(`Failed: ${res.reason ?? 'unknown'}`);
                          }
                          const s = await (window as any).api.noteHotkeys.getAll();
                          setSnapshot(s);
                          setPending(prev => ({ ...prev, [r.id]: undefined as any }));
                        }}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className='border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-500'>
          Require at least one modifier (Ctrl/Cmd/Alt/Shift). Some system shortcuts may be blocked by the OS.
        </div>
      </div>
    </div>
  );
}
