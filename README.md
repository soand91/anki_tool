/src
  /main            // Electron MAIN process (Node context)
    main.ts        // composition root (wire things together)
    env.ts         // paths, isDev, helpers
    theme.ts       // taskbar/app theme detection + change signals
    tray.ts        // tray creation, icon switching, click handlers
    menu.ts        // tray/context menus (pure builders)
    win-main.ts    // BrowserWindow creation + window events
    ipc.ts         // register ipcMain handlers (typed)
    anki.ts        // external API calls / services
    /state
      cardFlow.ts  // decision tree
      store.ts     // store to hold state and broadcast updates
  /preload         // isolated bridge between main & renderer
    preload.ts     // contextBridge.exposeInMainWorld(...)
  /renderer        // React (UI), runs in BrowserWindow
    ...            // pages, components, hooks, etc.
/assets            // icons, images (copied to resources in prod)
