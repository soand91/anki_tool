import { registerPrefsIpc } from './prefs.ipc';
import { registerHotkeysIpc } from './hotkey.ipc';

export function registerSettingsIpc() {
  registerPrefsIpc();
  registerHotkeysIpc();
}