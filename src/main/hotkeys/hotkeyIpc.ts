import { ipcMain } from 'electron';
import { hotkeys } from './hotkeyRegistry';

export function registerHotkeysIpc() {
  ipcMain.handle('note:hotkeys:getAll', () => hotkeys.getSnapshot());
  ipcMain.handle('note:hotkeys:set', (_e, { actionId, accelerator }: { actionId: string; accelerator: string | null }) =>
    hotkeys.set(actionId as any, accelerator)
  );
  ipcMain.handle('note:hotkeys:resetAll', () => hotkeys.resetAll());
  ipcMain.handle('note:hotkeys:suspend', (_e, on: boolean) => hotkeys.setSuspended(on));
}
