import { useMemo, useCallback } from 'react';
import { useNoteDraftStore, CLOZE_RE } from '../state/noteStore';
import type { ModelName, DraftMedia, AnkiAddNotePayload } from '../../shared/notes/types';

// minimal, predictable sanitizer (allow-list)
const ALLOWED_TAGS = new Set([
  'a', 'b', 'i', 'u', 'em', 'strong', 'br', 'p', 'div', 'span', 'img'
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'width', 'height', 'alt']),
};

function sanitizeHtml(input: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return '';

    const walk = (node: Element) => {
      // 1) remove disallowed tags by unwrapping children
      if (!ALLOWED_TAGS.has(node.tagName.toLowerCase())) {
        const parent = node.parentElement;
        if (parent) {
          // move children up
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
        }
        return;
      }
      // 2) prune attributes
      const tag = node.tagName.toLowerCase();
      const allowForTag = ALLOWED_ATTRS[tag] ?? new Set<string>();
      // copy to array before mutation
      for (const attr of Array.from(node.attributes)) {
        if (!allowForTag.has(attr.name.toLowerCase())) {
          node.removeAttribute(attr.name);
          continue;
        }
        // extra safety rules
        if (tag === 'a' && attr.name.toLowerCase() === 'href') {
          // basic javascript: URL guard
          const val = attr.value.trim();
          if (/^javascript:/i.test(val)) {
            node.removeAttribute('href');
          } else {
            // harden target/rel
            (node as HTMLAnchorElement).target = '_blank';
            (node as HTMLAnchorElement).rel = 'noopener';
          }
        }
        if (tag === 'img' && attr.name.toLowerCase() === 'src') {
          const val = attr.value.trim();
          // allow typical schemes: data:, blob:, http(s):, file-like names
          if (!/^data:|^blob:|^https?:|^[\w\-.\/]+$/.test(val)) {
            node.removeAttribute('src');
          }
        }
      }
      // 3) recurse children safely (snapshot first)
      const children = Array.from(node.children);
      for (const child of children) walk(child);
    };
    // remove any <script> injected into parse wrapper
    for (const s of Array.from(doc.getElementsByTagName('script'))) {
      s.remove();
    }
    // walk down from wrapper <div>
    const children = Array.from(root.children);
    for (const c of children) walk(c);
    return root.innerHTML;
  } catch {
    return '';
  }
}

// hook
export function useNoteDraft() {
  // raw state/selectors
  const draft = useNoteDraftStore(s => s.draft);
  const signatureTag = useNoteDraftStore(s => s.signatureTag);

  // actions
  const setFieldRaw = useNoteDraftStore(s => s.setField);
  const setTags = useNoteDraftStore(s => s.setTags);
  const setSignatureTag = useNoteDraftStore(s => s.setSignatureTag);
  const setModelName = useNoteDraftStore(s => s.setModelName);
  const attachMedia = useNoteDraftStore(s => s.attachMedia);
  const removeMedia = useNoteDraftStore(s => s.removeMedia);
  const reset = useNoteDraftStore(s => s.reset);
  const toAnkiPayload = useNoteDraftStore(s => s.toAnkiPayload);
  const getEffectiveModel = useNoteDraftStore(s => s.getEffectiveModel);

  // derived
  const clozeDetected = useMemo(() => CLOZE_RE.test(draft.frontHtml), [draft.frontHtml]);
  const modelNameEffective: ModelName = useMemo(() => getEffectiveModel(), [draft.frontHtml, draft.backHtml, draft.userForcedModel]);

  // sanitized setters
  const setField = useCallback(
    (side: 'front' | 'back', html: string) => {
      const clean = sanitizeHtml(html);
      setFieldRaw(side, clean);
    },
    [setFieldRaw]
  );

  // append with a blank line between blocks (as HTML)
  const appendToField = useCallback(
    (side: 'front' | 'back', htmlFragment:string) => {
      const current = side === 'front' ? draft.frontHtml : draft.backHtml;
      const fragment = sanitizeHtml(htmlFragment);
      const next = 
        current && current.trim().length > 0
          ? `${current}<br><br>${fragment}`
          : fragment;
        setField(side, next);
    },
    [draft.frontHtml, draft.backHtml, setField]
  );

  // compute if user can submit
  const canSubmit = useCallback(
    (ankiconnectHealthy: boolean) => {
      if (!ankiconnectHealthy) return false;
      // need at least one meaningful side
      const frontLength = sanitizeHtml(draft.frontHtml).trim().length;
      const backLength = sanitizeHtml(draft.backHtml).trim().length;
      if (frontLength === 0 && backLength === 0) return false;
      // if effective model is Cloze but no cloze present AND user forced CLOZE, block
      if (modelNameEffective === 'Cloze' && !clozeDetected && draft.userForcedModel === 'Cloze') {
        return false;
      }
      // if user did NOT force Cloze, auto mode
      return true;
    },
    [draft.frontHtml, draft.backHtml, draft.userForcedModel, modelNameEffective, clozeDetected]
  );

  // payload with fields sanitized
  const toSanitizedAnkiPayload = useCallback((): AnkiAddNotePayload => {
    // build from store mapping first
    const payload = toAnkiPayload();
    // sanitize fields defensively
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload.fields)) {
      fields[k] = sanitizeHtml(v ?? '');
    }
    if (payload.modelName === 'Basic') {
      const front = fields.Front ?? '';
      const back = fields.Back ?? '';
      const frontLength = front.trim().length;
      const backLength = back.trim().length;
      if (frontLength === 0 && backLength > 0) {
        fields.Front = '&nbsp;';
      }
    }
    return {
      ...payload,
      fields
    };
  }, [toAnkiPayload]);

  // media helpers 
  const addMedia = useCallback((items: DraftMedia[]) => attachMedia(items), [attachMedia]);
  const deleteMedia = useCallback((id: string) => removeMedia(id), [removeMedia]);

  return {
    // state
    draft,
    signatureTag,
    // derived
    clozeDetected,
    modelNameEffective,
    // actions
    setField, 
    appendToField,
    setTags,
    setSignatureTag,
    setModelName,
    addMedia,
    deleteMedia,
    reset,
    // validation + payload
    canSubmit,
    toSanitizedAnkiPayload,
    // expose sanitizer for contentEditable paste handlers
    sanitizeHtml
  };
}
