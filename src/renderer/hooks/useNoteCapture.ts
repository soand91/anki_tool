import { useEffect, useRef } from "react";
import { useNoteDraft } from "./useNoteDraft";

type UndoRecord = { side: 'front' | 'back'; previousHtml: string };

export function useNoteCapture() {
  const { sanitizeHtml, setField, draft } = useNoteDraft();
  const undoStackRef = useRef<UndoRecord[]>([]);

  useEffect(() => {
    const unsubCapture = (window as any).api.note.onNoteCapture((data: {
      side: 'front' | 'back';
      html: string;
      source: { origin: 'clipboard'; capturedAt: number };
    }) => {
      const previous = data.side === 'front' ? (draft.frontHtml || '') : (draft.backHtml || '');
      const fragment = sanitizeHtml(data.html || '');
      if (!fragment.trim()) return;

      const sep = previous.trim().length > 0 ? '<br><br>' : '';
      const next = sanitizeHtml(`${previous}${sep}${fragment}`);
      if (next === previous) return;

      setField(data.side, next);
      undoStackRef.current.push({ side: data.side, previousHtml: previous });
    });

    const unsubUndo = (window as any).api.note.onNoteUndoCapture(() => {
      const last = undoStackRef.current.pop();
      if (!last) return;
      setField(last.side, last.previousHtml);
    });

    return () => {
      if (typeof unsubCapture === 'function') unsubCapture();
      if (typeof unsubUndo === 'function') unsubUndo();
    };
  }, [draft.frontHtml, draft.backHtml, setField, sanitizeHtml]);

  useEffect(() => {
    const hasFront = Boolean(draft.frontHtml && draft.frontHtml.trim().length > 0);
    const hasBack = Boolean(draft.backHtml && draft.backHtml.trim().length > 0);
    if (!hasFront && !hasBack && undoStackRef.current.length > 0) {
      undoStackRef.current = [];
    }
  }, [draft.frontHtml, draft.backHtml]);
}
