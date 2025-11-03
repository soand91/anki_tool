import { ipcMain } from 'electron';
import { ankiCall } from './anki';
import { log } from './log';
import { ensureHealthyOrThrow, registerHealthIpc } from './health/runHealth';

export function registerIpc() {
  log.info("[main] registerIpc()");

  registerHealthIpc();

  ipcMain.handle('anki:deckNames', async () => {
    log.info("[main] anki:deckNames invoked");
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    return ankiCall({ action: 'deckNames', version: 6 });
  });
  
}