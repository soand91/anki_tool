import { useEffect } from "react";
import { useNoteDraft } from "./useNoteDraft";

type UndoRecord = {
  kind: 'capture' | 'manual';
  side: 'front' | 'back';
  previousHtml: string;
  at: number;
};

const undoStackRef: { current: UndoRecord[] } = { current: [] };

const MANUAL_COALESCE_MS = 800;

export function recordManualUndoSnapshot(side: 'front' | 'back', previousHtml: string) {
  const now = Date.now();
  const last = undoStackRef.current[undoStackRef.current.length - 1];
  const withinWindow = last && last.kind === 'manual' && last.side === side && now - last.at < MANUAL_COALESCE_MS;
  if (withinWindow) return;
  undoStackRef.current.push({ kind: 'manual', side, previousHtml, at: now });
}

export function useNoteCapture() {
  const { sanitizeHtml, setField, appendToField, draft } = useNoteDraft();

  useEffect(() => {
    const unsubCapture = (window as any).api.note.onNoteCapture((data: {
      side: 'front' | 'back';
      html: string;
      source: { origin: 'clipboard'; capturedAt: number };
    }) => {
      const previous = data.side === 'front' ? (draft.frontHtml || '') : (draft.backHtml || '');
      const fragment = sanitizeHtml(data.html || '');
      if (!fragment.trim()) return;

      // append with single break and trim trailing breaks
      appendToField(data.side, fragment);
      undoStackRef.current.push({ kind: 'capture', side: data.side, previousHtml: previous, at: Date.now() });
    });

    const unsubUndo = (window as any).api.note.onNoteUndoCapture(() => {
      const prevActive = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
      const last = undoStackRef.current.pop();
      if (!last) return;
      setField(last.side, last.previousHtml);
      if (prevActive && typeof prevActive.focus === 'function' && prevActive.isConnected) {
        prevActive.focus({ preventScroll: true });
      }
    });

    return () => {
      if (typeof unsubCapture === 'function') unsubCapture();
      if (typeof unsubUndo === 'function') unsubUndo();
    };
  }, [draft.frontHtml, draft.backHtml, appendToField, setField, sanitizeHtml]);

  useEffect(() => {
    const hasFront = Boolean(draft.frontHtml && draft.frontHtml.trim().length > 0);
    const hasBack = Boolean(draft.backHtml && draft.backHtml.trim().length > 0);
    if (!hasFront && !hasBack && undoStackRef.current.length > 0) {
      undoStackRef.current = [];
    }
  }, [draft.frontHtml, draft.backHtml]);
}
