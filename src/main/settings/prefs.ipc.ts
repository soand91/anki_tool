import { app, ipcMain } from 'electron';
import { prefs, ThemeMode } from './prefs.store';

export function registerPrefsIpc() {
  ipcMain.handle('prefs:get', (_evt, key: string) => {
    switch (key) {
      case 'minimizeToTray': return prefs.getMinimizeToTray();
      case 'startMinimized': return prefs.getStartMinimized();
      case 'launchOnStartup': return prefs.getLaunchOnStartup();
      case 'themeMode': return prefs.getThemeMode();
      case 'panelLayoutPreset': return prefs.getPanelLayoutPreset();
      case 'signatureTag': return prefs.getSignatureTag();
      case 'lastSelectedDeckName': return prefs.getLastSelectedDeckName();
      default: throw new Error(`Unknown prefs key: ${key}`);
    }
  });
  ipcMain.handle('prefs:set', (evt, key: string, value: any) => {
    switch (key) {
      case 'minimizeToTray': return prefs.setMinimizeToTray(Boolean(value));
      case 'startMinimized': return prefs.setStartMinimized(Boolean(value));
      case 'launchOnStartup':
        prefs.setLaunchOnStartup(Boolean(value));
        app.setLoginItemSettings({ openAtLogin: Boolean(value) });
        return;
      case 'themeMode': {
        const mode = value as ThemeMode;
        return prefs.setThemeMode(mode);
      };
      case 'panelLayoutPreset':
        return prefs.setPanelLayoutPreset(value);
      case 'signatureTag':
        return prefs.setSignatureTag(String(value));
      case 'lastSelectedDeckName':
        return prefs.setLastSelectedDeckName(typeof value === 'string' ? value : null);
      default: throw new Error(`Unknown prefs key: ${key}`);
    }
  });
}
