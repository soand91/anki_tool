export type TrayState = 
  | 'idle'            // nothing captured yet
  | 'frontOnly'       // front set, back empty
  | 'backOnly'        // back set, front empty
  | 'ready'           // both set (full)
  | 'awaitClipboard'  // user pressed A/S but clipboard is empty or waiting
  | 'frontSuccess'
  | 'backSuccess'
  | 'bothSuccess'
  | 'frontFailure'
  | 'backFailure'
  | 'bothFailure';

type ResultVariant = 'front' | 'back' | 'both';

export interface Context {
  hasFront: boolean;
  hasBack: boolean;
  clipboardReady: boolean;
  lastResult: { kind: 'success' | 'failure'; variant: ResultVariant } | null;
}

export type AppState = {
  ctx: Context;
  tray: TrayState;
};

export type Event = 
  | { type: 'CLIPBOARD_READY' }
  | { type: 'CLIPBOARD_CLEARED' }
  | { type: 'CAPTURE_FRONT' }
  | { type: 'CAPTURE_BACK' }
  | { type: 'CLEAR_FRONT' }
  | { type: 'CLEAR_BACK' }
  | { type: 'FINALIZE_CARD' }
  | { type: 'NOTE_SAVE_FAILED' }
  | { type: 'CLEAR_RESULT' }
  | { type: 'RESET' };

// guards (pure)
const isReady   = (c: Context) => c.hasFront && c.hasBack;
const onlyFront = (c: Context) => c.hasFront && !c.hasBack;
const onlyBack  = (c: Context) => !c.hasFront && c.hasBack;

// derive TrayState from context (single source of truth)
function deriveTray(c: Context): TrayState {
  if (c.lastResult) {
    const prefix = c.lastResult.variant === 'front' 
      ? 'front' 
      : c.lastResult.variant === 'back'
        ? 'back'
        : 'both';
    return `${prefix}${c.lastResult.kind[0].toUpperCase()}${c.lastResult.kind.slice(1)}` as TrayState;
  }
  if (!c.clipboardReady && !c.hasFront && !c.hasBack) return 'awaitClipboard';
  if (isReady(c)) return 'ready';
  if (onlyFront(c)) return 'frontOnly';
  if (onlyBack(c)) return 'backOnly';
  return 'idle';
}

function resolveVariant(c: Context): ResultVariant {
  if (c.hasFront && c.hasBack) return 'both';
  if (c.hasFront) return 'front';
  if (c.hasBack) return 'back';
  return 'front';
}

// initial state
export const initialState: AppState = {
  ctx: { hasFront: false, hasBack: false, clipboardReady: false, lastResult: null },
  tray: 'awaitClipboard',
};

// reducer (pure decision tree)
export function reducer(state: AppState, event: Event): AppState {
  const c = { ...state.ctx };
  switch (event.type) {
    case 'CLIPBOARD_READY':
      c.clipboardReady = true;
      break;
    case 'CLIPBOARD_CLEARED':
      c.clipboardReady = false;
      c.lastResult = null;
      // optional: also clear partial captures when clipboard empties (?)
      break;
    case 'CAPTURE_FRONT':
      c.hasFront = true;
      c.lastResult = null;
      break;
    case 'CAPTURE_BACK':
      c.hasBack = true;
      c.lastResult = null;
      break;
    case 'CLEAR_FRONT':
      c.hasFront = false;
      c.lastResult = null;
      break;
    case 'CLEAR_BACK':
      c.hasBack = false;
      c.lastResult = null;
      break;
    case 'FINALIZE_CARD':
      // after finalize, reset captures; clipboard may still be ready
      c.lastResult = { kind: 'success', variant: resolveVariant(c) };
      c.hasFront = false;
      c.hasBack = false;
      break;
    case 'NOTE_SAVE_FAILED':
      c.lastResult = { kind: 'failure', variant: resolveVariant(c) };
      break;
    case 'CLEAR_RESULT':
      c.lastResult = null;
      break;
    case 'RESET':
      c.lastResult = null;
      return initialState;
  }
  
  const next: AppState = { ctx: c, tray: deriveTray(c) };
  return next;
}
