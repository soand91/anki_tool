export type ModelName = 'Basic' | 'Cloze';

export interface DraftMedia {
  id: string;
  kind: 'image'|'audio'|'video'|'other';
  name?: string;
  size?: string;
  path?: string;
  dataUrl?: string;
}

export interface DraftSource {
  origin: 'clipboard'|'selection'|'manual'|'other';
  url?: string;
  capturedAt?: number;
}

export interface DraftNote {
  modelName: ModelName;
  frontHtml: string;
  backHtml: string;
  tags: string[];
  media: DraftMedia[];
  source: DraftSource;
  userForcedModel?: ModelName;
}

export interface AnkiAddNotePayload {
  modelName: ModelName;
  fields: Record<string, string>;
  tags: string[];
}