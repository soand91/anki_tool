// src/main/state/history/store.ts
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {
  HistoryEntry,
  HistoryFilter,
  HistorySnapshot
} from '../../shared/history/types';
import { htmlToPreview } from '../decks/runDecks';

const HISTORY_FILE_NAME = 'anki_history.json';
const HISTORY_MAX_ENTRIES = 500;

let historyFilePath: string | null = null;
let historyLoaded = false;
let historyEntries: HistoryEntry[] = [];
let pendingWrite: NodeJS.Timeout | null = null;

/**
 * Resolve and memoize the file path we use for history persistence.
 */
function getHistoryFilePath(): string {
  if (historyFilePath) return historyFilePath;
  const userData = app.getPath('userData');
  historyFilePath = path.join(userData, HISTORY_FILE_NAME);
  return historyFilePath;
}

/**
 * Load history from disk into memory. Called lazily on first use.
 */
function loadHistoryFromDisk(): void {
  if (historyLoaded) return;
  historyLoaded = true;

  try {
    const filePath = getHistoryFilePath();
    if (!fs.existsSync(filePath)) {
      historyEntries = [];
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) {
      historyEntries = [];
      return;
    }

    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (Array.isArray(parsed)) {
      // Ensure newest → oldest order and cap to max.
      historyEntries = parsed
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, HISTORY_MAX_ENTRIES);
    } else {
      historyEntries = [];
    }
  } catch (err) {
    console.error('[history] failed to load history from disk:', err);
    historyEntries = [];
  }
}

/**
 * Debounced write of the in-memory history to disk.
 */
function scheduleWriteToDisk(): void {
  if (pendingWrite) {
    clearTimeout(pendingWrite);
  }
  pendingWrite = setTimeout(() => {
    pendingWrite = null;
    try {
      const filePath = getHistoryFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify(historyEntries, null, 2);
      fs.writeFileSync(filePath, data, 'utf8');
    } catch (err) {
      console.error('[history] failed to write history to disk:', err);
    }
  }, 500);
}

/**
 * Initialize the history store (optional, but nice to call on app ready).
 * This will eagerly load from disk instead of at first query.
 */
export function initHistoryStore(): void {
  loadHistoryFromDisk();
}

/**
 * Append a new history entry (newest) and persist (debounced).
 * Also enforces HISTORY_MAX_ENTRIES.
 */
export function recordHistoryEntry(entry: HistoryEntry): void {
  loadHistoryFromDisk();

  // Ensure the entry has createdAt set (in case caller forgot).
  const createdAt = entry.createdAt ?? Date.now();
  const normalized: HistoryEntry = {
    ...entry,
    createdAt
  };

  // Insert at front (newest first).
  historyEntries.unshift(normalized);

  // Cap size by removing oldest items at the end.
  if (historyEntries.length > HISTORY_MAX_ENTRIES) {
    historyEntries = historyEntries.slice(0, HISTORY_MAX_ENTRIES);
  }

  scheduleWriteToDisk();
}

/**
 * Update one or more entries in-place.
 * Helpful later for back-validation (deleted / currentDeckName changes).
 */
export function updateHistoryEntries(
  updater: (entry: HistoryEntry) => HistoryEntry | HistoryEntry | null
): void {
  loadHistoryFromDisk();

  let mutated = false;
  const next: HistoryEntry[] = [];

  for (const entry of historyEntries) {
    const updated = updater(entry);
    if (updated === null) {
      mutated = true;
      continue;
    }
    if (updated !== entry) {
      mutated = true;
      next.push(updated);
    } else {
      next.push(entry);
    }
  }

  if (mutated) {
    // Sort again by createdAt descending just in case updated timestamps changed.
    historyEntries = next.sort((a, b) => b.createdAt - a.createdAt);
    // Cap.
    if (historyEntries.length > HISTORY_MAX_ENTRIES) {
      historyEntries = historyEntries.slice(0, HISTORY_MAX_ENTRIES);
    }
    scheduleWriteToDisk();
  }
}

/**
 * Get a snapshot of history entries, optionally filtered by deck and limited.
 */
export function getHistorySnapshot(filter: HistoryFilter = {}): HistorySnapshot {
  loadHistoryFromDisk();

  const { deck, limit } = filter;

  let filtered = historyEntries;

  if (deck) {
    filtered = filtered.filter(entry => {
      if (entry.deckNameAtCreate === deck) return true;
      if (entry.currentDeckName && entry.currentDeckName === deck) return true;
      return false;
    });
  }

  // Already stored newest → oldest, but sort again defensively.
  filtered = filtered.slice().sort((a, b) => b.createdAt - a.createdAt);

  const total = filtered.length;
  const max = typeof limit === 'number' && limit > 0 ? limit : 50;
  const entries = filtered.slice(0, max).map(entry => {
    // Apply htmlToPreview transformation for any entries that might have raw HTML
    const needsTransform = 
      (entry.frontPreview && (entry.frontPreview.includes('<') || entry.frontPreview.includes('&'))) ||
      (entry.backPreview && (entry.backPreview.includes('<') || entry.backPreview.includes('&')));
    
    if (needsTransform) {
      return {
        ...entry,
        frontPreview: htmlToPreview(entry.frontPreview),
        backPreview: entry.backPreview ? htmlToPreview(entry.backPreview) : undefined,
      };
    }
    return entry;
  });

  return { entries, total };
}

/**
 * Clear all history entries (useful for debugging / dev tools).
 */
export function clearHistory(): void {
  loadHistoryFromDisk();
  historyEntries = [];
  scheduleWriteToDisk();
}
