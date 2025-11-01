import { create } from 'zustand';

type AppState = { 
  healthy: boolean;
  setHealthy: (v: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  healthy: false,
  setHealthy: (v) => set({ healthy: v }),
}));