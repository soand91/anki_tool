import { app, BrowserWindow, ipcMain } from 'electron';
import { prefs, ThemeMode } from './prefs.store';

function broadcastThemeMode(mode: ThemeMode) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send('settings:themeModeChanged', mode);
  }
}

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
      case 'addNoteSoundEnabled': return prefs.getAddNoteSoundEnabled();
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
        const before = prefs.getThemeMode();
        prefs.setThemeMode(mode);
        const after = prefs.getThemeMode();
        if (after !== before) {
          broadcastThemeMode(after);
        }
        return;
      };
      case 'panelLayoutPreset':
        return prefs.setPanelLayoutPreset(value);
      case 'signatureTag':
        return prefs.setSignatureTag(String(value));
      case 'lastSelectedDeckName':
        return prefs.setLastSelectedDeckName(typeof value === 'string' ? value : null);
      case 'addNoteSoundEnabled':
        return prefs.setAddNoteSoundEnabled(Boolean(value));
      default: throw new Error(`Unknown prefs key: ${key}`);
    }
  });
}
