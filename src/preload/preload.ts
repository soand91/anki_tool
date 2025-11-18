import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { HealthCheckId, HealthCheckResult, HealthReport } from '../shared/health/types';
import type { HistoryFilter, HistorySnapshot } from "../shared/history/types";

const health = {
  healthCheck: (id: HealthCheckId): Promise<HealthCheckResult> => {
    return ipcRenderer.invoke('health:check', id);
  },
  getHealthReport: (): Promise<HealthReport> => {
    return ipcRenderer.invoke('health:getReport');
  }, 
  runAll: (): Promise<HealthReport> => {
    return ipcRenderer.invoke('health:runAll');
  },
  onUpdate: <T = unknown>(cb: (msg: T) => void) => {
    const channel = 'health:update';
    const handler = (_: Electron.IpcRendererEvent, msg: T) => cb(msg);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  startHealthPolling: (intervalMs?: number) => {
    ipcRenderer.invoke('health:polling:start', intervalMs);
  },
  stopHealthPolling: () => {
    return ipcRenderer.invoke('health:polling:stop');
  },
  runMini: () => {
    return ipcRenderer.invoke('health:mini');
  },
};

const deck = {
  async getDecks(): Promise<Record<string, number>> {
    return ipcRenderer.invoke('anki:deck:list');
  },
  async createDeck(name: string): Promise<{ id: number }> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('Deck name must be a non-empty string');
    return ipcRenderer.invoke('anki:deck:create', trimmed);
  },
};

const note = {
  addNote: (payload: {
    modelname: 'Basic' | 'Cloze';
    fields: Record<string, string>;
    tags: string[];
    deckName?: string;
    allowDuplicate?: boolean;
    duplicateScope?: 'deck' | 'collection';
  }) => ipcRenderer.invoke('anki:addNote', payload),
  onNoteCapture: (handler: (data: {
    side: 'front' | 'back';
    html: string;
    source: { origin: 'clipboard'; capturedAt: number };
  }) => void) => {
    const wrapped = (_e: IpcRendererEvent, data: any) => handler(data);
    ipcRenderer.on('note:capture', wrapped);
    // return unsubscribe
    return () => {
      ipcRenderer.off('note:capture', wrapped);
    };
  },
  onNoteAddRequest: (handler: () => void) => {
    const wrapped = () => handler();
    ipcRenderer.on('note:addRequest', wrapped);
    return () => ipcRenderer.off('note:addRequest', wrapped);
  },
  onNoteUndoCapture: (handler: () => void) => {
    const wrapped = () => handler();
    ipcRenderer.on('note:undoCapture', wrapped);
    return () => ipcRenderer.off('note:undoCapture', wrapped);
  },
  openInBrowserByNoteId: (noteId: number): Promise<{ ok: boolean }> => 
    ipcRenderer.invoke('anki:guiBrowseNote', noteId),
  openInBrowserByQuery: (query: string): Promise<{ ok: boolean }> => 
    ipcRenderer.invoke('anki:guiBrowseQuery', query),
}

const noteHotkeys = {
  getAll: () => ipcRenderer.invoke('note:hotkeys:getAll'),
  set: (actionId: string, accelerator: string | null) => ipcRenderer.invoke('note:hotkeys:set', { actionId, accelerator }),
  resetAll: () => ipcRenderer.invoke('note:hotkeys:resetAll'),
  suspend: (on: boolean) => ipcRenderer.invoke('note:hotkeys:suspend', on),
  onChanged: (handler: (data: any) => void) => {
    const wrapped = (_e: IpcRendererEvent, data: any) => handler(data);
    ipcRenderer.on('note:hotkeysChanged', wrapped);
    return () => ipcRenderer.off('note:hotkeysChanged', wrapped);
  },
  onOpenPanel: (handler: () => void) => {
    const wrapped = () => handler();
    ipcRenderer.on('ui:openHotkeys', wrapped);
    return () => ipcRenderer.off('ui:openHotkeys', wrapped);
  }
}

const settings = {
  // open Settings modal from main (menu/tray). Payload may include { section: 'hotkeys' | 'general }
  onOpen: (cb: (payload?: any) => void) => {
    const channel = 'open-settings';
    const handler = (_: Electron.IpcRendererEvent, payload?: any) => cb(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
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
    ) => ipcRenderer.invoke('prefs:get', key),
    set: (
      key: 
        | 'minimizeToTray' 
        | 'startMinimized' 
        | 'launchOnStartup' 
        | 'themeMode' 
        | 'panelLayoutPreset'
        | 'signatureTag'
        | 'lastSelectedDeckName',
      value: any
    ) => ipcRenderer.invoke('prefs:set', key, value),
  },
  hotkeys: {
    // proxy to existing hotkey endpoints so renderer can use one place
    list: () => ipcRenderer.invoke('note:hotkeys:getAll'),
    set: (actionId: string, accelerator: string | null) => 
      ipcRenderer.invoke('note:hotkeys:set', { actionId, accelerator }),
    resetAll: () => ipcRenderer.invoke('note:hotkeys:resetAll'),
    suspend: (on: boolean) => ipcRenderer.invoke('note:hotkeys:suspend', on),
    onChanged: (handler: (data: any) => void) => {
      const wrapped = (_e: IpcRendererEvent, data: any) => handler(data);
      ipcRenderer.on('note:hotkeysChanged', wrapped);
      return () => ipcRenderer.off('note:hotkeysChanged', wrapped);
    },
  },
};

const history = {
  get(filter?: HistoryFilter): Promise<HistorySnapshot> {
    return ipcRenderer.invoke('history:get', filter);
  },
  clear(): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke('history:clear');
  },
  refresh(maxEntries?: number): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke('history:refresh', maxEntries);
  },
  onUpdate(handler: (payload: { noteId: number; deckName: string; createdAt: number }) => void) {
    const channel = 'history:updated';
    const wrapped = (_e: IpcRendererEvent, payload: any) => handler(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.off(channel, wrapped);
  },
};

const cardFlow = {
  syncDraftState(state: { hasFront: boolean; hasBack: boolean }) {
    ipcRenderer.send('cardFlow:syncDraftState', state);
  },
};

console.log('[preload] loaded');

contextBridge.exposeInMainWorld('api', {
  health,
  deck,
  note,
  noteHotkeys,
  settings,
  history,
  cardFlow,
});

contextBridge.exposeInMainWorld('env', {
  isMac: process.platform === 'darwin',
  platform: process.platform,
});
