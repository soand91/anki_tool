import { BrowserWindow, ipcMain } from "electron";
import { createDeck, getDeckNamesAndIds, addNote, getCardsFromNotes, guiBrowse } from "../ankiClient";
import { ensureHealthyOrThrow } from "../health/runHealth";
import { dlog } from "./utils";
import { recordHistoryEntry } from "../state/historyStore";
import { HistoryEntry } from "../../shared/history/types";
import { finalizeCaptureFlow, notifyCardSaveFailed } from "../state/cardFlowController";
import { emitAddNoteEvent } from "../state/addNoteEvents";

export function registerAnkiDeckIpc() {
  dlog('ipc:register');
  // deckNamesAndIds only returns a list of names & respective IDs
  ipcMain.handle('anki:deck:list', async () => {
    dlog('ipc:invoke anki:deck:list');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    return await getDeckNamesAndIds();
  });
  // creates a new empty deck
  ipcMain.handle('anki:deck:create', async (_event, name: string) => {
    if (!name || typeof name !== 'string') {
      throw new Error('Deck name must be a non-empty string');
    }
    dlog('ipc:invoke anki:deck:create');
    await ensureHealthyOrThrow({ ttlMs: 10_000, allowProceedIfStale: true, refreshIfStale: true });
    const id = await createDeck(name.trim());
    return { id };
  });
  // add new note
  ipcMain.handle('anki:addNote', async (_evt, payload: {
    modelName: 'Basic' | 'Cloze';
    fields: Record<string, string>;
    tags: string[];
    deckName?: string;
    allowDuplicate?: boolean;
    duplicateScope?: 'deck' | 'collection';
  }) => {
    if (!payload?.modelName || !payload?.fields) {
      throw new Error('Invalid addNote payload');
    }
    const deckName = (payload.deckName ?? 'Default').trim();
    const frontPreview = deriveFrontPreview(payload.fields, payload.modelName);
    const backPreview  = deriveBackPreview(payload.fields, payload.modelName);
    const eventFields: { front: string; back?: string } = {
      front: truncatePreview(frontPreview),
    };
    const trimmedBack = backPreview ? truncatePreview(backPreview) : undefined;
    if (trimmedBack) eventFields.back = trimmedBack;
    emitAddNoteEvent({
      kind: 'start',
      timestamp: Date.now(),
      deckName,
      fields: { ...eventFields },
    });
    try {
      const noteId = await addNote({
        modelName: payload.modelName,
        fields: payload.fields,
        tags: payload.tags ?? [],
        deckName,
        allowDuplicate: payload.allowDuplicate,
        duplicateScope: payload.duplicateScope,
      });
      emitAddNoteEvent({
        kind: 'success',
        timestamp: Date.now(),
        deckName,
        fields: { ...eventFields },
        noteId,
      });
      // fetch card IDs for this new note
      let cardIds: number[] = [];
      try {
        cardIds = await getCardsFromNotes([noteId]);
      } catch (err) {
        dlog('[history] getCardsFromNotes failed', err);
      }
      // record this note in the local history cache
      const entry: HistoryEntry = {
        noteId,
        cardIds,
        deckNameAtCreate: deckName,
        currentDeckName: deckName,
        createdAt: Date.now(),
        modelName: payload.modelName,
        frontPreview,
        backPreview,
        deleted: false,
      };

      recordHistoryEntry(entry);
      finalizeCaptureFlow();
      // push: notify all renderer windows that history changed
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send('history:updated', {
          noteId,
          deckName,
          createdAt: entry.createdAt,
        });
      }

      return { noteId };
    } catch (err: any) {
      const errorCode = typeof err?.code === 'string'
        ? err.code
        : err?.code != null
          ? String(err.code)
          : 'unknown';
      const errorMessage = err?.message ? String(err.message) : String(err ?? 'Unknown error');
      emitAddNoteEvent({
        kind: 'failure',
        timestamp: Date.now(),
        deckName,
        fields: { ...eventFields },
        errorCode,
        errorMessage,
      });
      notifyCardSaveFailed();
      const msg = err?.message ?? String(err);
      throw new Error(`addNote failed: ${msg}`)
    }
  });
  // open Anki's Browse window focused on specific note ID
  ipcMain.handle('anki:guiBrowseNote', async (evt, noteId: number) => {
    if (!noteId || typeof noteId !== 'number') {
      throw new Error('anki:guiBrowseNote requires a numeric noteId');
    }
    dlog('ipc:invoke anki:guiBrowseNote', noteId);
    await guiBrowse(`nid:${noteId}`);
    return { ok: true };
  });
  // open Anki's Browse window with an arbitrary query
  ipcMain.handle('anki:guiBrowseQuery', async(_evt, query: string) => {
    if (!query || typeof query !== 'string') {
      throw new Error('anki:guiBrowseQuery requires a non-empty query string');
    }
    dlog('ipc:invoke anki:guiBrowseQuery', query);
    await guiBrowse(query);
    return { ok: true };
  });
}

function deriveFrontPreview(
  fields: Record<string, string>,
  modelName: 'Basic' | 'Cloze'
): string {
  const explicit = modelName === 'Basic'
    ? firstNonEmptyField(fields, ['Front'])
    : firstNonEmptyField(fields, ['Text', 'Front']);

  const html = explicit ?? (() => {
    const firstKey = Object.keys(fields)[0];
    return firstKey ? (fields[firstKey] ?? '').trim() : '';
  })();

  return htmlToPreview(html);
}

function deriveBackPreview(
  fields: Record<string, string>,
  modelName: 'Basic' | 'Cloze'
): string | undefined {
  const explicit = modelName === 'Basic'
    ? firstNonEmptyField(fields, ['Back'])
    : firstNonEmptyField(fields, ['Back Extra', 'Back']);

  let html: string | undefined;
  if (explicit) {
    html = explicit;
  } else {
    const keys = Object.keys(fields);
    if (keys.length > 1) {
      html = fields[keys[1]] ?? '';
    }
  }
  const cleaned = htmlToPreview(html);
  return cleaned || undefined;
}

function firstNonEmptyField(
  fields: Record<string, string>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = fields[key];
    if (val && val.trim()) {
      return val.trim();
    }
  }
  return undefined;
}

export function htmlToPreview(raw: string | undefined | null, maxLen = 120): string {
  if (!raw) return '';
  let text = raw;

  // 1) Turn common "new line" tags into spaces FIRST
  text = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p|li|h[1-6])>/gi, ' ');

  // 2) Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // 3) Create a temporary DOM element to properly decode ALL HTML entities
  // This handles &nbsp;, &mdash;, &#8217;, &#x2019;, etc.
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = text;
    text = temp.textContent || temp.innerText || '';
  } else {
    // Fallback: manual decoding of common entities (for Node.js environments)
    text = text
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'")
      // Decode numeric entities
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // 4) Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (!text) return '';

  // 5) Truncate for preview
  if (text.length > maxLen) {
    return text.slice(0, maxLen - 1) + '…';
  }
  return text;
}

function truncatePreview(value: string | undefined | null, maxLen = 80): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 3) + '...';
}
