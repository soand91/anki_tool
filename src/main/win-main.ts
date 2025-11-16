import path from 'path';
import { BrowserWindow, app } from 'electron';
import { isDev } from './env';
import { join } from 'node:path';
import { existsSync } from 'fs';

function getPreloadPath() {
  // Dev: we build preload to dist/preload/preload.js
  // Prod: main code runs from dist/main, so go up one and into ../preload/preload.js
  const p = join(__dirname, '../preload/preload.js');
  if (!existsSync(p)) console.error('[main] Preload not found at:', p);
  return p;
}

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 950,
    height: 700,
    show: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  return win;
}