// src/renderer/components/settings/AdvancedSettings.tsx
import React, { useEffect, useState } from 'react';
import { useNoteDraftStore } from '../../state/noteStore';
import Button from './Button';

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
    <div className='space-y-4'>
      <div className='pr-3'>
        <div className='text-sm font-medium text-zinc-800 dark:text-zinc-300'>
          System signature tag
        </div>
        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
          This tag is automatically added to notes created by this app so it can
          find them later. It should be stable across all notes.
        </p>
        <div className='mt-2 flex items-center gap-2'>
          <input
            type='text'
            className='h-[30px] flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-300 hover:borde-zinc-500 hover:bg-zinc-100 transition-all duration-200 dark:hover:border-zinc-600 dark:hover:bg-[#323232] dark:border-zinc-950 dark:text-zinc-100 dark:bg-zinc-800 dark:focus:ring-zinc-600'
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={DEFAULT_SIGNATURE}
            spellCheck={false}
          />

          <Button
            type='button'
            variant='outline'
            onClick={handleResetLocal}
            disabled={value === DEFAULT_SIGNATURE}
          >
            Reset
          </Button>

          <Button
            type='button'
            variant='solid'
            onClick={handleSave}
            disabled={!dirty}
          >
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>
        {error && (
          <p className='mt-2 text-[11px] text-red-500'>{error}</p>
        )}
      </div>
    </div>
  );
}
