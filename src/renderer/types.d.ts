// src/renderer/types.d.ts
export {};

import type { HealthCheckId, HealthCheckResult, HealthReport } from '../shared/health/types';

declare global {
  interface Window {
    api: ApiBridge;
  }
}

interface ApiBridge {
  runAll(): Promise<HealthReport>;
  onHealthUpdate<T = unknown>(cb: (evt: T) => void): () => void;
  startHealthPolling(intervalMs?: number): Promise<void>;
  stopHealthPolling(): Promise<void>;

  getHealthReport(): Promise<import('../shared/health/types').HealthReport>;
  onUpdate<T = unknown>(cb: (evt: T) => void): () => void;
  runMini(): Promise<HealthReport>;

  addDeck(): Promise<void>;
  getDecks(): Promise<string[]>;

  deckNames?(): Promise<string[]>;
  ping?(): Promise<{ ok: boolean }>;
}