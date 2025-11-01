import { EventEmitter } from 'events';

export interface Store<S, E> {
  getState(): S;
  dispatch(event: E): void;
  subscribe(cb: (s: S) => void): () => void;
}

export function createStore<S, E>(
  initial: S,
  reducer: (state: S, event: E) => S
): Store<S, E> {
  let state = initial;
  const bus = new EventEmitter();

  return {
    getState: () => state,
    dispatch: (evt: E) => {
      const next = reducer(state, evt);
      if (next !== state) {
        state = next;
        bus.emit('change', state);
      }
    },
    subscribe: (cb) => {
      bus.on('change', cb);
      return () =>  bus.off('change', cb);
    },
  };
}