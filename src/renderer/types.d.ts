// src/renderer/types.d.ts
export {};

import type { HealthCheckId, HealthCheckResult, HealthReport } from '../shared/health/types';

declare global {
  interface Window {
    api: {
      ping: () => string;
      deckNames: () => Promise<string[]>;

      // Health bridge
      healthCheck: (id: HealthCheckId) => Promise<HealthCheckResult>;
      getHealthReport: () => Promise<HealthReport>;
      runAll: () => Promise<unknown>;
      onUpdate: <T = unknown>(cb: (msg: T) => void) => () => void; // subscribe -> unsubscribe
      startHealthPolling: (intervalMs?: number) => Promise<void>;
      stopHealthPolling: () => Promise<void>;
      runMini: () => Promise<HealthReport>;
    };
  }
}
