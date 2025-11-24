import { Menu } from 'electron';

export function buildTrayMenu(opts: {
  onToggleHud: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  return Menu.buildFromTemplate([
    { label: 'Toggle HUD', click: opts.onToggleHud },
    { label: 'Open Settings…', click: opts.onOpenSettings },
    { type: 'separator' },
    process.platform === 'darwin' 
      ? { role: 'quit' as const }
      : { label: 'Quit', click: opts.onQuit },
  ]);
}
