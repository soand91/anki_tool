import { app, BrowserWindow, Menu, globalShortcut } from 'electron';
import { createMainWindow } from './win-main';
import { buildTrayMenu } from './menu';
import { setupTray } from './tray';
import { registerIpc } from './ipc';
import { registerHealthIpc, runAllChecks, startHealthPolling } from './health/runHealth';
import { initMainLogging, log } from './log';
import { hotkeys } from './hotkeys/hotkeyRegistry';

let mainWindow: BrowserWindow | null = null;

initMainLogging();

const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    log.info('[main] app ready');
    registerIpc();
    mainWindow = createMainWindow();
    startHealthPolling(8000)

    const menu = buildTrayMenu({
      onOpenSettings: () => { mainWindow?.show(); mainWindow?.focus() },
      onQuit: () => app.quit(),
    });

    setupTray({
      onToggleMain: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
      },
      onOpenSettings: () => { mainWindow?.show(); mainWindow?.focus() },
      onQuit: () => app.quit(),
      menu,
    });

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Settings',
        submenu: [
          {
            label: 'Hotkeys…',
            accelerator: process.platform === 'darwin' ? 'Command+,' : undefined,
            click: () => mainWindow?.webContents.send('ui:openHotkeys')
          }
        ]
      }
    ];
    
    const menuBar = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menuBar);

    runAllChecks().catch(() => {}).finally(() => {});

    if (mainWindow) {
      hotkeys.attach(mainWindow);
      hotkeys.reload();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return;
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    // re-attach hotkeys if a new window gets created on macOS re-active
    hotkeys.attach(mainWindow);
    hotkeys.reload();
  }
});

app.on('web-contents-created', (_e, contents) => {
  contents.on('preload-error', (_event, path, err) => {
    console.error('[main] preload-error at', path, err);
  });
  contents.on('console-message', (_e2, level, message) => {
    if (message.startsWith('[preload]')) console.log(message);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
})