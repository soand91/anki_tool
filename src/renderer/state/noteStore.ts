import { create } from 'zustand';
import { ModelName, DraftSource, DraftNote, DraftMedia, AnkiAddNotePayload } from '../../shared/notes/types';

export const CLOZE_RE = /\{\{c\d+::.+?\}\}/;

const DEFAULT_SIGNATURE = 'anki_tool';

function ensureSignatureFirst(tags: string[], signature = DEFAULT_SIGNATURE) {
  const cleaned = tags.filter(t => t && t.trim().length > 0);
  const existingIdx = cleaned.findIndex(t => t === signature);
  if (existingIdx === -1) {
    return [signature, ...cleaned];
  }
  if (existingIdx === 0) { 
    return cleaned;
  }
  // move signature to front, preserve relative order of others
  const withoutSig = cleaned.filter(t => t !== signature);
  return [signature, ...withoutSig];
}

function effectiveModel(draft: DraftNote): ModelName {
  if (draft.userForcedModel) return draft.userForcedModel;
  return CLOZE_RE.test(draft.frontHtml) ? 'Cloze' : 'Basic';
}

function toFieldsByModel(model: ModelName, frontHtml: string, backHtml: string): Record<string, string> {
  if (model === 'Cloze') {
    return { Text: frontHtml, 'Back Extra': backHtml };
  }
  return { Front: frontHtml, Back: backHtml };
}

function createEmptyDraft(): DraftNote {
  return {
    modelName: 'Basic',
    frontHtml: '',
    backHtml: '',
    tags: [DEFAULT_SIGNATURE],
    media: [],
    source: { origin: 'manual', capturedAt: Date.now() }
  };
}

export interface NoteDraftState {
  // state
  draft: DraftNote;
  signatureTag: string;

  // actions
  seedFromCapture: (init: Partial<Pick<DraftNote, 'frontHtml' | 'backHtml' | 'source' | 'tags'>>) => void;
  setField: (side: 'front' | 'back', html: string) => void;
  setTags: (tags: string[]) => void;
  setSignatureTag: (name: string) => void;
  setModelName: (model: ModelName | null) => void;
  attachMedia: (items: DraftMedia[]) => void;
  removeMedia: (id: string) => void;
  reset: () => void;

  // derived / helpers
  getEffectiveModel: () => ModelName;
  toAnkiPayload: () => AnkiAddNotePayload;
}

export const useNoteDraftStore = create<NoteDraftState>((set, get) => ({
  draft: createEmptyDraft(),
  signatureTag: DEFAULT_SIGNATURE,

  seedFromCapture: (init) => {
    set(state => {
      const next: DraftNote = {
        ...createEmptyDraft(),
        ...state.draft,
        frontHtml: init.frontHtml ?? '',
        backHtml: init.backHtml ?? '',
        source: init.source ?? { origin: 'manual', capturedAt: Date.now() },
        tags: ensureSignatureFirst(
          init.tags ?? state.draft.tags ?? [],
          state.signatureTag
        )
      };
      if (!state.draft.userForcedModel) next.modelName = effectiveModel(next);
      return { draft: next };
    });
  },

  setField: (side, html) => {
    set(state => {
      const draft = { ...state.draft };
      if (side === 'front') draft.frontHtml = html;
      else draft.backHtml = html;

      if (!draft.userForcedModel) draft.modelName = effectiveModel(draft);
      return { draft };
    });
  },

  setTags: (tags) => {
    set(state => ({
      draft: { ...state.draft, tags: ensureSignatureFirst(tags, state.signatureTag) }
    }));
  },

  setSignatureTag: (name) => {
    const sig = name?.trim() || DEFAULT_SIGNATURE;
    set(state => {
      const prevSig = state.signatureTag;
      const withoutPrev = state.draft.tags.filter(t => t !== prevSig);
      return {
        signatureTag: sig,
        draft: { ...state.draft, tags: ensureSignatureFirst(withoutPrev, sig) }
      }
    });
  },

  setModelName: (model) => {
    // null clears the forced model (return to auto)
    set(state => {
      const draft = { ...state.draft };
      if (model === null) {
        delete draft.userForcedModel;
        draft.modelName = effectiveModel(draft);
      } else {
        draft.userForcedModel = model;
        draft.modelName = model;
      }
      return { draft };
    });
  },

  attachMedia: (items) => {
    if (!items?.length) return;
    set(state => ({
      draft: { ...state.draft, media: [...state.draft.media, ...items] }
    }));
  },

  removeMedia: (id) => {
    set(state => ({
      draft: { ...state.draft, media: state.draft.media.filter(m => m.id !== id) }
    }));
  },

  reset: () => {
    set(state => ({
      draft: {
        ...createEmptyDraft(),
        tags: [state.signatureTag]
      }
    }));
  },

  getEffectiveModel: () => {
    const { draft } = get();
    return effectiveModel(draft);
  },

  toAnkiPayload: () => {
    const { draft, signatureTag } = get();
    // decide model respecting userForcedModel + auto-detect
    const model = effectiveModel(draft);
    // guarantee signature tag at index 0
    const tags = ensureSignatureFirst(draft.tags, signatureTag);
    // map fields to Anki's expected names
    const fields = toFieldsByModel(model, draft.frontHtml, draft.backHtml);
    
    const payload: AnkiAddNotePayload = {
      modelName: model,
      fields, 
      tags
    };

    return payload;
  }
}))