import { appStore } from './appStore';
import type { Event } from './cardFlow';

type CaptureSide = 'front' | 'back';

let captureStack: CaptureSide[] = [];
let resultClearTimer: NodeJS.Timeout | null = null;

function dispatch(event: Event) {
  appStore.dispatch(event);
}

function scheduleResultClear() {
  if (resultClearTimer) clearTimeout(resultClearTimer);
  resultClearTimer = setTimeout(() => {
    resultClearTimer = null;
    dispatch({ type: 'CLEAR_RESULT' });
  }, 3500);
}

export function markClipboardReady() {
  dispatch({ type: 'CLIPBOARD_READY' });
}

export function markClipboardCleared() {
  dispatch({ type: 'CLIPBOARD_CLEARED' });
}

export function recordCapture(side: CaptureSide) {
  captureStack.push(side);
  if (side === 'front') {
    dispatch({ type: 'CAPTURE_FRONT' });
  } else {
    dispatch({ type: 'CAPTURE_BACK' });
  }
}

export function undoLastCapture() {
  const last = captureStack.pop();
  if (!last) return;
  if (last === 'front') {
    dispatch({ type: 'CLEAR_FRONT' });
  } else {
    dispatch({ type: 'CLEAR_BACK' });
  }
}

export function finalizeCaptureFlow() {
  captureStack = [];
  dispatch({ type: 'FINALIZE_CARD' });
  scheduleResultClear();
}

export function resetCaptureFlow() {
  captureStack = [];
  dispatch({ type: 'RESET' });
}

export function syncDraftState(next: { hasFront: boolean; hasBack: boolean }) {
  let state = appStore.getState();
  if (next.hasFront !== state.ctx.hasFront) {
    dispatch({ type: next.hasFront ? 'CAPTURE_FRONT' : 'CLEAR_FRONT' });
    state = appStore.getState();
  }
  if (next.hasBack !== state.ctx.hasBack) {
    dispatch({ type: next.hasBack ? 'CAPTURE_BACK' : 'CLEAR_BACK' });
  }
}

export function notifyCardSaveFailed() {
  dispatch({ type: 'NOTE_SAVE_FAILED' });
  scheduleResultClear();
}
