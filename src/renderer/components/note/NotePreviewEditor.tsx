import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useNoteDraft } from '../../hooks/useNoteDraft';
import { useDeckStore } from '../../state/deckStore';
import Button from '../ui/Button';
import { toast } from '../../state/toastStore';
import { playAddNoteSound } from '../../sound/addNoteSounds';

function hasMeaningfulContent(html?: string | null): boolean {
  if (!html) return false;
  const stripped = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length > 0) return true;
  return /<(img|video|audio|svg|object|iframe)\b/i.test(html);
}

function toPreviewText(html: string | null | undefined, limit = 160): string {
  if (!html) return '';
  let text = '';
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    text = temp.textContent || temp.innerText || '';
  } else {
    text = html.replace(/<[^>]*>/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
}

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
  const hasDecks = useDeckStore(s => s.sortedDecks.length > 0);
  const deckLabel = deckName ?? (hasDecks ? 'Default' : 'No decks found');
  const lastDraftSyncRef = useRef<{ front: boolean | null; back: boolean | null }>({ front: null, back: null });
  const draftContentRef = useRef<{ frontHtml: string; backHtml: string }>({ frontHtml: draft.frontHtml, backHtml: draft.backHtml });
  const lastDraftPreviewRef = useRef<{ deck: string; front: string; back: string } | null>(null);

  useEffect(() => {
    draftContentRef.current = { frontHtml: draft.frontHtml, backHtml: draft.backHtml };
  }, [draft.frontHtml, draft.backHtml]);

  useEffect(() => {
    const updatePreview = window?.api?.noteHud?.updateDraftPreview;
    if (!updatePreview) return;
    const deck = deckName ?? 'Default';
    const front = toPreviewText(draft.frontHtml);
    const back = toPreviewText(draft.backHtml);
    const next = { deck, front, back };
    const prev = lastDraftPreviewRef.current;
    if (prev && prev.deck === deck && prev.front === front && prev.back === back) {
      return;
    }
    lastDraftPreviewRef.current = next;
    updatePreview({
      deckName: deck,
      front,
      back: back || undefined,
    }).catch(() => {});
  }, [deckName, draft.frontHtml, draft.backHtml]);

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

  useEffect(() => {
    const api = (window as any).api;
    if (!api?.cardFlow?.syncDraftState) return;
    const hasFront = hasMeaningfulContent(draft.frontHtml);
    const hasBack = hasMeaningfulContent(draft.backHtml);
    const prev = lastDraftSyncRef.current;
    if (prev.front === hasFront && prev.back === hasBack) return;
    lastDraftSyncRef.current = { front: hasFront, back: hasBack };
    api.cardFlow.syncDraftState({ hasFront, hasBack });
  }, [draft.frontHtml, draft.backHtml]);

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

  const handleToggleNoteHud = useCallback(() => {
    try {
      const toggle = window?.api?.noteHudToggle;
      if (!toggle) return;
      void toggle().catch(() => {});
    } catch {
      // ignore toggle errors
    }
  }, []);

  const signalEmptyDraftFailure = useCallback(() => {
    toast.error({
      title: 'Card is empty',
      message: 'Capture or type on Front or Back before saving.',
      autoCloseMs: 4000,
    });
    void playAddNoteSound('failure');
    try {
      if (typeof window !== 'undefined') {
        window.api?.cardFlow?.noteFailed?.();
      }
    } catch {
      // ignore
    }
  }, []);

  const onAddNote = useCallback(async () => {
    try {
      const payload = toSanitizedAnkiPayload();
      const res = await (window as any).api.note.addNote({
        ...payload,
        deckName: deckName ?? undefined
      });
      void playAddNoteSound('success');
      toast.success({
        title: 'Note added',
        message: deckName ? `Saved to ${deckName}` : 'Saved to default deck',
      });
      reset();
    } catch (err: any) {
      void playAddNoteSound('failure');
      const message = err?.message ?? String(err);
      toast.error({
        title: 'Add note failed',
        message,
        autoCloseMs: undefined,
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.focus();
          }
        },
      });
    }
  }, [deckName, reset, toSanitizedAnkiPayload]);

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
        return;
      }
      const { frontHtml, backHtml } = draftContentRef.current;
      const hasFront = hasMeaningfulContent(frontHtml);
      const hasBack = hasMeaningfulContent(backHtml);
      if (!hasFront && !hasBack) {
        signalEmptyDraftFailure();
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [canSubmit, ankiconnectHealthy, onAddNote, signalEmptyDraftFailure]);

  return (
    <div className='flex h-full flex-col pb-1.5'>
      {/* Header */}
      <div className='cursor-default mb-1.25 flex items-center justify-between border-b border-zinc-200 px-3 py-1 dark:border-zinc-950'>
        <div className="flex flex-1 flex-col min-w-0 flex-shrink overflow-hidden">
          <div className='flex items-center gap-2'>
            <h2 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-300">Note Preview</h2>
            <button
              type='button'
              onClick={handleToggleNoteHud}
              className='shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100'
              title='Show or hide the floating Note HUD'
            >
              Note HUD
            </button>
          </div>
          <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={deckLabel}>
            Selected Deck: {deckLabel}
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          {/* Model selector */}
          <div className='flex items-center gap-1 flex-shrink-0'>
            <label className='text-xs text-zinc-500 dark:text-zinc-400'>Model</label>
            <select
              className='flex-shrink-0 cursor-pointer rounded-md border border-zinc-300 bg-white px-1 py-1 text-sm h-[30px] dark:border-zinc-950 dark:bg-[#323232] dark:text-zinc-400'
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
          <Button
            variant='solid'
            onClick={onAddNote}
            disabled={disabled}
            title={disabled ? 'Front required and AnkiConnect must be available' : 'Add note'}
          >
            Add Note
          </Button>
          {!confirmingClear ? (
            <Button
              variant='outline'
              onClick={handleClear}
              title={isDraftDirty ? 'Click again to confirm' : 'Clear'}
            >
              Clear
            </Button>
          ) : (
            <div className='flex items-center gap-2'>
              <button 
                className='flex-shrink-0 cursor-pointer rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100 transition-all duration-200 h-[30px]'
                onClick={handleClear}
                title='This will discard current draft'
              >
                Confirm
              </button>
              <Button
                variant='outline'
                onClick={() => { cancelClearCountdown(); setConfirmingClear(false); }}
                title='Cancel'
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Editors */}
      <div className='flex flex-col border-b border-zinc-200 flex-1 space-y-1 overflow-auto pr-1 pl-1.5 scrollbar dark:border-zinc-950'>
        {/* Front */}
        <div className='flex-1 rounded-xl border border-zinc-200 dark:border-zinc-950 dark:bg-[#323232]'>
          <div className='flex items-center justify-between border-b border-zinc-100 px-3 py-0.75 dark:border-zinc-950'>
            <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>Front</span>
            <div className='flex items-center gap-2'>
              {/* Helper text */}
              {clozeDetected && (
                <span className='rounded-md bg-amber-50 p-0 text-[10px] text-amber-700'>
                  Cloze detected
                </span>
              )}
              <div className='px-1 text-[10px] text-zinc-500 dark:text-zinc-400'>
                Front is required. {modelNameEffective === 'Cloze' && !clozeDetected ? 'Cloze selected but no {{cX::...}} found.' : ''}
              </div>
              <span className='text-[10px] text-zinc-400 dark:text-zinc-500'>
                {draft.frontHtml.replace(/<[^>]*>/g, '').length} chars
              </span>
            </div>
          </div>
          <div
            ref={frontRef}
            className='min-h-[96px] px-3 py-1 text-sm outline-none dark:text-zinc-300 dark:caret-zinc-100'
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput('front')}
            spellCheck={false}
          />
        </div>
        {/* Back */}
        <div className='flex-1 mb-0 rounded-xl border border-zinc-200 dark:border-zinc-950 dark:bg-[#323232]'>
          <div className='flex items-center justify-between border-b border-zinc-100 px-3 py-0.75 dark:border-zinc-950'>
            <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>Back (optional)</span>
            <span className='text-[10px] text-zinc-400 dark:text-zinc-500'>
              {draft.backHtml.replace(/<[^>]*>/g, '').length} chars
            </span>
          </div>
          <div
            ref={backRef}
            className='min-h-[72px] px-3 py-1 text-sm outline-none dark:text-zinc-300 dark:caret-zinc-100'
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput('back')}
            spellCheck={false}
          />
        </div>
        {/* Tags */}
        <div className='flex-shrink-0 min-h-[34px]'>
          <div className='flex items-center justify-between pl-3 py-1'>
            <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>Tags</span>
            <div className='flex flex-wrap items-center gap-1'>
              {/* Signature tag editor */}
              <div className='flex items-center gap-1 rounded-full border border-zinc-300 bg-white pl-2 pr-1 dark:bg-[#323232] dark:border-zinc-950 dark:text-zinc-300'>
                <span className='w-15 bg-transparent py-1 text-xs outline-none'>
                  {draft.tags[0] ?? ''}
                </span>
                <span className='rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'>signature</span>
              </div>
              {/* Other tags */}
              {draft.tags.slice(1).map((t, idx) => (
                <span
                  key={t + idx}
                  className='group inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-950 dark:text-zinc-300 dark:bg-[#323232]'
                >
                  {t}
                  <button
                    className='text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-500'
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
                  className='cursor-pointer rounded-full border border-dashed border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-400 dark:bg-[#323232]'
                  onClick={() => setAddingTag(true)}
                >
                  + Add tag
                </button>
              ) : (
                <div className='hover:border-zinc-500 hover:bg-zinc-100 transitional-all duration-200 dark:hover:bg-[#323232] dark:hover:border-zinc-600 flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-2 py-1 dark:bg-zinc-800 dark:border-zinc-950'>
                  <input 
                    className='w-20 bg-transparent text-xs outline-none dark:text-zinc-300 dark:placeholder:text-zinc-500 dark:caret-zinc-100'
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
                    className='cursor-pointer text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-400'
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
                    className='cursor-pointer text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-500'
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
