import path from 'node:path';
import fs from 'node:fs';
import { app, BrowserWindow } from 'electron';
import type { BrowserWindowConstructorOptions, Rectangle } from 'electron';
import { isDev } from './env';
import type { AddNoteEvent, NoteHudState, NoteHudDraftPreview } from '../shared/noteHud/types';
import { onAddNoteEvent } from './state/addNoteEvents';

type NoteHudWindowPrefs = {
  bounds?: Rectangle;
  alwaysOnTop?: boolean;
};

const PREFS_PATH = path.join(app.getPath('userData'), 'note-hud-window.json');
const MAX_HISTORY = 5;

let noteHudWindow: BrowserWindow | null = null;
let noteHudState: NoteHudState = { latestEvent: null, history: [], draftPreview: null };
let windowPrefs: NoteHudWindowPrefs = readPrefs();

export function initializeNoteHud() {
  onAddNoteEvent(handleAddNoteEvent);
}

export function createNoteHudWindowIfNeeded() {
  if (noteHudWindow) {
    return noteHudWindow;
  }
  noteHudWindow = buildNoteHudWindow();
  return noteHudWindow;
}

export function showNoteHud() {
  const win = createNoteHudWindowIfNeeded();
  if (!win) return;
  if (!win.isVisible()) {
    win.show();
  }
  win.setAlwaysOnTop(windowPrefs.alwaysOnTop ?? true);
  win.focus();
  sendNoteHudState(win);
}

export function toggleNoteHud() {
  const win = createNoteHudWindowIfNeeded();
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    showNoteHud();
  }
}

export function getNoteHudState(): NoteHudState {
  return noteHudState;
}

export function updateNoteHudDraftPreview(preview: NoteHudDraftPreview | null) {
  noteHudState = {
    ...noteHudState,
    draftPreview: preview,
  };
  broadcastState();
}

export function hideNoteHud() {
  if (!noteHudWindow) return;
  saveWindowBounds();
  noteHudWindow.hide();
}

export function openNoteHudSettings() {
  const targets = BrowserWindow.getAllWindows().filter((w) => w !== noteHudWindow);
  for (const win of targets) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
    win.webContents.send('open-settings');
  }
}

export function resizeNoteHud(width: number, height: number, edge: string) {
  if (!noteHudWindow) return;
  
  const bounds = noteHudWindow.getBounds();
  const newBounds = { ...bounds };
  
  // For left and top edges, we need to adjust the position as well
  if (edge.includes('left')) {
    const deltaWidth = width - bounds.width;
    newBounds.x = bounds.x - deltaWidth;
    newBounds.width = width;
  } else if (edge.includes('right')) {
    newBounds.width = width;
  }
  
  if (edge.includes('top')) {
    const deltaHeight = height - bounds.height;
    newBounds.y = bounds.y - deltaHeight;
    newBounds.height = height;
  } else if (edge.includes('bottom')) {
    newBounds.height = height;
  }
  
  noteHudWindow.setBounds(newBounds, false);
}

function handleAddNoteEvent(event: AddNoteEvent) {
  noteHudState = {
    latestEvent: event,
    history: [event, ...noteHudState.history].slice(0, MAX_HISTORY),
  };
  broadcastState();
}

function broadcastState() {
  if (!noteHudWindow) return;
  sendNoteHudState(noteHudWindow);
}

function sendNoteHudState(target: BrowserWindow) {
  target.webContents.send('noteHud:update', noteHudState);
}

function buildNoteHudWindow() {
  const options: BrowserWindowConstructorOptions = {
    width: windowPrefs.bounds?.width ?? 220,
    height: windowPrefs.bounds?.height ?? 140,
    show: false,
    alwaysOnTop: windowPrefs.alwaysOnTop ?? true,
    resizable: true,
    movable: true,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: true,
    minWidth: 180,
    minHeight: 120,
    skipTaskbar: false,
    thickFrame: true,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  if (windowPrefs.bounds) {
    options.x = windowPrefs.bounds.x;
    options.y = windowPrefs.bounds.y;
  }

  const win = new BrowserWindow(options);
  win.setMenu(null);
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173/note-hud.html');
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'note-hud.html'));
  }

  win.on('moved', saveWindowBounds);
  win.on('resized', saveWindowBounds);
  win.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    windowPrefs = { ...windowPrefs, alwaysOnTop: isAlwaysOnTop };
    persistPrefs();
  });
  win.on('closed', () => {
    saveWindowBounds();
    noteHudWindow = null;
  });

  win.webContents.once('did-finish-load', () => {
    sendNoteHudState(win);
  });

  return win;
}

function saveWindowBounds() {
  if (!noteHudWindow) return;
  windowPrefs = { ...windowPrefs, bounds: noteHudWindow.getBounds() };
  persistPrefs();
}

function readPrefs(): NoteHudWindowPrefs {
  try {
    const raw = fs.readFileSync(PREFS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      bounds: parsed.bounds,
      alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : true,
    };
  } catch {
    return { alwaysOnTop: true };
  }
}

function persistPrefs() {
  try {
    fs.mkdirSync(path.dirname(PREFS_PATH), { recursive: true });
    fs.writeFileSync(
      PREFS_PATH,
      JSON.stringify(
        {
          bounds: windowPrefs.bounds,
          alwaysOnTop: windowPrefs.alwaysOnTop ?? true,
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.error('[noteHud] failed to persist prefs', err);
  }
}

function getPreloadPath() {
  const preloadPath = path.join(__dirname, '../preload/preload.js');
  if (!fs.existsSync(preloadPath)) {
    console.error('[noteHud] preload script not found at', preloadPath);
  }
  return preloadPath;
}
