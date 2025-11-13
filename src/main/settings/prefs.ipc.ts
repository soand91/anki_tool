import { ipcMain } from 'electron';
import { prefs } from './prefs.store';

export function registerPrefsIpc() {
  ipcMain.handle('prefs:get', (_evt, key: string) => {
    if (key === 'minimizeToTray') return prefs.getMinimizeToTray();
    throw new Error(`Unknown prefs key: ${key}`);
  });
  ipcMain.handle('prefs:set', (evt, key: string, value: any) => {
    if (key === 'minimizeToTray') {
      prefs.setMinimizeToTray(Boolean(value));
      return true;
    }
    throw new Error(`Unknown prefs key: ${key}`);
  });
}