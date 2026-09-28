import { create } from "zustand";

export type ToastVariant = "success" | "danger" | "warning" | "info";

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  text: string;
}

interface ToastState {
  toasts: ToastMessage[];
  push: (variant: ToastVariant, text: string) => void;
  dismiss: (id: string) => void;
}

// A single global toast queue, so any part of the app (job completion, errors,
// confirmations) can surface a message without prop-drilling — Toasts renders it.
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, text) =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), variant, text }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
