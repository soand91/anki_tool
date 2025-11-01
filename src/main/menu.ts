import { Menu } from 'electron';

export function buildTrayMenu(opts: {
  onOpenSettings: () => void;
  onQuit: () => void;
}) {
  return Menu.buildFromTemplate([
    { label: 'Open Settings', click: opts.onOpenSettings },
    { label: 'separator' },
    { label: 'Quit', click: opts.onQuit },
  ]);
}