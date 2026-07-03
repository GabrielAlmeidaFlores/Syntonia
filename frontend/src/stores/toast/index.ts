import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: number;
}

interface ToastState {
  readonly toasts: ToastMessage[];
  readonly addToast: (toast: Omit<ToastMessage, "id">) => void;
  readonly removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now().toString()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
