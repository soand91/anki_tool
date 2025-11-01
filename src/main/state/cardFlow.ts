export type TrayState = 
  | 'idle'            // nothing captured yet
  | 'frontOnly'       // front set, back empty
  | 'backOnly'        // back set, front empty
  | 'ready'           // both set (full)
  | 'awaitClipboard'; // user pressed A/S but clipboard is empty or waiting right after Ctrl+C

export interface Context {
  hasFront: boolean;
  hasBack: boolean;
  clipboardReady: boolean;
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
  | { type: 'RESET' };

// guards (pure)
const isReady   = (c: Context) => c.hasFront && c.hasBack;
const onlyFront = (c: Context) => c.hasFront && !c.hasBack;
const onlyBack  = (c: Context) => !c.hasFront && c.hasBack;

// derive TrayState from context (single source of truth)
function deriveTray(c: Context): TrayState {
  if (!c.clipboardReady && !c.hasFront && !c.hasBack) return 'awaitClipboard';
  if (isReady(c)) return 'ready';
  if (onlyFront(c)) return 'frontOnly';
  if (onlyBack(c)) return 'backOnly';
  return 'idle';
}

// initial state
export const initialState: AppState = {
  ctx: { hasFront: false, hasBack: false, clipboardReady: false },
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
      // optional: also clear partial captures when clipboard empties (?)
      break;
    case 'CAPTURE_FRONT':
      c.hasFront = true;
      break;
    case 'CAPTURE_BACK':
      c.hasBack = true;
      break;
    case 'CLEAR_FRONT':
      c.hasFront = false;
      break;
    case 'CLEAR_BACK':
      c.hasBack = false;
      break;
    case 'FINALIZE_CARD':
      // after finalize, reset captures; clipboard may still be ready
      c.hasFront = false;
      c.hasBack = false;
      break;
    case 'RESET':
      return initialState;
  }
  
  const next: AppState = { ctx: c, tray: deriveTray(c) };
  return next;
}