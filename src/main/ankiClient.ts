const ANKI_URL = 'http://127.0.0.1:8765';
const ANKICONNECT_VERSION = 6;

type AnkiResponse<T> = {
  result: T | null;
  error: string | null;
}

class AnkiConnectError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'AnkiConnectError';
  }
}

export interface AnkiNoteInfo {
  noteId: number;
  cards: number[];
}

export interface AnkiCardInfo {
  cardId: number;
  noteId: number;
  deckName: string;
}

export async function notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
  if (!Array.isArray(noteIds) || noteIds.length === 0) return [];
  const result = await ankiCall<AnkiNoteInfo[]>('notesInfo', { notes: noteIds });
  return Array.isArray(result) ? result : [];
}

export async function cardsInfo(cardIds: number[]): Promise<AnkiCardInfo[]> {
  if (!Array.isArray(cardIds) || cardIds.length === 0) return [];
  const result = await ankiCall<AnkiCardInfo[]>('cardsInfo', { cards: cardIds });
  return Array.isArray(result) ? result : [];
}

function withTimeout(ms: number) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(id) };
}

async function httpPost<B, R>(url: string, body: B, opts?: { timeoutMs?: number }): Promise<R> {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      throw new AnkiConnectError(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as R;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new AnkiConnectError('Request to AnkiConnect timed out', err);
    }
    if (err?.code === 'ECONNREFUSED' || err?.message?.includes('connect ECONNREFUSED')) {
      throw new AnkiConnectError('Cannot reach AnkiConnect (is Anki running and the add-on enabled?)', err);
    }
    throw new AnkiConnectError(err?.message || 'Unknown error talking to AnkiConnect', err);
  } finally {
    cancel();
  }
}

export async function ankiCall<T>(
  action: string,
  params?: Record<string, unknown>,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const body = {
    action, 
    version: ANKICONNECT_VERSION,
    params: params ?? {},
  };
  const resp = await httpPost<typeof body, AnkiResponse<T>>(ANKI_URL, body, {
    timeoutMs: opts?.timeoutMs ?? 8000,
  });
  if (resp.error) {
    throw new AnkiConnectError(`AnkiConnect error for "${action}": ${resp.error}`);
  }
  return resp.result as T;
}

export type DeckMap = Record<string, number>;

export async function getDeckNamesAndIds(): Promise<DeckMap> {
  return ankiCall<DeckMap>('deckNamesAndIds');
}

export async function createDeck(name: string): Promise<number> {
  const deckId = await ankiCall<number>('createDeck', { deck: name });
  if (typeof deckId !== 'number') {
    throw new AnkiConnectError(`Unexpected createDeck result for "${name}": ${deckId}`);
  }
  return deckId;
}

export type AddNoteArgs = {
  deckName?: string;
  modelName: 'Basic' | 'Cloze';
  fields: Record<string, string>;
  tags?: string[];
  allowDuplicate?: boolean;
  duplicateScope?: 'deck' | 'collection';
};

export async function addNote(args: AddNoteArgs): Promise<number> {
  const deckName = args.deckName?.trim() || 'Default';
  const tags = args.tags ?? [];

  const result = await ankiCall<number | null>('addNote', {
    note: {
      deckName,
      modelName: args.modelName,
      fields: args.fields,
      tags,
      options: {
        allowDuplicate: args.allowDuplicate ?? false,
        duplicateScope: args.duplicateScope ?? 'deck',
      },
    },
  });

  if (result == null) {
    throw new AnkiConnectError('addNote returned null (duplicate or invalid model/fields).');
  }
  return result;
}

export async function getCardsFromNotes(noteIds: number[]): Promise<number[]> {
  if (!Array.isArray(noteIds) || noteIds.length === 0) {
    return [];
  }
  const result = await ankiCall<number[]>('getCardsFromNotes', { notes: noteIds });
  if (!Array.isArray(result)) {
    return [];
  }
  return result;
}

export async function guiBrowse(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new AnkiConnectError('guiBrowse query must be a non-empty string');
  }
  await ankiCall<null>('guiBrowse', { query: trimmed });
}

export async function storeMediaFile(name: string, data: string): Promise<string> {
  // name: filename in Anki's media folder
  // data: base64-encoded file data
  const result = await ankiCall<string>('storeMediaFile', { filename: name, data });
  if (!result) {
    throw new AnkiConnectError(`storeMediaFile failed for ${name}`);
  }
  return result;
}