// src/renderer/components/settings/AdvancedSettings.tsx
import React, { useEffect, useState } from 'react';
import { useNoteDraftStore } from '../../state/noteStore';

type Props = {
  registerReset?: (fn: () => void | Promise<void>) => void;
};

const DEFAULT_SIGNATURE = 'anki_tool';

export default function AdvancedSettings({ registerReset }: Props) {
  const setSignatureTagInStore = useNoteDraftStore(s => s.setSignatureTag);

  const [value, setValue] = useState(DEFAULT_SIGNATURE);
  const [initial, setInitial] = useState(DEFAULT_SIGNATURE);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load from prefs on mount (once)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sig = await (window as any).api.settings.prefs.get('signatureTag');
        if (cancelled) return;

        const clean = (sig ?? '').toString().trim() || DEFAULT_SIGNATURE;
        setValue(clean);
        setInitial(clean);

        // keep draft store in sync on first load
        setSignatureTagInStore(clean);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Failed to load signature tag.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setSignatureTagInStore]);

  const effective = (value || '').trim();
  const dirty = effective !== initial.trim();

  async function handleSave() {
    try {
      setError(null);
      const clean = effective || DEFAULT_SIGNATURE;

      // persist to main-side prefs
      await (window as any).api.settings.prefs.set('signatureTag', clean);
      // update the draft store so new notes use it immediately
      setSignatureTagInStore(clean);

      setInitial(clean);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save signature tag.');
    }
  }

  function handleResetLocal() {
    setValue(DEFAULT_SIGNATURE);
    setError(null);
    setSaved(false);
  }

  // Let SettingsModal's "Reset all" call the same local reset
  useEffect(() => {
    if (!registerReset) return;
    registerReset(() => {
      setValue(DEFAULT_SIGNATURE);
      setError(null);
      setSaved(false);
    });
  }, [registerReset]);

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900'>
      <label className='block text-xs font-medium text-zinc-700 dark:text-zinc-200'>
        System signature tag
      </label>
      <p className='mt-1 text-[11px] text-zinc-500 dark:text-zinc-400'>
        This tag is automatically added to notes created by this app so it can
        find them later. It should be stable across all notes.
      </p>

      <div className='mt-2 flex items-center gap-2'>
        <input
          type='text'
          className='flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-50'
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={DEFAULT_SIGNATURE}
          spellCheck={false}
        />

        <button
          type='button'
          className='rounded-md border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
          onClick={handleResetLocal}
          disabled={value === DEFAULT_SIGNATURE}
        >
          Reset
        </button>

        <button
          type='button'
          className='rounded-md bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
          onClick={handleSave}
          disabled={!dirty}
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {error && (
        <p className='mt-2 text-[11px] text-red-500'>{error}</p>
      )}
    </div>
  );
}
