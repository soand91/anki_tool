import { isAddNoteSoundEnabled } from '../state/soundSettings';
import successUrl from '../sfx/add-note-success.wav';
import failureUrl from '../sfx/add-note-failure.wav';


type SoundKind = 'success' | 'failure';

const SOUND_URLS: Record<SoundKind, string> = {
  success: successUrl,
  failure: failureUrl,
};

const audioCache: Partial<Record<SoundKind, HTMLAudioElement | null>> = {};

function loadAudio(kind: SoundKind): HTMLAudioElement | null {
  const url = SOUND_URLS[kind];
  if (!url) return null;
  const audio = new Audio(url);
  audio.preload = 'auto';

  if (kind === 'success') audio.volume = 0.1;
  if (kind === 'failure') audio.volume = 0.9;
  audioCache[kind] = audio;
  return audio;
}

export async function playAddNoteSound(kind: SoundKind) {
  if (!isAddNoteSoundEnabled()) return;
  let audio = audioCache[kind] ?? null;
  if (!audio) {
    audio = loadAudio(kind);
  }
  if (!audio) return;
  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (err) {
    console.warn('[sound] failed to play', kind, err);
  }
}
