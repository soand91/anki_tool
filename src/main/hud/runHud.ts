import { app, BrowserWindow, ipcMain, screen } from "electron";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { isDev } from '../env';
import { dlog } from "./utils";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;

function isHudOpen() {
  return !!(mainWindow && !mainWindow.isDestroyed());
}

function getPreloadPath() {
  // resolve relative to dist/main/hud -> dist/preload/preload.js
  const p = path.resolve(__dirname, '../../preload/preload.js');
  if (!existsSync(p)) console.error('[hud] preload not found at:', p);
  return p;
}

function loadHudUrl(win: BrowserWindow) {
  if (isDev) {
    win.loadURL(new URL('components/hud/index.html', DEV_SERVER_URL).toString());
    return;
  }
  const hudHtml = path.resolve(__dirname, '../../renderer/components/hud/index.html');
  win.loadFile(hudHtml);
}

function createWindow() {
  const savedBounds = loadSavedBounds();
  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 250,
    height: savedBounds?.height ?? 200,
    x: savedBounds?.x,
    y: savedBounds?.y,
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
  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();
    saveBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
  };
  mainWindow.on('move', persistBounds);
  mainWindow.on('resize', persistBounds);
  mainWindow.on('close', persistBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function revealExistingHud() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.showInactive();
}

export function openHudWindow() {
  if (isHudOpen()) {
    revealExistingHud();
    return 'existing';
  }
  createWindow();
  return 'created';
}

export function closeHudWindow() {
  if (!isHudOpen()) return false;
  mainWindow!.close();
  return true;
}

export function toggleHudWindow() {
  if (isHudOpen()) {
    mainWindow!.close();
    return 'closed';
  }
  createWindow();
  return 'opened';
}

export function isHudWindowOpen() {
  return isHudOpen();
}

type SavedBounds = { x: number; y: number; width: number; height: number };

const HUD_STATE_PATH = path.join(app.getPath('userData'), 'hud-window.json');

function loadSavedBounds(): SavedBounds | null {
  try {
    const raw = readFileSync(HUD_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x !== 'number' || typeof parsed?.y !== 'number' || typeof parsed?.width !== 'number' || typeof parsed?.height !== 'number') {
      return null;
    }
    const bounds: SavedBounds = {
      x: parsed.x,
      y: parsed.y,
      width: parsed.width,
      height: parsed.height,
    };
    const displays = screen.getAllDisplays();
    const onScreen = displays.some((d) => {
      const r = d.bounds;
      return (
        bounds.x + bounds.width > r.x &&
        bounds.x < r.x + r.width &&
        bounds.y + bounds.height > r.y &&
        bounds.y < r.y + r.height
      );
    });
    return onScreen ? bounds : null;
  } catch {
    return null;
  }
}

function saveBounds(bounds: SavedBounds) {
  try {
    mkdirSync(path.dirname(HUD_STATE_PATH), { recursive: true });
    writeFileSync(HUD_STATE_PATH, JSON.stringify(bounds), 'utf-8');
  } catch {
    // ignore
  }
}

export function registerHudIpc() {
  dlog('ipc:register');
  ipcMain.handle('hud:open', () => {
    openHudWindow();
  });
  ipcMain.handle('hud:isOpen', () => {
    return isHudWindowOpen();
  });
  ipcMain.handle('hud:toggle', () => {
    return toggleHudWindow();
  });
  ipcMain.handle('hud:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });
  ipcMain.handle('hud:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });
  ipcMain.on('hud:focusFrontField', (event) => {
    const senderId = event.sender.id;
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.webContents.id === senderId) continue; // skip HUD itself
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
      win.webContents.send('hud:focusFrontField');
    }
  });
}
