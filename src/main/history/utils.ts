import { isDev } from '../env';

// logger
export function dlog(...args: any[]) {
  if (!isDev) return;
  console.debug('[history]', ...args);
}
