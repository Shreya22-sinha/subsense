/** Transient UI state (not persisted): toasts. */
import { create } from 'zustand';
import { newId } from '@/lib/id';

export interface Toast {
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss after this many ms. */
  durationMs: number;
}

interface UiState {
  toasts: Toast[];
  showToast: (message: string, opts?: { action?: Toast['action']; durationMs?: number }) => string;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  showToast: (message, opts) => {
    const id = newId();
    const toast: Toast = {
      id,
      message,
      action: opts?.action,
      durationMs: opts?.durationMs ?? 4000,
    };
    // Keep at most 3 on screen.
    set({ toasts: [...get().toasts.slice(-2), toast] });
    return id;
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Callable from outside React (store actions). */
export const showToast: UiState['showToast'] = (message, opts) =>
  useUiStore.getState().showToast(message, opts);
