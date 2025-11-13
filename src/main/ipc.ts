import { ipcMain } from 'electron';
import { ankiCall } from './ankiClient';
import { log } from './log';
import { registerHealthIpc } from './health/runHealth';
import { registerAnkiDeckIpc } from './decks/runDecks';
import { registerSettingsIpc } from './settings/hub';

export function registerIpc() {
  log.info("[main] registerIpc()");

  registerHealthIpc();
  registerAnkiDeckIpc();  
  registerSettingsIpc();
}