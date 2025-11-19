import { create } from 'zustand';

type SoundSettingsState = {
  addNoteSounds: boolean;
  hydrated: boolean;
  setAddNoteSounds: (enabled: boolean) => void;
};

export const useSoundSettingsStore = create<SoundSettingsState>((set) => ({
  addNoteSounds: true,
  hydrated: false,
  setAddNoteSounds: (enabled: boolean) => {
    set({ addNoteSounds: enabled });
    try {
      window.api?.settings?.prefs?.set('addNoteSoundEnabled', enabled).catch(() => {});
    } catch {
      // ignore
    }
  },
}));

export function hydrateSoundSettings() {
  if (typeof window === 'undefined') return;
  const state = useSoundSettingsStore.getState();
  if (state.hydrated) return;
  window.api?.settings?.prefs?.get('addNoteSoundEnabled')
    .then((value) => {
      useSoundSettingsStore.setState({ addNoteSounds: Boolean(value), hydrated: true });
    })
    .catch(() => {
      useSoundSettingsStore.setState({ addNoteSounds: true, hydrated: true });
    });
}

if (typeof window !== 'undefined') {
  hydrateSoundSettings();
}

export function isAddNoteSoundEnabled() {
  return useSoundSettingsStore.getState().addNoteSounds;
}

export function setAddNoteSoundEnabled(enabled: boolean) {
  useSoundSettingsStore.getState().setAddNoteSounds(enabled);
}
