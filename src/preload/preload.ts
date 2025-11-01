import { contextBridge, ipcRenderer} from "electron";
import type { HealthCheckId, HealthCheckResult, HealthReport } from '../shared/health/types';

console.log('[preload] loaded');
contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong from preload',
  deckNames: () => ipcRenderer.invoke('anki:deckNames'),

  healthCheck: (id: HealthCheckId): Promise<HealthCheckResult> => 
    ipcRenderer.invoke('health:check', id),
  getHealthReport: (): Promise<HealthReport> => 
    ipcRenderer.invoke('health:getReport'),
  runAll: () => ipcRenderer.invoke('health:runAll'),
  onUpdate: <T = unknown>(cb: (msg: T) => void) => {
    const channel = 'health:update';
    const handler = (_: Electron.IpcRendererEvent, msg: T) => cb(msg);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});