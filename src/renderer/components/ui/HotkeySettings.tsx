import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button';

type Row = {
  id: string;
  label: string;
};

const ROWS: Row[] = [
  { id: 'note.captureFront', label: 'Capture → Front' },
  { id: 'note.captureBack',  label: 'Capture → Back' },
  { id: 'note.add',          label: 'Add Note' },
  { id: 'note.undoCapture',  label: 'Undo Last Capture' },
  { id: 'app.showWindow', label: 'Open & Focus Window' },
];

type Snapshot = {
  defaults: Record<string, string>;
  overrides: Record<string, string>;
  effective: Record<string, string>;
  inactive: string[];
  issues: Record<string, string | undefined>;
};

type Mode = 'modal' | 'embedded';
type ResetFn = () => void | Promise<void>;

type Props = {
  mode?: Mode;
  registerReset?: (fn: ResetFn) => void;
};

const isMacRuntime =
  typeof window !== 'undefined' &&
  ((window as any).env?.isMac === true ||
    /Mac|iPhone|iPad|iPod/.test(
      (navigator && (navigator as any).platform) ||
        (navigator && (navigator as any).userAgent) ||
        ''
    ));

/**
 * Convert a KeyboardEvent into a canonical accelerator string for storage/main.
 * Returns null if the combo isn’t “commit-worthy”.
 */
function normalizeAccelFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (isMacRuntime ? e.metaKey : e.ctrlKey) {
    mods.push(isMacRuntime ? 'Command' : 'Control');
  }
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');

  const key = e.key;
  if (!key) return null;

  const isModifier =
    key === 'Shift' || key === 'Control' || key === 'Meta' || key === 'Alt';
  if (isModifier) return null;

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

  if (mods.length === 0) return null; // must have at least one modifier

  return [...mods, main].join('+');
}

/**
 * Human-friendly display for an accelerator.
 */
function prettyAccelerator(accel: string): string {
  if (!accel) return '';
  return accel
    .split('+')
    .map(part => {
      switch (part) {
        case 'Command':
        case 'Meta':
          return isMacRuntime ? '⌘' : 'Win';
        case 'Control':
          return isMacRuntime ? '⌃' : 'Ctrl';
        case 'Alt':
          return isMacRuntime ? '⌥' : 'Alt';
        case 'Shift':
          return isMacRuntime ? '⇧' : 'Shift';
        default:
          return part;
      }
    })
    .join(isMacRuntime ? '' : '+');
}

function canonicalizeAccelForCompare(accel: string | null | undefined): string {
  if (!accel) return '';
  const parts = String(accel).split('+').map(p => p.trim()).filter(Boolean);

  const mods: string[] = [];
  let main = '';

  for (const part of parts) {
    switch (part) {
      case 'Command':
      case 'Meta':
      case 'CommandOrControl':
      case 'CmdOrCtrl':
        mods.push('CMDORCTRL'); // logical “either Cmd or Ctrl”
        break;
      case 'Control':
      case 'Ctrl':
        mods.push('CTRL');      // if you want to distinguish, otherwise also 'CMDORCTRL'
        break;
      case 'Alt':
        mods.push('ALT');
        break;
      case 'Shift':
        mods.push('SHIFT');
        break;
      default:
        main = part;
        break;
    }
  }

  mods.sort(); // ensure stable order: ALT+CMDORCTRL+SHIFT, etc.
  return [...mods, main].join('+');
}

// Combos you never want to allow
const BLOCKED = new Set<string>([
  isMacRuntime ? 'Command+Q' : 'Alt+F4',
  isMacRuntime ? 'Command+W' : 'Control+Q',
]);

