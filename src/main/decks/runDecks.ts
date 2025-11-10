import { ipcMain } from "electron";
import { createDeck, getDeckNamesAndIds, addNote } from "../ankiClient";
import { ensureHealthyOrThrow } from "../health/runHealth";
import { dlog } from "./utils";

export function registerAnkiDeckIpc() {
  dlog('ipc:register');
  // deckNamesAndIds only returns a list of names & respective IDs
  ipcMain.handle('anki:deck:list', async () => {
    dlog('ipc:invoke anki:deck:list');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    return await getDeckNamesAndIds();
  });
  // creates a new empty deck
  ipcMain.handle('anki:deck:create', async (_event, name: string) => {
    if (!name || typeof name !== 'string') {
      throw new Error('Deck name must be a non-empty string');
    }
    dlog('ipc:invoke anki:deck:create');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    const id = await createDeck(name.trim());
    return { id };
  });
  // add new note
  ipcMain.handle('anki:addNote', async (_evt, payload: {
    modelName: 'Basic' | 'Cloze';
    fields: Record<string, string>;
    tags: string[];
    deckName?: string;
    allowDuplicate?: boolean;
    duplicateScope?: 'deck' | 'collection';
  }) => {
    if (!payload?.modelName || !payload?.fields) {
      throw new Error('Invalid addNote payload');
    }
    try {
      const noteId = await addNote({
        modelName: payload.modelName,
        fields: payload.fields,
        tags: payload.tags ?? [],
        deckName: payload.deckName,
        allowDuplicate: payload.allowDuplicate,
        duplicateScope: payload.duplicateScope,
      });
      return { noteId };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      throw new Error(`addNote failed: ${msg}`)
    }
  });
}