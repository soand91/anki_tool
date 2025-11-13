// src/main/prefs.store.ts
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type ThemeMode = 'system' | 'light' | 'dark';

type Prefs = {
  version: 1;
  minimizeToTray: boolean;
  startMinimized: boolean;
  launchOnStartup: boolean;
  themeMode: ThemeMode
};

const STORE_PATH = path.join(app.getPath('userData'), 'prefs.json');

function readStore(): Prefs {
  try {
    const txt = fs.readFileSync(STORE_PATH, 'utf-8');
    const obj = JSON.parse(txt);
    if (obj && obj.version === 1) {
      // ensure defaults for any future keys
      return {
        version: 1,
        minimizeToTray: obj.minimizeToTray ?? true,
        startMinimized: obj.startMinimized ?? false,
        launchOnStartup: obj.launchOnStartup ?? false,
        themeMode: obj.themeMode ?? 'system',
      }
    }
  } catch {}
  return { 
    version: 1, 
    minimizeToTray: true,
    startMinimized: false,
    launchOnStartup: false,
    themeMode: 'system',
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
};