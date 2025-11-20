import { ipcMain } from 'electron';
import { getNoteHudState, toggleNoteHud, showNoteHud, updateNoteHudDraftPreview, hideNoteHud, openNoteHudSettings, resizeNoteHud } from './noteHudWindow';

export function registerNoteHudIpc() {
  ipcMain.handle('noteHud:getState', () => getNoteHudState());
  ipcMain.handle('noteHud:toggle', () => {
    toggleNoteHud();
    return { ok: true };
  });
  ipcMain.handle('noteHud:show', () => {
    showNoteHud();
    return { ok: true };
  });
  ipcMain.handle('noteHud:hide', () => {
    hideNoteHud();
    return { ok: true };
  });
  ipcMain.handle('noteHud:openSettings', () => {
    openNoteHudSettings();
    return { ok: true };
  });
  ipcMain.handle('noteHud:updateDraftPreview', (_evt, payload: {
    deckName?: string;
    front?: string;
    back?: string;
  }) => {
    const deckName = sanitizeDeckName(payload?.deckName);
    const front = sanitizeField(payload?.front);
    const back = sanitizeField(payload?.back);
    updateNoteHudDraftPreview({
      deckName,
      fields: back ? { front, back } : { front },
      updatedAt: Date.now(),
    });
    return { ok: true };
  });
  ipcMain.handle('noteHud:resize', (_evt, payload: {
    width: number;
    height: number;
    edge: string;
  }) => {
    resizeNoteHud(payload.width, payload.height, payload.edge);
    return { ok: true };
  });
}

function sanitizeDeckName(value: unknown): string {
  if (typeof value !== 'string') return 'Default';
  const trimmed = value.trim();
  if (!trimmed) return 'Default';
  return trimmed.slice(0, 80);
}

function sanitizeField(value: unknown, max = 160): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 3) + '...';
}
