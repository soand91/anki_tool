import { ipcMain } from 'electron';
import { ankiCall } from './anki';
import { log } from './log';
import { registerHealthIpc } from './health/runHealth';

export function registerIpc() {
  log.info("[main] registerIpc()");

  registerHealthIpc();

  ipcMain.handle('anki:deckNames', async () => {
    log.info("[main] anki:deckNames invoked");
    return ankiCall({ action: 'deckNames', version: 6 });
  });
  
}