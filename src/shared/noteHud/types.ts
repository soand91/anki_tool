export type AddNoteEvent =
  | AddNoteStartEvent
  | AddNoteSuccessEvent
  | AddNoteFailureEvent;

export interface NoteHudDraftPreview {
  deckName: string;
  fields: {
    front: string;
    back?: string;
  };
  updatedAt: number;
}

export interface NoteHudState {
  latestEvent: AddNoteEvent | null;
  history: AddNoteEvent[];
  draftPreview: NoteHudDraftPreview | null;
}

type BaseAddNoteEvent = {
  timestamp: number;
  deckName: string;
  fields: {
    front: string;
    back?: string;
  };
  source?: 'hotkey' | 'in-app' | 'other';
};

export interface AddNoteStartEvent extends BaseAddNoteEvent {
  kind: 'start';
}

export interface AddNoteSuccessEvent extends BaseAddNoteEvent {
  kind: 'success';
  noteId?: number;
}

export interface AddNoteFailureEvent extends BaseAddNoteEvent {
  kind: 'failure';
  errorCode: string;
  errorMessage: string;
}
