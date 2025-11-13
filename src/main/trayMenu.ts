import { Menu } from 'electron';

export function buildTrayMenu(opts: {
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  return Menu.buildFromTemplate([
    { label: 'Open Settings…', click: opts.onOpenSettings },
    { type: 'separator' },
    process.platform === 'darwin' 
      ? { role: 'quit' as const }
      : { label: 'Quit', click: opts.onQuit },
  ]);
}