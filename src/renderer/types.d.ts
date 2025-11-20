// src/renderer/types.d.ts
export {};

import type { HealthCheckId, HealthCheckResult, HealthReport } from '../shared/health/types';
import type { HistoryFilter, HistorySnapshot } from '../shared/history/types';
import type { NoteHudState } from '../shared/noteHud/types';

declare global {
  interface Window {
    api: ApiBridge;
  }
}

interface ApiBridge {
  health: {
    runAll(): Promise<HealthReport>;
    onHealthUpdate<T = unknown>(cb: (evt: T) => void): () => void;
    startHealthPolling(intervalMs?: number): Promise<void>;
    stopHealthPolling(): Promise<void>;
    getHealthReport(): Promise<import('../shared/health/types').HealthReport>;
    onUpdate<T = unknown>(cb: (evt: T) => void): () => void;
    runMini(): Promise<HealthReport>;
  };
  deck: {
    getDecks(): Promise<Record<string, number>>;
    createDeck(name: string): Promise<{ id: number }>;
  };
  note: {
    addNote: (payload: {
      modelName: 'Basic' | 'Cloze';
      fields: Record<string, string>;
      tags: string[];
      deckName?: string;
      allowDuplicate?: boolean;
      duplicateScope?: 'deck' | 'collection';
    }) => Promise<{ noteId: number }>;
    onNoteCapture: (
      handler: (data: {
        side: 'front' | 'back';
        html: string;
        source: { origin: 'clipboard'; capturedAt: number };
      }) => void
    ) => () => void; // returns unsubscribe
    onNoteAddRequest: (
      handler: () => void
    ) => () => void;
    onNoteUndoCapture: (
      handler: () => void
    ) => () => void;
    openInBrowserByNoteId: (noteId: number) => Promise<{ ok: boolean }>;
    openInBrowserByQuery: (query: string) => Promise<{ ok: boolean }>;
  };
  noteHotkeys: {
    getAll: () => Promise<[
      defaults: Record<string, string>,
      overrides: Record<string, string>,
      effective: Record<string, string>,
      inactive: string[],
      issues: Record<string, string | undefined>
    ]>;
    set: (actionId: string, accelerator: string | null) => Promise<{ ok: boolean, reason?: string, snapshot: any }>;
    resetAll: () => Promise<void>;
    suspend: (on: boolean) => Promise<void>;
    onChanged: (handler: (data: any) => void) => () => void;
    onOpenPanel: (handler: () => void) => () => void;
  };
  settings: {
    onOpen: (cb: (payload?: any) => void) => () => void;
    prefs: {
      get: (
        key:
          | 'minimizeToTray'
          | 'startMinimized'
          | 'launchOnStartup'
          | 'themeMode'
          | 'panelLayoutPreset'
          | 'signatureTag'
          | 'lastSelectedDeckName'
          | 'addNoteSoundEnabled'
      ) => Promise<any>;
      set: (
        key:
          | 'minimizeToTray'
          | 'startMinimized'
          | 'launchOnStartup'
          | 'themeMode'
          | 'panelLayoutPreset'
          | 'signatureTag'
          | 'lastSelectedDeckName'
          | 'addNoteSoundEnabled',
        value: any
      ) => Promise<any>;
    };
    hotkeys: {
      list: () => Promise<any>;
      set: (actionId: string, accelerator: string | null) => Promise<any>;
      resetAll: () => Promise<any>;
      suspend: (on: boolean) => Promise<any>;
      onChanged: (handler: (data: any) => void) => () => void;
    };
  };
  history: {
    get(filter?: HistoryFilter): Promise<HistorySnapshot>;
    clear(): Promise<{ ok: boolean }>;
    refresh(maxEntries?: number): Promise<{ ok: boolean }>;
    onUpdate: (
      handler: (payload: { noteId: number, deckName: string; createdAt: number }) => void
    ) => () => void;
  };
  cardFlow: {
    syncDraftState(state: { hasFront: boolean; hasBack: boolean }): void;
    noteFailed(): void;
  };
  noteHud: {
    toggle(): Promise<{ ok: boolean }>;
    show(): Promise<{ ok: boolean }>;
    hide(): Promise<{ ok: boolean }>;
    openSettings(): Promise<{ ok: boolean }>;
    getState(): Promise<NoteHudState>;
    onUpdate(handler: (state: NoteHudState) => void): () => void;
    updateDraftPreview(payload: { deckName?: string; front?: string; back?: string }): Promise<{ ok: boolean }>;
  };
  noteHudToggle(): Promise<{ ok: boolean }>;
}
declare module '*.mp3' {
  const src: string;
  export default src;
}
declare module '*.ogg' {
  const src: string;
  export default src;
}
