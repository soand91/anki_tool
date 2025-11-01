import { nativeTheme, app, powerMonitor } from 'electron';
import { execSync } from 'child_process';

function winIsDarkTaskbar(): boolean {
  try {
    const out = execSync(
      'reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize /v SystemUsesLightTheme',
      { encoding: 'utf8' }
    );
    const isLight = /SystemUsesLightTheme\s+REG_DWORD\s+0x1/i.test(out);
    return !isLight;
  } catch {
    return nativeTheme.shouldUseDarkColors;
  }
}

// Returns whether the *tray background* is dark 
export function prefersDarkTray(): boolean {
  if (process.platform === 'win32') return winIsDarkTaskbar();
  return nativeTheme.shouldUseDarkColors;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onThemeRelevantChange(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function fire() { listeners.forEach(fn => fn()); }

// Emit on common triggers
nativeTheme.on('updated', fire);
app.on('browser-window-focus', fire);
powerMonitor.on('resume', fire);

// Windows polling for rare edge cases
if (process.platform === 'win32') {
  setInterval(fire, 5000);
}