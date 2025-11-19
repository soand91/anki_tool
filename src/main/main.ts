import { app, BrowserWindow, Menu, globalShortcut } from 'electron';
import type { Event as ElectronEvent } from 'electron'
import { createMainWindow } from './win-main';
import { buildTrayMenu } from './trayMenu';
import { buildAppMenu } from './appMenu';
import { setupTray } from './tray';
import { registerIpc } from './ipc';
import { registerHealthIpc, runAllChecks, startHealthPolling } from './health/runHealth';
import { initMainLogging, log } from './log';
import { hotkeys } from './settings/hotkey.store';
import { prefs } from './settings/prefs.store';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function showMain(win: BrowserWindow) {
  win.setSkipTaskbar(false);
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
}

initMainLogging();

// Allow sound playback even when there hasn't been a user gesture yet
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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

    // start minimized: hide to tray if enabled
    if (mainWindow && prefs.getStartMinimized()) {
      mainWindow.setSkipTaskbar(true);
      mainWindow.hide();
    }

    // window policy: close/minimize => tray 
    if (mainWindow) {
      // hide on window "X" unless actually quitting
      mainWindow.on('close' as 'close', (e: ElectronEvent) => {
        if (isQuitting) return;   // real quit
        // on Windows/Linux: hide to tray instead of closing
        if (process.platform !== 'darwin') {
          e.preventDefault();
          mainWindow!.setSkipTaskbar(true);   // disappear from taskbar
          mainWindow!.hide();
        }
      });
      // minimize: hide to tray if enabled in prefs
      mainWindow.on('minimize', () => {
        if (process.platform === 'darwin') return;
        if (!prefs.getMinimizeToTray()) return;
        mainWindow!.setSkipTaskbar(true);
        mainWindow!.hide();
      });
    }

    startHealthPolling(8000)

    // unified quit callback
    const quitApp = () => {
      isQuitting = true;
      app.quit();
    };

    // 1) build the topbar menu
    buildAppMenu(
      () => mainWindow,
      () => {
        isQuitting = true;
        quitApp();
      }
    );

    // 2) build the tray menu
    const trayMenu = buildTrayMenu({
      onOpenSettings: () => {
        if (!mainWindow) return;
        showMain(mainWindow);
      },
      onQuit: quitApp,
    })

    setupTray({
      onToggleMain: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.setSkipTaskbar(true);
          mainWindow.hide();
        } else {
          showMain(mainWindow);
        };
      },
      onOpenSettings: () => { 
        if (!mainWindow) return;
        showMain(mainWindow); 
      },
      onQuit: quitApp,
      menu: trayMenu,
    });

    runAllChecks().catch(() => {}).finally(() => {});

    if (mainWindow) {
      hotkeys.attach(mainWindow);
      hotkeys.reload();
    }
  });
}

 app.on('window-all-closed', () => {
  // Tray-style behavior: keep the app alive in background
  // (macOS also commonly stays alive; adjust if you want different behavior)
  return;
 });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    // re-wire close/minimize policy for newly created window
    if (mainWindow) {
      mainWindow.on('close' as 'close', (e: ElectronEvent) => {
        if (isQuitting) return;
        if (process.platform !== 'darwin') {
          e.preventDefault();
          mainWindow!.setSkipTaskbar(true);
          mainWindow!.hide();
        }
      });
      mainWindow.on('minimize', () => {
        if (process.platform === 'darwin') return;
        if (!prefs.getMinimizeToTray()) return;
        mainWindow!.setSkipTaskbar(true);
        mainWindow!.hide();
      });
    }
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

app.on('before-quit', () => {
  // if any path triggers before-quit (updates, Exit Menu, etc.) allow window to close
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
