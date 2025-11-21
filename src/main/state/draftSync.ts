import { BrowserWindow, ipcMain } from 'electron';

type DraftPayload = {
  frontHtml: string;
  backHtml: string;
};

export function registerDraftSyncIpc() {
  ipcMain.on('draft:publish', (event, payload: DraftPayload) => {
    const senderId = event.sender.id;
    const frontHtml = typeof payload?.frontHtml === 'string' ? payload.frontHtml : '';
    const backHtml = typeof payload?.backHtml === 'string' ? payload.backHtml : '';
    const broadcast: DraftPayload = { frontHtml, backHtml };

    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id === senderId) continue;
      win.webContents.send('draft:update', broadcast);
    }
  });
}
