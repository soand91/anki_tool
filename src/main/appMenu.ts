// src/main/appMenu.ts
import { app, BrowserWindow, Menu, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

export function buildAppMenu(
  getMainWindow: () => BrowserWindow | null,
  quitApp: () => void
) {
  const isMac = process.platform === 'darwin';
  const isDev = process.env.NODE_ENV === 'development';

  // helpers
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const withWC = (getMainWindow: () => Electron.BrowserWindow | null, fn: (wc: Electron.WebContents) => void) => () => { const wc = getMainWindow()?.webContents; if (wc) fn(wc); };
  const zoomIn    = withWC(getMainWindow, wc => wc.setZoomFactor(clamp(wc.getZoomFactor() + 0.1, 0.5, 3)));
  const zoomOut   = withWC(getMainWindow, wc => wc.setZoomFactor(clamp(wc.getZoomFactor() - 0.1, 0.5, 3)));
  const resetZoom = withWC(getMainWindow, wc => wc.setZoomFactor(1));

  const devItems: MenuItemConstructorOptions[] = isDev
    ? [{ role: 'reload' }, { role: 'toggleDevTools' }]
    : [];

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      isMac
        ? { role: 'close' }
        : {
          label: 'Exit', 
          accelerator: 'Alt-F4',
          click: () => quitApp(),
        },
    ],
  };

  const viewMenu: MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      { role: 'resetZoom', label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: resetZoom, },
      { role: 'zoomIn', label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: zoomIn, },
      { role: 'zoomIn', label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', visible: false, acceleratorWorksWhenHidden: true, click: zoomIn, },
      { role: 'zoomOut', label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: zoomOut, },
      { type: 'separator' },
      ...devItems,
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };

  const settingsMenu: MenuItemConstructorOptions = {
    label: 'Settings',
    submenu: [
      {
        label: 'Open Settings…',
        accelerator: 'CmdOrCtrl+,',
        click: () => 
          getMainWindow()?.webContents.send('open-settings', { section: 'general' }),
      },
      { label: 'Hotkeys…', 
        click: () => 
          getMainWindow()?.webContents.send('open-settings', { section: 'hotkeys' }), 
      },
    ],
  };

  const helpMenu: MenuItemConstructorOptions = {
    role: 'help',
    submenu: [
      { label: 'Documentation', click: () => shell.openExternal('https://example.com/docs') },
    ],
  };

  const macAppMenu: MenuItemConstructorOptions[] = isMac
    ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      }]
    : [];

  const template: MenuItemConstructorOptions[] = [
    ...macAppMenu,
    fileMenu,
    viewMenu,
    settingsMenu,
    helpMenu,
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
