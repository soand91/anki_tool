import fs from "fs";
import path from "path";
import log from 'electron-log/main';
import { app } from 'electron';

// Console + file verbosity
log.transports.console.level = 'silly';
log.transports.file.level = 'silly';

log.transports.file.resolvePathFn = () => {
  const name = app.getName();
  return app.getPath('userData') + `/${name}-main.log`;
}

export function initMainLogging() {
  if (log.transports.console) {
    log.transports.console.level = 'silly';
  }
  if (log.transports.file) {
    log.transports.file.level = 'silly';
    log.transports.file.resolvePathFn = () => 
      path.join(app.getPath('userData'), `${app.getName()}-main.log`);
    const f = log.transports.file.getFile?.();
    if (f) {
      log.info('log file:', f.path);
    }
  }
  process.on('uncaughtException', (err) => {
    log.error('[main] Uncaught exception:', err);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('[main] Unhandled rejection:', reason as any);
  });
  log.info('--- App Starting ---');
}

const logFile = path.join(process.cwd(), "health.log");
export function logHealth(event: string, data: Record<string, any>) {
    const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
    fs.appendFile(logFile, line + "\n", () => {});
}

export { log };