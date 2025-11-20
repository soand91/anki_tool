import { BrowserWindow, ipcMain } from "electron";
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isDev } from '../env';
import { dlog } from "./utils";

let mainWindow: BrowserWindow | null = null;

function getPreloadPath() {
  // resolve relative to dist/main/hud → dist/preload/preload.js
  const p = path.resolve(__dirname, '../../preload/preload.js');
  if (!existsSync(p)) console.error('[hud] preload not found at:', p);
  return p;
}

function loadHudUrl(win: BrowserWindow) {
  if (isDev) {
    win.loadURL('http://localhost:5173/components/hud/index.html');
    return;
  }
  const hudHtml = path.resolve(__dirname, '../../renderer/components/hud/index.html');
  win.loadFile(hudHtml);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 250,
    height: 200,
    minWidth: 250,
    minHeight: 200,
    frame: false,
    alwaysOnTop: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#111827',
    show: false, // don't steal focus when spawning
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  loadHudUrl(mainWindow);

  const showSafely = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.showInactive();
  };
  mainWindow.webContents.once('did-finish-load', showSafely);
  mainWindow.once('ready-to-show', showSafely);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

export function registerHudIpc() {
  dlog('ipc:register');
  ipcMain.handle('hud:open', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.showInactive();
      return;
    }
    createWindow();
  });
  ipcMain.handle('hud:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });
  ipcMain.handle('hud:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });
}
