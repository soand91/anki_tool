import type { HealthCheckId } from '../../shared/health/types';

export const HEALTH_ORDER: HealthCheckId[] = [
  'anki.process',
  'ankiconnect.http',
  'ankiconnect.version',
  'ankiconnect.addNoteDryRun',
];
