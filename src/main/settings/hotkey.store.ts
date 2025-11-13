import { app, globalShortcut, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type HotkeyActionId = 
  | 'app.showWindow'
  | 'note.captureFront'
  | 'note.captureBack'
  | 'note.add'
  | 'note.undoCapture'

type HotkeyConfig = Record<HotkeyActionId, string>;

type StoreShape = {
  version: 1;
  overrides: Partial<Record<HotkeyActionId, string>>;
};

const isMac = process.platform === 'darwin';
const DEFAULTS: HotkeyConfig = {
  'app.showWindow'   : isMac ? 'Command+Shift+Alt+W' : 'Ctrl+Shift+Alt+W',
  'note.captureFront': isMac ? 'Command+Shift+Alt+A' : 'Ctrl+Shift+Alt+A', 
  'note.captureBack' : isMac ? 'Command+Shift+Alt+S' : 'Ctrl+Shift+Alt+S',
  'note.add'         : isMac ? 'Command+Shift+Alt+X' : 'Ctrl+Shift+Alt+X',
  'note.undoCapture' : isMac ? 'Command+Shift+Alt+Z' : 'Ctrl+Shift+Alt+Z',
};

const BLOCKED = new Set([
  'Alt+F4', 'Command+Q', 'Ctrl+Q', 'Command+W', 'Ctrl+W'
]);

const STORE_PATH = path.join(app.getPath('userData'), 'hotkeys.json');

function readStore(): StoreShape {
  try {
    const txt = fs.readFileSync(STORE_PATH, 'utf-8');
    const obj = JSON.parse(txt);
    if (obj && obj.version === 1 && obj.overrides && typeof obj.overrides === 'object') {
      const ov = obj.overrides as Record<string, string>;
      let changed = false;
      for (const k of Object.keys(ov)) {
        const before = ov[k];
        const after = normalizeAccelerator(before);
        if (after !== before) { ov[k] = after; changed = true; }
      }
      const fixed: StoreShape = { version: 1, overrides: ov };
      if (changed) writeStore(fixed);
      return fixed;
    }
  } catch {}
  return { version: 1, overrides: {} };
}

function writeStore(s: StoreShape) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(s, null, 2), 'utf-8');
}

function normalizeAccelerator(accel: string): string {
  const s = accel.trim().replace(/\s+/g, '');
  // tokenise either by '+' or by camel-ish/char tokens
  const parts = s.includes('+')
    ? s.split('+')
    : (s.match(/(Command|Control|Ctrl|Alt|Option|Shift|Meta|[A-Z][a-z]+|[A-Z]|\d+|F\d{1,2}|Enter|Tab|Backspace|Delete|Escape|Esc|Space|Up|Down|Left|Right)/g) || []);
  const norm = parts
    .map(p => (p === 'Control' ? 'Ctrl' : p)) // unify Control -> Ctrl
    .map(p => p.length === 1 ? p.toUpperCase() : (p[0].toUpperCase() + p.slice(1)))
    .join('+');

  if (process.platform !== 'darwin') {
    return norm.replace(/^Command\+/, 'Ctrl+').replace(/\+Command\+/g, '+Ctrl+');
  }
  return norm;
}

export function mergeEffective(overrides: StoreShape['overrides']): {
  effective: HotkeyConfig,
  inactive: HotkeyActionId[],
  issues: Record<HotkeyActionId, string | undefined>
} {
  const effective: HotkeyConfig = { ...DEFAULTS };
  const inactive: HotkeyActionId[] = [];
  const issues: Record<HotkeyActionId, string | undefined> = {
    'app.showWindow': undefined,
    'note.captureFront': undefined,
    'note.captureBack': undefined,
    'note.add': undefined,
    'note.undoCapture': undefined,
  };

  const seen = new Map<string, HotkeyActionId>();
  for (const [id, accel] of Object.entries(overrides) as [HotkeyActionId, string][]) {
    if (!accel || !accel.trim()) continue;
    const norm = accel.trim();
    if (BLOCKED.has(norm)) { issues[id] = 'blocked'; continue; }
    if (seen.has(norm)) { issues[id] = `conflict:${seen.get(norm)}`; continue; }
    seen.set(norm, id);
    (effective as any)[id] = norm;
  }

  return { effective, inactive, issues };
}

