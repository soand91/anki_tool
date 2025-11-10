import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useNoteDraft } from '../../hooks/useNoteDraft';
import { useDeckStore } from '../../state/deckStore';

type Props = {
  ankiconnectHealthy: boolean;
};

export default function NotePreviewEditor({ ankiconnectHealthy }: Props) {
  const {
    draft,
    modelNameEffective,
    clozeDetected,
    setField,
    setTags,
    setSignatureTag,
    setModelName,
    addMedia,
    deleteMedia,
    reset,
    canSubmit,
    toSanitizedAnkiPayload,
    sanitizeHtml
  } = useNoteDraft();

  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  const [confirmingClear, setConfirmingClear] = useState(false);
  const clearTimerRef = useRef<number | null>(null);
  
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);

  const deckName = useDeckStore(s => s.getSelectedDeckName());

  // keep contentEditable in sync with store
  useEffect(() => {
    if (frontRef.current && frontRef.current.innerHTML !== draft.frontHtml) {
      frontRef.current.innerHTML = draft.frontHtml || '';
    }
  }, [draft.frontHtml]);

  useEffect(() => {
    if (backRef.current && backRef.current.innerHTML !== draft.backHtml) {
      backRef.current.innerHTML = draft.backHtml || '';
    }
  }, [draft.backHtml]);

  const handleInput = (side: 'front' | 'back') => (e: React.FormEvent<HTMLDivElement>) => {
    const html = (e.currentTarget as HTMLDivElement).innerHTML || '';
    setField(side, html);
  };

  const isDraftDirty = (() => {
    const hasFront = (draft.frontHtml ?? '').trim().length > 0;
    const hasBack = (draft.backHtml ?? '').trim().length > 0;
    const hasMedia = (draft.media?.length ?? 0) > 0;
    const hasExtraTags = (draft.tags?.length ?? 0) > 1;
    return hasFront || hasBack || hasMedia || hasExtraTags;
  })();

  const cancelClearCountdown = () => {
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  };

  const handleClear = () => {
    if (!isDraftDirty) {
      reset();
      return;
    }
    if (!confirmingClear) {
      setConfirmingClear(true);
      cancelClearCountdown();
      clearTimerRef.current = window.setTimeout(() => setConfirmingClear(false), 5000);
      return;
    }
    // confirmed
    cancelClearCountdown();
    setConfirmingClear(false);
    reset();
  };

  const onAddNote = async () => {
    try {
      const payload = toSanitizedAnkiPayload();
      const res = await (window as any).api.note.addNote({
        ...payload,
        deckName: deckName ?? undefined
      });
      // success UX
      alert(`Added note id: ${res?.noteId ?? 'unknown'}`);
      reset();
    } catch (err: any) {
      alert(`Add note failed: ${err?.message ?? String(err)}`);
    }
  };

  const disabled = !canSubmit(ankiconnectHealthy);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current != null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const unsub = (window as any).api.note.onNoteAddRequest(async () => {
      const disabled = !canSubmit(ankiconnectHealthy);
      if (!disabled) {
        await onAddNote();
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [canSubmit, ankiconnectHealthy]);

  return (
    <div className='flex h-full flex-col pb-1.5'>
      {/* Header */}
      <div className='cursor-default mb-1.25 flex items-center justify-between border-b border-zinc-200 px-3 py-1'>
        <div className="flex flex-1 flex-col min-w-0 flex-shrink overflow-hidden">
          <h2 className="truncate text-sm font-semibold text-zinc-800">Note Preview</h2>
          <span className="truncate text-[11px] text-zinc-500" title={deckName || undefined}>
            Selected Deck: {deckName || 'Default'}
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          {/* Model selector */}
          <div className='flex items-center gap-1 flex-shrink-0'>
            <label className='text-xs text-zinc-500'>Model</label>
            <select
              className='flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-white px-1 py-1 text-sm h-[30px]'
              value={draft.userForcedModel ?? 'Auto'}
              onChange={(e) => {
                const val = e.target.value as 'Basic' | 'Cloze' | 'Auto';
                if (val === 'Auto') setModelName(null);
                else setModelName(val);
              }}
            >
              <option value='Auto'>Auto ({modelNameEffective})</option>
              <option value='Basic'>Basic</option>
              <option value='Cloze'>Cloze</option>
            </select>
          </div>
          {/* Actions */}
          <button
            className={`flex-shrink-0 cursor-pointer rounded-md text-white px-2.5 py-1.5 text-xs h-[30px] ${disabled ? 'bg-zinc-300' : 'bg-zinc-900 hover:bg-zinc-700 hover:shadow-sm hover:text-zinc-200 transition-all duration-200'}`}
            onClick={onAddNote}
            disabled={disabled}
            title={disabled ? 'Front required and AnkiConnect must be available' : 'Add note'}
          >
            Add Note
          </button>
          {!confirmingClear ? (
            <button 
              className='flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 hover:shadow-sm hover:text-zinc-900 transition-all duration-200 h-[30px]'
              onClick={handleClear}
              title={isDraftDirty ? 'Click again to confirm' : 'Clear'}
            >
              Clear
            </button>
          ) : (
            <div className='flex items-center gap-2'>
              <button 
                className='flex-shrink-0 cursor-pointer rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100 transition-all duration-200 h-[30px]'
                onClick={handleClear}
                title='This will discard current draft'
              >
                Confirm
              </button>
              <button
                className='flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 hover:shadow-sm hover:text-zinc-900 transition-all duration-200 h-[30px]'
                onClick={() => { cancelClearCountdown(); setConfirmingClear(false); }}
                title='Cancel'
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Editors */}
      <div className='border-b border-zinc-200 flex-1 space-y-1 overflow-auto pr-1.5 pl-1.5 scrollbar'>
        {/* Front */}
        <div className='rounded-xl border border-zinc-200'>
          <div className='flex items-center justify-between border-b border-zinc-100 px-3 py-0.75'>
            <span className='text-xs font-medium text-zinc-600'>Front</span>
            <div className='flex items-center gap-2'>
              {/* Helper text */}
              {clozeDetected && (
                <span className='rounded-md bg-amber-50 p-0 text-[10px] text-amber-700'>
                  Cloze detected
                </span>
              )}
              <div className='px-1 text-[10px] text-zinc-500'>
                Front is required. {modelNameEffective === 'Cloze' && !clozeDetected ? 'Cloze selected but no {{cX::...}} found.' : ''}
              </div>
              <span className='text-[10px] text-zinc-400'>
                {draft.frontHtml.replace(/<[^>]*>/g, '').length} chars
              </span>
            </div>
          </div>
          <div
            ref={frontRef}
            className='min-h-[96px] px-3 py-1 text-sm outline-none'
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput('front')}
            spellCheck={false}
          />
        </div>
        {/* Back */}
        <div className='mb-0 rounded-xl border border-zinc-200'>
          <div className='flex items-center justify-between border-b border-zinc-100 px-3 py-0.75'>
            <span className='text-xs font-medium text-zinc-600'>Back (optional)</span>
            <span className='text-[10px] text-zinc-400'>
              {draft.backHtml.replace(/<[^>]*>/g, '').length} chars
            </span>
          </div>
          <div
            ref={backRef}
            className='min-h-[72px] px-3 py-1 text-sm outline-none'
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput('back')}
            spellCheck={false}
          />
        </div>
        {/* Tags */}
        <div className=''>
          <div className='flex items-center justify-between px-3 py-1'>
            <span className='text-xs font-medium text-zinc-600'>Tags</span>
            <div className='flex flex-wrap items-center gap-1'>
              {/* Signature tag editor */}
              <div className='flex items-center gap-1 rounded-full border border-zinc-300 bg-white pl-2 pr-1'>
                <input
                  className='w-15 bg-transparent py-1 text-xs outline-none'
                  value={draft.tags[0] ?? ''}
                  onChange={(e) => setSignatureTag(e.target.value)}
                />
                <span className='rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500'>signature</span>
              </div>
              {/* Other tags */}
              {draft.tags.slice(1).map((t, idx) => (
                <span
                  key={t + idx}
                  className='group inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-1 text-xs'
                >
                  {t}
                  <button
                    className='text-zinc-400 hover:text-zinc-700'
                    onClick={() => {
                      const rest = draft.tags.slice(1).filter((x, i) => i !== idx);
                      setTags([draft.tags[0], ...rest]);
                    }}
                    title='Remove tag'
                  >
                    ×
                  </button>
                </span>
              ))}
              {/* Add tag */}
              {!addingTag ? (
                <button
                  className='rounded-full border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50'
                  onClick={() => setAddingTag(true)}
                >
                  + Add tag
                </button>
              ) : (
                <div className='flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-1'>
                  <input 
                    className='w-20 bg-transparent text-xs outline-none'
                    value={newTag}
                    autoFocus
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = newTag.trim();
                        if (t) {
                          const unique = Array.from(new Set([...(draft.tags ?? []), t]));
                          setTags(unique);
                        }
                        setNewTag('');
                        setAddingTag(false);
                      }
                      if (e.key === 'Escape') {
                        setNewTag('');
                        setAddingTag(false);
                      }
                    }}
                    placeholder='new tag'
                  />
                  <button
                    className='text-xs text-zinc-600 hover:text-zinc-900'
                    onClick={() => {
                      const t = newTag.trim();
                      if (t) {
                        const unique = Array.from(new Set([...(draft.tags ?? []), t]));
                        setTags(unique);
                      }
                      setNewTag('');
                      setAddingTag(false);
                    }}
                    title='Add'
                  >Add</button>
                  <button
                    className='text-xs text-zinc-400 hover:text-zinc-700'
                    onClick={() => { setNewTag(''); setAddingTag(false); }}
                    title='Cancel'
                  >Cancel</button>
                </div>
              )}
            </div>
          </div>
          
        </div>
        {/* Attachments (placeholder) */}
        {draft.media.length > 0 && (
          <div className='rounded-xl border border-zinc-200'>
            <div className='border-b border-zinc-100 px-3 py-1.5'>
              <span className='text-xs font-medium text-zinc-600'>Attachments</span>
            </div>
            <div className='flex flex-wrap gap-2 p-3'>
              {draft.media.map(m => (
                <div
                  key={m.id}
                  className='flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1'
                >
                  <span className='text-xs text-zinc-500'>{m.kind}</span>
                  <span className='text-sm'>{m.name ?? m.id}</span>
                  <button
                    className='text-zinc-400 hover:text-zinc-700'
                    onClick={() => deleteMedia(m.id)}
                    title='Remove'
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}