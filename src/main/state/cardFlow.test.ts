import { reducer, initialState } from './cardFlow';
import type { Event } from './cardFlow';

function run(...events: Event[]) {
  return events.reduce((s, e) => reducer(s, e), initialState);
}
describe('cardFlow reducer', () => {
  test('initial -> awaitClipboard', () => {
    expect(initialState.tray).toBe('awaitClipboard');
  });
  test('clipboard becomes ready with no captures -> idle or awaitClipboard?', () => {
    // Depends on your deriveTray semantics; adjust as needed.
    const s = run({ type: 'CLIPBOARD_READY' });
    // If your deriveTray returns 'idle' once clipboard is ready and no captures:
    // expect(s.tray).toBe('idle');
    // If you want to stay in awaitClipboard until a capture happens, use:
    // expect(s.tray).toBe('awaitClipboard');
    expect(['idle','awaitClipboard']).toContain(s.tray);
  });
  test('front then back -> ready', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
    );
    expect(s.tray).toBe('ready');
  });
  test('only front -> frontOnly; only back -> backOnly', () => {
    const sFront = run({ type: 'CLIPBOARD_READY' }, { type: 'CAPTURE_FRONT' });
    expect(sFront.tray).toBe('frontOnly');

    const sBack = run({ type: 'CLIPBOARD_READY' }, { type: 'CAPTURE_BACK' });
    expect(sBack.tray).toBe('backOnly');
  });
  test('finalize resets captures but may keep clipboard state', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
      { type: 'FINALIZE_CARD' },
    );
    // After finalize, tray shows success indicator
    expect(s.tray).toBe('bothSuccess');
  });
  test('reset returns to initial', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'RESET' },
    );
    expect(s.tray).toBe('awaitClipboard');
  });
  test('finalize sets success tray', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
      { type: 'FINALIZE_CARD' },
    );
    expect(s.tray).toBe('bothSuccess');
  });
  test('note save failure shows failure tray', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
      { type: 'NOTE_SAVE_FAILED' },
    );
    expect(s.tray).toBe('bothFailure');
  });
  test('failure respects variant when only front captured', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'NOTE_SAVE_FAILED' },
    );
    expect(s.tray).toBe('frontFailure');
  });
  test('failure respects variant when only back captured', () => {
    const s = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_BACK' },
      { type: 'NOTE_SAVE_FAILED' },
    );
    expect(s.tray).toBe('backFailure');
  });
  test('clearing result after success returns to idle', () => {
    const success = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
      { type: 'FINALIZE_CARD' },
    );
    const cleared = reducer(success, { type: 'CLEAR_RESULT' });
    expect(cleared.tray).toBe('idle');
  });
  test('clearing result after failure returns to frontOnly/backOnly', () => {
    const failure = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'NOTE_SAVE_FAILED' },
    );
    const cleared = reducer(failure, { type: 'CLEAR_RESULT' });
    expect(cleared.tray).toBe('frontOnly');
  });
  test('clearing front/back updates projection correctly', () => {
    const s1 = run(
      { type: 'CLIPBOARD_READY' },
      { type: 'CAPTURE_FRONT' },
      { type: 'CAPTURE_BACK' },
    );
    expect(s1.tray).toBe('ready');

    const s2 = reducer(s1, { type: 'CLEAR_BACK' });
    expect(s2.tray).toBe('frontOnly');

    const s3 = reducer(s2, { type: 'CLEAR_FRONT' });
    // With clipboardReady still true and no captures, expect 'idle'
    expect(s3.tray).toBe('idle');
  });
});