export class HotkeyRegistry {
  private store: StoreShape = readStore();
  private win: BrowserWindow | null = null;
  private suspended = false;

  attach(win: BrowserWindow) {
    this.win = win;
  }

  setSuspended(on: boolean) {
    if (on === this.suspended) return;
    this.suspended = on;
    if (on) {
      globalShortcut.unregisterAll();
    } else {
      this.reload();
    }
  }

  getSnapshot() {
    const { effective, issues } = mergeEffective(this.store.overrides);
    return {
      defaults: DEFAULTS,
      overrides: this.store.overrides,
      effective,
      inactive: Object.entries(issues)
        .filter(([, v]) => v != null && v.startsWith('os-'))
        .map(([k]) => k as HotkeyActionId),
      issues
    };
  }

  set(actionId: HotkeyActionId, accel: string | null) {
    if (accel === null) {
      delete this.store.overrides[actionId];
      writeStore(this.store);
      return this.reload();
    }
    const next = normalizeAccelerator(accel);
    if (!next) return { ok: false, reason: 'empty' as const, snapshot: this.getSnapshot() };
    if (BLOCKED.has(next)) return { ok: false, reason: 'blocked' as const, snapshot: this.getSnapshot() };

    // prevent duplicate with other actions
    const { effective } = mergeEffective(this.store.overrides);
    for (const [k, v] of Object.entries(effective)) {
      if (k !== actionId && v === next) {
        return { ok: false, reason: `conflict:${k}`, snapshot: this.getSnapshot() };
      }
    }

    this.store.overrides[actionId] = next;
    writeStore(this.store);
    return this.reload();
  }

  resetAll() {
    this.store.overrides = {};
    writeStore(this.store);
    return this.reload();
  }

  reload() {
    if (!this.win) return { ok: false, reason: 'no-window', snapshot: this.getSnapshot() };
    if (this.suspended) {
      this.win.webContents.send('note:hotkeysChanged', this.getSnapshot());
      return { ok: true, reason: null as any, snapshot: this.getSnapshot() };
    }
    globalShortcut.unregisterAll();
    const { effective, issues } = mergeEffective(this.store.overrides);

    for (const [id, accel] of Object.entries(effective) as [HotkeyActionId, string][]) {
      try {
        const ok = globalShortcut.register(accel, () => this.fire(id));
        if (!ok) issues[id] = 'os-register-failed';
      } catch {
        issues[id] = 'os-register-failed';
      }
    }

    this.win?.webContents.send('note:hotkeysChanged', {
      defaults: DEFAULTS,
      overrides: this.store.overrides,
      effective,
      inactive: Object.entries(issues).filter(([, v]) => v != null).map(([k]) => k),
      issues,
    });

    return { ok: true, reason: null as any, snapshot: { defaults: DEFAULTS, overrides: this.store.overrides, effective, inactive: [], issues } };
  }

  private fire(id: HotkeyActionId) {
    if (this.suspended) return;
    if (!this.win) return;
    switch (id) {
      case 'app.showWindow': {
        const w = this.win;
        if (!w.isVisible()) w.show();
        if (w.isMinimized()) w.restore();
        w.focus()
        break;
      }
      case 'note.captureFront':
        this.win.webContents.send('note:capture', {
          side: 'front',
          html: this.readClipboardHtml(),
          source: { origin: 'clipboard' as const, captureAt: Date.now() }
        });
        break;
      case 'note.captureBack': 
        this.win.webContents.send('note:capture', {
          side: 'back', 
          html: this.readClipboardHtml(),
          source: { origin: 'clipboard' as const, capturedAt: Date.now() }
        });
        break;
      case 'note.add': 
        this.win.webContents.send('note:addRequest');
        break;
      case 'note.undoCapture':
        this.win.webContents.send('note:undoCapture');
        break;
    }
  }

  private readClipboardHtml(): string | null {
    const { clipboard } = require('electron') as typeof import('electron');
    const html = clipboard.readHTML();
    if (html && html.trim()) return html;
    const text = clipboard.readText();
    if (!text || !text.trim()) return null;
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(/\r?\n/g, '<br>');
  }
}

export const hotkeys = new HotkeyRegistry();