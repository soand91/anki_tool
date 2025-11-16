export interface HistoryEntry {
  noteId: number;
  cardIds: number[];
  deckNameAtCreate: string;
  currentDeckName?: string;
  createdAt: number;
  modelName?: string;
  frontPreview: string;
  backPreview?: string;
  deleted?: boolean;
}

export interface HistoryFilter {
  deck?: string | null;
  limit?: number;
}

export interface HistorySnapshot {
  entries: HistoryEntry[];
  total: number;
}