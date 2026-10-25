import { create } from "zustand";

/** Komunikaty i potwierdzenia panelu klienta — zamiast systemowych alert() / confirm(). */

export type PortalToastTone = "success" | "error" | "info";
export type PortalToast = { id: number; tone: PortalToastTone; title: string; body?: string };
export type PortalConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
};

type State = {
  toasts: PortalToast[];
  confirm: PortalConfirmRequest | null;
  push: (t: Omit<PortalToast, "id">) => void;
  dismiss: (id: number) => void;
  setConfirm: (c: PortalConfirmRequest | null) => void;
};

let seq = 0;

export const usePortalUi = create<State>((set, get) => ({
  toasts: [],
  confirm: null,
  push: (t) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    window.setTimeout(() => get().dismiss(id), t.tone === "error" ? 6500 : 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setConfirm: (c) => set({ confirm: c }),
}));

export const portalToast = {
  success: (title: string, body?: string) => usePortalUi.getState().push({ tone: "success", title, body }),
  info: (title: string, body?: string) => usePortalUi.getState().push({ tone: "info", title, body }),
  /** Błąd zawsze z przyczyną — przekaż komunikat z serwera albo wyjątku. */
  error: (title: string, cause?: unknown) =>
    usePortalUi.getState().push({
      tone: "error",
      title,
      body:
        cause instanceof Error
          ? cause.message
          : typeof cause === "string" && cause
            ? cause
            : "Sprawdź połączenie z internetem i spróbuj ponownie.",
    }),
};

export function portalConfirm(opts: Omit<PortalConfirmRequest, "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    usePortalUi.getState().setConfirm({
      ...opts,
      resolve: (ok) => {
        usePortalUi.getState().setConfirm(null);
        resolve(ok);
      },
    });
  });
}
