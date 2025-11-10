import { useEffect, useRef } from "react";
import { useNoteDraft } from "./useNoteDraft";

export function useNoteCapture() {
  const { sanitizeHtml, setField, draft } = useNoteDraft();
  const undoStackRef = useRef<Array<{ side: 'front'|'back'; sepHtml: string, fragmentHtml: string }>>([]);

  useEffect(() => {
    const unsubCapture = (window as any).api.note.onNoteCapture((data: {
      side: 'front' | 'back';
      html: string;
      source: { origin: 'clipboard'; capturedAt: number };
    }) => {
      const frag = sanitizeHtml(data.html || '');
      if (!frag.trim()) return;

      const current = data.side === 'front' ? (draft.frontHtml || '') : (draft.backHtml || '');
      const needsSep = current.trim().length > 0;
      const sep = needsSep ? '<br><br>' : '';
      const next = `${current}${sep}${frag}`;

      // set field and push undo record
      setField(data.side, next);
      undoStackRef.current.push({ side: data.side, sepHtml: sep, fragmentHtml: frag });
    });

    const unsubUndo = (window as any).api.note.onNoteUndoCapture(() => {
      const last = undoStackRef.current.pop();
      if (!last) return;

      const { side, sepHtml, fragmentHtml } = last;
      const cur = side === 'front' ? (draft.frontHtml || '') : (draft.backHtml || '');

      const suffix = `${sepHtml}${fragmentHtml}`;
      if (cur.endsWith(suffix)) {
        const trimmed = cur.slice(0, cur.length - suffix.length);
        setField(side, trimmed);
        return;
      }
      // fallback: try to remove just the fragment if user edited between operations
      if (cur.endsWith(fragmentHtml)) {
        const trimmed = cur.slice(0, cur.length - fragmentHtml.length);
        setField(side, trimmed);
        return;
      }
      // if neither suffix matches, do nothing to avoid accidental deletion
    })
    return () => {
      if (typeof unsubCapture === 'function') unsubCapture();
      if (typeof unsubUndo === 'function') unsubUndo();
    };
  }, [draft.frontHtml, draft.backHtml, setField, sanitizeHtml]);
}