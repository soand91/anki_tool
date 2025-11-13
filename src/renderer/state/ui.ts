import { create } from 'zustand';

type UiState = {
  // HealthModal
  isHealthModalOpen: boolean;
  healthModalDefaultLive: boolean;
  setHealthLivePref: (live: boolean) => void;
  openHealthModal: (opts?: { defaultLive?: boolean }) => void;
  closeHealthModal: () => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  isHealthModalOpen: false,
  healthModalDefaultLive: false,
  setHealthLivePref: (live: boolean) => set({ healthModalDefaultLive: live }),
  openHealthModal: (opts) => {
    const cur = get().healthModalDefaultLive;
    set({
      isHealthModalOpen: true,
      healthModalDefaultLive: opts?.defaultLive ?? cur
    });
  },
  closeHealthModal: () => set({ isHealthModalOpen: false })
}));