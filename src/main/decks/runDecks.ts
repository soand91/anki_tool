import { ipcMain } from "electron";
import { ankiCall } from "../anki";
import { ensureHealthyOrThrow } from "../health/runHealth";
import { dlog } from "../health/utils";

export function registerDeckIpc() {
  dlog('ipc:register');
  // deckNamesAndIds only returns a list of names & respective IDs
  ipcMain.handle('anki:getDecks', async () => {
    dlog('ipc:invoke anki:getDecks');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    return ankiCall({ action: 'deckNamesAndIds', version: 6 });
  });
  // creates a new empty deck
  ipcMain.handle('anki:addDeck', async () => {
    dlog('ipc:invoke anki:addDeck');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    return ankiCall({ action: 'createDeck', version: 6, params: '' });
  });
}