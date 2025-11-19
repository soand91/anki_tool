// src/main/prefs.store.ts
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type ThemeMode = 'system' | 'light' | 'dark';
export type PanelLayoutPreset = 'balanced' | 'wideDecks' | 'wideNotes';

type Prefs = {
  version: 1;
  minimizeToTray: boolean;
  startMinimized: boolean;
  launchOnStartup: boolean;
  themeMode: ThemeMode;
  panelLayoutPreset: PanelLayoutPreset;
  signatureTag: string;
  lastSelectedDeckName: string | null;
  addNoteSoundEnabled: boolean;
};

const STORE_PATH = path.join(app.getPath('userData'), 'prefs.json');

function readStore(): Prefs {
  try {
    const txt = fs.readFileSync(STORE_PATH, 'utf-8');
    const obj = JSON.parse(txt);
    if (obj && obj.version === 1) {
      const rawSig = typeof obj.signatureTag === 'string' ? obj.signatureTag : '';
      const signatureTag = rawSig.trim().length > 0 ? rawSig.trim() : 'anki_tool';
      // ensure defaults for any future keys
      return {
        version: 1,
        minimizeToTray: obj.minimizeToTray ?? true,
        startMinimized: obj.startMinimized ?? false,
        launchOnStartup: obj.launchOnStartup ?? false,
        themeMode: obj.themeMode ?? 'system',
        panelLayoutPreset: obj.panelLayoutPreset ?? 'balanced',
        signatureTag,
        lastSelectedDeckName: typeof obj.lastSelectedDeckName === 'string' && obj.lastSelectedDeckName.trim().length > 0
          ? obj.lastSelectedDeckName.trim()
          : null,
        addNoteSoundEnabled: typeof obj.addNoteSoundEnabled === 'boolean'
          ? obj.addNoteSoundEnabled
          : true,
      }
    }
  } catch {}
  return { 
    version: 1, 
    minimizeToTray: true,
    startMinimized: false,
    launchOnStartup: false,
    themeMode: 'system',
    panelLayoutPreset: 'balanced',
    signatureTag: 'anki_tool',
    lastSelectedDeckName: null,
    addNoteSoundEnabled: true,
  };
}

function writeStore(s: Prefs) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf-8');
}

let cache: Prefs = readStore();

export const prefs = {
  get<K extends keyof Prefs>(k: K): Prefs[K] {
    return cache[k];
  },
  set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    cache = { ...cache, [k]: v };
    writeStore(cache);
  },
  getMinimizeToTray(): boolean {
    return cache.minimizeToTray;
  },
  setMinimizeToTray(v: boolean) {
    cache = { ...cache, minimizeToTray: Boolean(v) };
    writeStore(cache);
  },
  getStartMinimized(): boolean {
    return cache.startMinimized;
  },
  setStartMinimized(v: boolean) {
    cache = { ...cache, startMinimized: Boolean(v) };
    writeStore(cache);
  },
  getLaunchOnStartup(): boolean {
    return cache.launchOnStartup;
  },
  setLaunchOnStartup(v: boolean) {
    cache = { ...cache, launchOnStartup: Boolean(v) };
    writeStore(cache);
  },
  getThemeMode(): ThemeMode {
    return cache.themeMode ?? 'system';
  },
  setThemeMode(value: unknown) {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    cache = { ...cache, themeMode: value};
    writeStore(cache);
  },
  getPanelLayoutPreset(): PanelLayoutPreset {
    return cache.panelLayoutPreset ?? 'balanced';
  },
  setPanelLayoutPreset(p: PanelLayoutPreset) {
    cache = { ...cache, panelLayoutPreset: p };
    writeStore(cache);
  },
  getSignatureTag(): string {
    return cache.signatureTag && cache.signatureTag.trim().length > 0
      ? cache.signatureTag.trim()
      : 'anki_tool';
  },
  setSignatureTag(tag: string) {
    const clean = String(tag ?? '').trim();
    cache = {
      ...cache,
      signatureTag: clean || 'anki_tool',
    };
    writeStore(cache);
  },
  getLastSelectedDeckName(): string | null {
    const raw = cache.lastSelectedDeckName;
    if (typeof raw !== 'string') return null;
    return raw.trim().length > 0 ? raw.trim() : null;
  },
  setLastSelectedDeckName(name: string | null) {
    const clean = typeof name === 'string' ? name.trim() : '';
    cache = {
      ...cache,
      lastSelectedDeckName: clean.length > 0 ? clean : null,
    };
    writeStore(cache);
  },
  getAddNoteSoundEnabled(): boolean {
    return Boolean(cache.addNoteSoundEnabled);
  },
  setAddNoteSoundEnabled(on: boolean) {
    cache = { ...cache, addNoteSoundEnabled: Boolean(on) };
    writeStore(cache);
  },
};
