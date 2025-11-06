import type { HealthStatus } from "../../../shared/health/types";

export function mapFriendly(
  detail?: string,
  status?: HealthStatus
): { friendly: string; raw?: string } {
  const raw = detail?.trim() || undefined;

  // 1) never 'humanize' OK/checking/unknown - show raw or neutral
  if (status === 'ok')       return { friendly: raw ?? 'All checks passed.', raw };
  if (status === 'checking') return { friendly: 'Running…', raw };
  if (!raw)                  return { friendly: 'No additional details.', raw: undefined };

  // 2) transport-focused regexes (deterministic)
  if (/ECONNREFUSED/i.test(raw))      return { friendly: "Can't reach AnkiConnect (127.0.0.1:8765). Is Anki open?", raw };
  if (/ECONNRESET|EPIPE/i.test(raw))  return { friendly: "Connection reset by AnkiConnect. Please try again.", raw };
  if (/ETIMEDOUT|timeout/i.test(raw)) return { friendly: "Timed out waiting for AnkiConnect.", raw };

  // 3) Minimal domain clarifiers on explicit "Skipped:" messages you emit
  if (/^Skipped:/i.test(raw)) {
    const lower = raw.toLowerCase();
    if (lower.includes('anki is not running')) {
      return { friendly: 'Anki is not running. Launch Anki and try again.', raw };
    }
    if (lower.includes('ankiconnect http not reachable')) {
      return { friendly: 'AnkiConnect isn’t reachable. Open Anki and ensure the add-on is enabled.', raw };
    }
    // Generic "Skipped - …" without guessing
    return { friendly: raw.replace(/^Skipped:\s*/i, 'Skipped — '), raw };
  }
  // 4) Default: show source text as the friendly line (tooltip still shows raw)
  return { friendly: raw, raw };
}