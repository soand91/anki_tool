import { create } from 'zustand';

export type ToastKind = 'success' | 'error';

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  autoCloseMs?: number;
  onClick?: () => void;
};

type ToastState = {
  toasts: Toast[];
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, toast],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearAll: () => set(() => ({ toasts: [] })),
}));

let counter = 0;

type ShowToastOptions = {
  kind: ToastKind;
  title?: string;
  message: string;
  autoCloseMs?: number;
  onClick?: () => void;
};

function showToast(opts: ShowToastOptions) {
  const id = `${Date.now()}-${counter++}`;
  useToastStore
    .getState()
    .addToast({
      id,
      kind: opts.kind,
      title: opts.title,
      message: opts.message,
      autoCloseMs: opts.autoCloseMs,
      onClick: opts.onClick,
    });
  return id;
}

export const toast = {
  success(opts: Omit<ShowToastOptions, 'kind'>) {
    return showToast({ kind: 'success', autoCloseMs: 3500, ...opts });
  },
  error(opts: Omit<ShowToastOptions, 'kind'>) {
    return showToast({ kind: 'error', autoCloseMs: opts.autoCloseMs, ...opts });
  },
  dismiss(id: string) {
    useToastStore.getState().removeToast(id);
  },
  clearAll() {
    useToastStore.getState().clearAll();
  },
};
