import type { AddNoteEvent } from '../../shared/noteHud/types';

type Listener = (event: AddNoteEvent) => void;

const listeners = new Set<Listener>();

export function emitAddNoteEvent(event: AddNoteEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[noteHud] listener error', err);
    }
  }
}

export function onAddNoteEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
