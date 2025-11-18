import { Tray, nativeImage, app } from 'electron';
import { assetsPath } from './env'
import { prefersDarkTray, onThemeRelevantChange } from './theme';
import { TrayState } from './state/cardFlow';
import { EventEmitter } from 'events';
import { appStore } from './state/appStore';
import { useDebugValue } from 'react';

let tray: Tray | null = null;
let lastTrayState: TrayState | null = null;
let unsubscribe: (() => void) | null = null;

// platform/theme helpers
function platformDir() {
  if (process.platform === 'darwin') return 'mac';
  return 'win'
}

// icon + tooltip resolution
function iconVariantFor(state: TrayState) {
  if (platformDir() !== 'win') return '';
  switch (state) {
    case 'frontOnly':
      return '-top';
    case 'frontSuccess':
      return '-top-success';
    case 'frontFailure':
      return '-top-failure';
    case 'backOnly':
      return '-bottom';
    case 'backSuccess':
      return '-bottom-success';
    case 'backFailure':
      return '-bottom-failure';
    case 'ready':
      return '-both';
    case 'bothSuccess':
      return '-both-success';
    case 'bothFailure':
      return '-both-failure';
    default:
      return '';
  }
}

function iconFileFor(state: TrayState, isDark: boolean) {
  const assetRoot = "icons8-anki"
  const size = process.platform === 'darwin' ? '22' : '16';
  const color = isDark ? 'white' : 'black';;
  const variant = iconVariantFor(state);
  return `${assetRoot}-${color}-${size}${variant}.png`;
}

function iconPathFor(state: TrayState) { 
  const isDark = prefersDarkTray();
  const file = iconFileFor(state, isDark);
  return assetsPath(`${platformDir()}/${file}`);
}

function tooltipFor(s: TrayState) {
  switch (s) {
    case 'idle':            return 'Anki Helper - idle';
    case 'frontOnly':       return 'Front captured - S for Back, X to save';
    case 'backOnly':        return 'Back captured - A for Front, X to save';
    case 'ready':           return 'Card Ready - X to save';
    case 'awaitClipboard':  return 'Waiting for clipboard... press Ctrl+C';
    case 'frontSuccess':
    case 'backSuccess':
    case 'bothSuccess':
      return 'Card saved to Anki';
    case 'frontFailure':
    case 'backFailure':
    case 'bothFailure':
      return 'Card save failed';
    default:                return 'Anki Helper'
  }
}

// render the tray for a given state
function applyTrayRender(state: TrayState) {
  const icon = nativeImage.createFromPath(iconPathFor(state));
  if (!tray) {
    tray = new Tray(icon);
    tray.setToolTip(tooltipFor(state));
    return;
  }
  tray.setImage(icon);
  tray.setToolTip(tooltipFor(state));
}

// public setup
export function setupTray({
  onToggleMain,
  onOpenSettings,
  onQuit, 
  menu,
}: {
  onToggleMain: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
  menu: Electron.Menu;
}) {
  const s = appStore.getState();
  lastTrayState = s.tray;
  applyTrayRender(lastTrayState);

  tray!.setContextMenu(menu);
  tray!.on('click', onToggleMain);

  // react to theme/taskbar changes
  onThemeRelevantChange(() => { if (lastTrayState) applyTrayRender(lastTrayState) });

  // unsubscribe function
  unsubscribe = appStore.subscribe(next => {
    if (next.tray !== lastTrayState) {
      lastTrayState = next.tray;
      applyTrayRender(next.tray);
    }
  });

  app.on('before-quit', () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  });
}

export function getTray() { return tray; }