const HotkeySettings: React.FC<Props> = ({ mode = 'modal', registerReset }) => {
  const api = (window as any).api;

  const [open, setOpen] = useState(mode === 'embedded');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [liveCombo, setLiveCombo] = useState<string>(''); // live preview
  const [localIssues, setLocalIssues] = useState<Record<string, string | undefined>>({});
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);

  // Load + open wiring
  useEffect(() => {
    let unsubOpen: (() => void) | undefined;
    let unsubChanged: (() => void) | undefined;

    const loadSnapshot = async () => {
      try {
        const s = await api.noteHotkeys.getAll();
        setSnapshot(s);
        setPending({});
      } catch (err) {
        console.error('[hotkeys] failed to load snapshot', err);
      }
    };

    if (mode === 'embedded') {
      setOpen(true);
      (async () => {
        await api.noteHotkeys.suspend(true);
        await loadSnapshot();
      })();
      unsubChanged = api.noteHotkeys.onChanged((s: Snapshot) => {
        setSnapshot(s);
      });
    } else {
      unsubOpen = api.noteHotkeys.onOpenPanel(async () => {
        setOpen(true);
        await api.noteHotkeys.suspend(true);
        await loadSnapshot();
      });
      unsubChanged = api.noteHotkeys.onChanged((s: Snapshot) => {
        setSnapshot(s);
      });
    }

    return () => {
      if (typeof unsubOpen === 'function') unsubOpen();
      if (typeof unsubChanged === 'function') unsubChanged();
    };
  }, [mode, api]);

  // Register “reset to defaults” handler with parent Settings modal
  useEffect(() => {
    if (!registerReset) return;
    registerReset(async () => {
      await api.noteHotkeys.resetAll();

      setPending({});
      setLocalIssues({});
      setLiveCombo('');
      setRecording(null);
    });
  }, [registerReset, api]);

  const rows = useMemo<Row[]>(() => [...ROWS], []);

  const effective = snapshot?.effective ?? {};
  const issuesFromBackend = snapshot?.issues ?? {};

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

  const snapshotRef = useRef(snapshot);
  const pendingRef = useRef(pending);
  
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Recording: keyboard + click-outside
  useEffect(() => {
    if (!recording) {
      setLiveCombo('');
      return;
    }
    const currentId = recording;
    if (!currentId) {
      setLiveCombo('');
      return;
    }

    const onKeyDown = async (e: KeyboardEvent) => {
      // ESC = cancel recording
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setRecording(null);
        setLiveCombo('');
        setLocalIssues(prev => ({ ...prev, [recording]: undefined }));
        return;
      }

      // Delete / Backspace = revert to default
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        setPending(prev => ({ ...prev, [recording]: null }));
        setRecording(null);
        setLiveCombo('');
        setLocalIssues(prev => ({ ...prev, [recording]: undefined }));
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Build preview first (even for invalid combos)
      const mods: string[] = [];
      if (isMacRuntime ? e.metaKey : e.ctrlKey) {
        mods.push(isMacRuntime ? 'Command' : 'Control');
      }
      if (e.shiftKey) mods.push('Shift');
      if (e.altKey) mods.push('Alt');

      const key = e.key;
      const isModifierOnly =
        key === 'Shift' || key === 'Control' || key === 'Meta' || key === 'Alt';

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

      const previewParts = isModifierOnly ? mods : [...mods, main];
      const previewAccel = previewParts.length ? previewParts.join('+') : '';
      setLiveCombo(previewAccel);

      const hasAnyModifier = mods.length > 0;
      if (!hasAnyModifier) {
        setLocalIssues(prev => ({
          ...prev,
          [recording]:
            'Shortcuts must include Ctrl/Cmd, Alt, or Shift.',
        }));
        return;
      }

      if (isModifierOnly) {
        setLocalIssues(prev => ({
          ...prev,
          [recording]: 'Press a non-modifier key to finish the shortcut.',
        }));
        return;
      }

      const accel = normalizeAccelFromEvent(e);
      if (!accel) {
        setLocalIssues(prev => ({
          ...prev,
          [recording]: 'This shortcut is invalid.',
        }));
        return;
      }

      const accelNorm = canonicalizeAccelForCompare(accel);

      const dupeOwners = rows
        .filter(r => r.id !== recording)
        .filter(r => {
          const originalAssignment = snapshotRef.current?.effective[r.id];
          const pendingAssignment = pendingRef.current[r.id];

          const existing = pendingAssignment ?? originalAssignment;
          if (!existing) return false;

          const existingNorm = canonicalizeAccelForCompare(existing);
          return existingNorm === accelNorm;
        });

      if (dupeOwners.length > 0) {
        const names = dupeOwners.map(r => r.label).join(', ');
        setLocalIssues(prev => ({
          ...prev,
          [recording]: `Already used by: ${names}`,
        }));
        return;
      }

      if (BLOCKED.has(accel)) {
        setLocalIssues(prev => ({
          ...prev,
          [recording]: 'This shortcut is reserved by the app or OS.',
        }));
        return;
      }

      // Good combo – commit
      setLocalIssues(prev => ({ ...prev, [recording]: undefined }));
      setPending(prev => ({ ...prev, [recording]: accel }));
      setRecording(null);
      setLiveCombo('');
    };

    const onClick = (ev: MouseEvent) => {
      const rowEl = activeRowRef.current;
      if (!rowEl) return;
      const target = ev.target as HTMLElement;
      if (!rowEl.contains(target)) {
        setRecording(null);
        setLiveCombo('');
        setLocalIssues(prev => ({ ...prev, [currentId]: undefined }));
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('mousedown', onClick, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true } as any);
      document.removeEventListener('mousedown', onClick, true);
    };
  }, [recording, api]);

  if (!open) return null;

  return (
    <div
      className={
        mode === 'modal'
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/40'
          : ''
      }
    >
      <div
        className={
          mode === 'modal'
            ? 'w-[560px] max-w-[90vw] rounded-xl bg-white shadow-xl dark:bg-[#323232]'
            : ''
        }
      >
        {mode === 'modal' && (
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-950">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-300">Hotkeys</div>
            <div className="flex items-center gap-2">
              <Button
                variant="solid"
                onClick={async () => {
                  await api.noteHotkeys.resetAll();
                  const s = await api.noteHotkeys.getAll();
                  setSnapshot(s);
                  setPending({});
                  setLocalIssues({});
                  setLiveCombo('');
                  setRecording(null);
                }}
              >
                Reset to defaults
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setOpen(false);
                  setRecording(null);
                  setLiveCombo('');
                  setLocalIssues({});
                  await api.noteHotkeys.suspend(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}

        <div
          className={
            mode === 'modal'
              ? 'max-h-[70vh] overflow-auto px-4 py-3'
              : ''
          }
        >
          <table className="table-fixed w-[572px] text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-300">
                <th className="w-5/23 py-1">Action</th>
                <th className="w-6/23 py-1">Shortcut</th>
                <th className="w-10/23 py-1">Set</th>
                <th className="w-2/23 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const backendIssue = issuesFromBackend[r.id];
                const localIssue = localIssues[r.id];
                const displayIssue = backendIssue || localIssue;

                const eff = pending[r.id] ?? effective[r.id] ?? '';
                const conflictFor = conflictMap.get(eff) ?? [];
                const isConflicted = eff && conflictFor.length > 1;

                const isRecordingRow = recording === r.id;
                const currentValue = isRecordingRow
                  ? liveCombo || eff
                  : eff;

                const hasIssue = isConflicted || !!displayIssue;

                return (
                  <tr
                    key={r.id}
                    ref={isRecordingRow ? activeRowRef : null}
                    className="border-t border-zinc-200 dark:border-zinc-400"
                  >
                    <td className="py-2 min-w-[140px] dark:text-zinc-300">{r.label}</td>
                    <td className="py-2 min-w-[150px] pr-3 align-top">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`rounded-md border px-2 py-1 h-[30px] ${
                            hasIssue
                              ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-zinc-300 bg-white text-zinc-800 dark:border-zinc-950 dark:bg-zinc-700 dark:text-zinc-400'
                          }`}
                        >
                          {currentValue ? (
                            prettyAccelerator(currentValue)
                          ) : (
                            <span className="text-zinc-400">
                              {isRecordingRow ? 'Press keys…' : '—'}
                            </span>
                          )}
                        </span>
                        {displayIssue && (
                          <span className="text-[11px] text-red-600 leading-snug">
                            {displayIssue}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 space-x-1.5 align-top">
                      {isRecordingRow ? (
                        <span className="inline-flex items-center rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 h-[30px]">
                          Press Esc to cancel, Delete to revert.
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="solid"
                            onClick={async () => {
                              await api.noteHotkeys.suspend(true);
                              setRecording(r.id);
                              setLiveCombo('');
                              setLocalIssues(prev => ({
                                ...prev,
                                [r.id]: undefined,
                              }));
                            }}
                          >
                            {isRecordingRow ? 'Recording…' : 'Record'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPending(prev => ({ ...prev, [r.id]: null }));
                              setLocalIssues(prev => ({ ...prev, [r.id]: undefined }));
                              if (recording === r.id) {
                                setRecording(null);
                                setLiveCombo('');
                              }
                            }}
                            title="Revert to default"
                          >
                            Revert
                          </Button>
                        </>
                      )}
                    </td>
                    <td className="py-2 text-right align-top">
                      <Button
                        variant="outline"
                        disabled={isConflicted || !!localIssues[r.id]}
                        onClick={async () => {
                          const accel = pending[r.id] ?? null;
                          const res = await api.noteHotkeys.set(r.id, accel);
                          if (!res?.ok) {
                            alert(`Failed: ${res?.reason ?? 'unknown'}`);
                            return;
                          }
                          const s = await api.noteHotkeys.getAll();
                          setSnapshot(s);
                          setPending(prev => ({
                            ...prev,
                            [r.id]: undefined as any,
                          }));
                          setLocalIssues(prev => ({
                            ...prev,
                            [r.id]: undefined,
                          }));
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
        </div>

        {mode === 'modal' && (
          <div className="border-t border-zinc-200 px-4 py-2 text-[11px] text-zinc-500">
            Require at least one modifier (Ctrl/Cmd, Alt, or Shift). Some system shortcuts may be blocked by the OS.
          </div>
        )}
      </div>
    </div>
  );
};

export default HotkeySettings;
