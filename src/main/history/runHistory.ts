import { ipcMain } from "electron";
import { dlog } from "./utils";
import { getHistorySnapshot, clearHistory, updateHistoryEntries } from "../state/historyStore";
import type { HistoryFilter } from "../../shared/history/types";
import { notesInfo, cardsInfo } from "../ankiClient";
import type { HistoryEntry } from "../../shared/history/types";

export function registerHistoryIpc() {
  dlog('ipc:register');
  ipcMain.handle('history:get', async (_evt, filter?: HistoryFilter) => {
    dlog('ipc:invoke history:get', filter ?? {});
    try {
      const snapshot = getHistorySnapshot(filter ?? {});
      return snapshot;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      dlog('history:get failed', msg);
      throw new Error(`history:get failed: ${msg}`);
    }
  });
  ipcMain.handle('history:clear', async () => {
    dlog('ipc:invoke history:clear');
    try {
      clearHistory();
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      dlog('history:clear failed', msg);
      throw new Error(`history:clear failed: ${msg}`);
    }
  });
  ipcMain.handle('history:refresh', async (_evt, maxEntries?: number) => {
    dlog('ipc:invoke history:refresh', { maxEntries });
    await refreshHistoryFromAnki(maxEntries);
    return { ok: true };
  })
}

const HISTORY_REFRESH_MAX = 200;

export async function refreshHistoryFromAnki(maxEntries: number = HISTORY_REFRESH_MAX): Promise<void> {
  // 1) get latest N entries (any decks)
  const snapshot = getHistorySnapshot({ limit: maxEntries });
  if (!snapshot.entries.length) {
    return;
  }
  const recentEntries = snapshot.entries as HistoryEntry[];
  const noteIds = recentEntries.map(e => e.noteId);
  // 2) ask anki which notes still exist
  const noteInfos = await notesInfo(noteIds);
  const existingNoteIds = new Set(noteInfos.map(n => n.noteId));
  const noteIdToCards = new Map<number, number[]>();
  for (const n of noteInfos) {
    if (Array.isArray(n.cards)) {
      noteIdToCards.set(n.noteId, n.cards);
    }
  }
  // 3) Collect cardIds for existing notes for deckName refresh
  const allCardIds: number[] = [];
  for (const entry of recentEntries) {
    if (!existingNoteIds.has(entry.noteId)) continue;
    const cards = noteIdToCards.get(entry.noteId) ?? entry.cardIds ?? [];
    for (const cid of cards) {
      if (typeof cid === 'number') {
        allCardIds.push(cid);
      }
    }
  }

  // 4) Ask Anki for card deckNames (optional but cheap enough)
  const cardInfos = await cardsInfo(allCardIds);
  const cardIdToDeckName = new Map<number, string>();
  for (const c of cardInfos) {
    if (typeof c.cardId === 'number' && typeof c.deckName === 'string') {
      cardIdToDeckName.set(c.cardId, c.deckName);
    }
  }

  // 5) Update history entries in one pass
  updateHistoryEntries((entry) => {
    // Only touch entries in our recent slice; others unchanged
    if (!noteIds.includes(entry.noteId)) {
      return entry;
    }

    const stillExists = existingNoteIds.has(entry.noteId);
    let deleted = entry.deleted ?? false;
    let currentDeckName = entry.currentDeckName ?? entry.deckNameAtCreate;

    if (!stillExists) {
      deleted = true;
      // don't bother with deck name if deleted
      return {
        ...entry,
        deleted,
      };
    }

    // Note exists; try to derive a current deck name from its cards
    const cardsForNote = noteIdToCards.get(entry.noteId) ?? entry.cardIds ?? [];
    const decks: string[] = [];
    for (const cid of cardsForNote) {
      const deck = cardIdToDeckName.get(cid);
      if (deck) decks.push(deck);
    }

    if (decks.length > 0) {
      // choose the most frequent deck among the cards
      const counts = new Map<string, number>();
      for (const d of decks) {
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
      let bestDeck = currentDeckName;
      let bestCount = 0;
      for (const [d, c] of counts) {
        if (c > bestCount) {
          bestCount = c;
          bestDeck = d;
        }
      }
      currentDeckName = bestDeck ?? currentDeckName;
    }

    return {
      ...entry,
      deleted,
      currentDeckName,
    };
  });
}