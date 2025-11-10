import { create } from 'zustand';

type DeckId = number;

export type DeckRecord = {
  id: DeckId;
  name: string;
  segments: string[];
  // optional UI hint for optimistic rows
  _optimistic?: boolean;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type RefreshOpts = { force?: boolean; ttlMs?: number };

type DeckState = {
  // data
  decksById: Map<DeckId, DeckRecord>;
  decksByName: Map<string, DeckId>;
  sortedDecks: DeckRecord[];
  selectedDeckId: DeckId | null;

  // meta
  status: Status;
  error: string | null;
  lastFetchedAt: number;

  // actions
  refresh: (opts?: RefreshOpts) => Promise<void>;
  create: (name: string) => Promise<void>;
  select: (deckid: DeckId | null) => void;

  // derived helpers 
  getSelectedDeckName: () => string | null;
  isStale: (ttlMs?: number) => boolean;
};

const DEFAULT_TTL_MS = 60_000;
const REFRESH_DEBOUNCE_MS = 350;

// single shared debounce/flight guards per module
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightRefresh: Promise<void> | null = null;

function splitSegments(name: string): string[] {
  // anki hierarchy uses '::'
  return name.split('::').filter(Boolean);
}
function now() {
  return Date.now();
}
function sortedDecks(decksById: Map<DeckId, DeckRecord>): DeckRecord[] {
  return Array.from(decksById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// the store
export const useDeckStore = create<DeckState>((set, get) => ({
  // initial state
  decksById: new Map(),
  decksByName: new Map(),
  sortedDecks: new Array,
  selectedDeckId: null,

  status: 'idle',
  error: null,
  lastFetchedAt: 0,

  // actions
  refresh: async (opts?: RefreshOpts) => {
    const { force = false, ttlMs = DEFAULT_TTL_MS } = opts ?? {};
    console.log(`[deckStore] refresh() called`, {
      force, 
      ttlMs, 
      lastFetchedAt: get().lastFetchedAt,
      now: Date.now(),
    });
    const state = get();

    const tooOld = now() - state.lastFetchedAt > ttlMs;
    if (!force && !tooOld) {
      // fresh enough; nothing to be done
      return;
    }
    // debounce bursts (focus, manual refresh, post-create, etc.)
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    // if a refresh is already in flight and caller didn't force, reuse it
    if (inFlightRefresh && !force) {
      return inFlightRefresh;
    }

    const doFetch = () => {
      set({ status: state.lastFetchedAt === 0 ? 'loading' : get().status, error: null });
      const p = (async () => {
        try {
          const map = await window.api.deck.getDecks();
          // rebuild maps
          const byId = new Map<DeckId, DeckRecord>();
          const byName = new Map<string, DeckId>();
          for (const [name, id] of Object.entries(map)) {
            const rec: DeckRecord = { id, name, segments: splitSegments(name) };
            byId.set(id, rec);
            byName.set(name, id);
          }
          // selection drift resolution
          const prevSelected = get().selectedDeckId;
          let nextSelected: DeckId | null = prevSelected;
          if (prevSelected != null && !byId.has(prevSelected)) {
            // selected deck no longer exists (deleted, moved, etc.)
            nextSelected = null //TODO message here
          }
          set({
            decksById: byId,
            decksByName: byName,
            sortedDecks: sortedDecks(byId),
            lastFetchedAt: now(),
            status: 'ready',
            error: null,
            selectedDeckId: nextSelected,
          });
        } catch (e: any) {
          set({
            status: 'error',
            error: e?.message ?? String(e),
          });
        } finally {
          inFlightRefresh = null;
        }
      })();
      inFlightRefresh = p;
      return p;
    };
    if (force) {
      return doFetch();
    }
    // debounced path
    const p = new Promise<void>((resolve) => {
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        doFetch().then(resolve);
      }, REFRESH_DEBOUNCE_MS);
    });
    return p;
  },

  create: async (name: string) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      throw new Error('Deck name must be a non-empty string');
    }
    // optimistic add with a negative temp id
    const tempId: DeckId = -now();
    const optimistic: DeckRecord = {
      id: tempId,
      name: trimmed,
      segments: splitSegments(trimmed),
      _optimistic: true,
    };
    // insert optimistic row at once
    set((s) => {
      const nextById = new Map(s.decksById);
      nextById.set(tempId, optimistic);
      const nextByName = new Map(s.decksByName);
      nextByName.set(trimmed, tempId);
      return {
        decksById: nextById,
        decksByName: nextByName,
        sortedDecks: sortedDecks(nextById),
      };
    });
    try {
      await window.api.deck.createDeck(trimmed);
      // after create, force a single truthful refresh to reconcile id/name/casing
      await get().refresh({ force: true });
      // optionally keep selection on the newly created deck:
      const { decksByName } = get();
      const realId = decksByName.get(trimmed);
      if (realId != null) {
        get().select(realId);
      }
    } catch (e: any) {
      set((s) => {
        const nextById = new Map(s.decksById);
        const nextByName = new Map(s.decksByName);
        nextById.delete(tempId);
        // only delete the optimistic name mapping if it points to the temp id
        if (nextByName.get(trimmed) === tempId) nextByName.delete(trimmed);
        return {
          decksById: nextById,
          decksByName: nextByName,
          sortedDecks: sortedDecks(nextById),
          status: 'error',
          error: e?.message ?? String(e),
        };
      });
      throw e;
    }
  },

  select: (deckId: DeckId | null) => {
    const state = get();
    if (deckId != null && !state.decksById.has(deckId)) {
      // ignore selecting an unknown id
      return;
    }
    set({ selectedDeckId: deckId });
  },

  // derived helpers
  getSelectedDeckName: () => {
    const { selectedDeckId, decksById } = get();
    if (selectedDeckId == null) return null;
    return decksById.get(selectedDeckId)?.name ?? null;
  },
  isStale: (ttlMs = DEFAULT_TTL_MS) => {
    return now() - get().lastFetchedAt > ttlMs
  },
}));

// convenience selectors
export const useDeckStatus = () => useDeckStore((s) => s.status);
export const useDeckError = () => useDeckStore((s) => s.error);
export const useSelectedDeckId = () => useDeckStore((s) => s.selectedDeckId);
export const useLastFetchedAt = () => useDeckStore((s) => s.lastFetchedAt);
export const useAllDecks = () => useDeckStore((s) => s.sortedDecks);