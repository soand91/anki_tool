import { ipcMain } from 'electron';
import { ankiCall } from './ankiClient';
import { log } from './log';
import { ensureHealthyOrThrow, registerHealthIpc } from './health/runHealth';
import { registerAnkiDeckIpc } from './decks/runDecks';
import { registerHotkeysIpc } from './hotkeys/hotkeyIpc';

export function registerIpc() {
  log.info("[main] registerIpc()");

  registerHealthIpc();
  registerAnkiDeckIpc();  
  registerHotkeysIpc();
}