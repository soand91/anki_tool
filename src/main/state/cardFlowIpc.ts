import { ipcMain } from 'electron';
import { syncDraftState, notifyCardSaveFailed } from './cardFlowController';

export function registerCardFlowIpc() {
  ipcMain.on('cardFlow:syncDraftState', (_evt, payload: { hasFront?: boolean; hasBack?: boolean }) => {
    if (!payload || typeof payload !== 'object') return;
    const hasFront = Boolean(payload.hasFront);
    const hasBack = Boolean(payload.hasBack);
    syncDraftState({ hasFront, hasBack });
  });
  ipcMain.on('cardFlow:noteFailed', () => {
    notifyCardSaveFailed();
  });
}
