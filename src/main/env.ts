import path from 'path';
import { app } from 'electron';

export const isDev = !app.isPackaged;

export function assetsPath(...p: string[]) {
  // packaged: put assets under resources/
  const base = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(process.cwd(), 'assets');
  return path.join(base, ...p);
}