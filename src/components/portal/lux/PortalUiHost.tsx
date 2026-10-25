"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { usePortalUi } from "@/lib/portalUi";

const ICON = { success: Check, error: AlertTriangle, info: Info } as const;

/** Komunikaty (dół ekranu) i okno potwierdzenia panelu klienta. Montowane raz na stronie. */
export default function PortalUiHost() {
  const toasts = usePortalUi((s) => s.toasts);
  const dismiss = usePortalUi((s) => s.dismiss);
  const confirm = usePortalUi((s) => s.confirm);

  useEffect(() => {
    if (!confirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") confirm.resolve(false);
      if (e.key === "Enter") confirm.resolve(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="portal-lux">
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-[120] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICON[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[20px] bg-black px-4 py-3 text-[#F6F3EE] shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
                role={t.tone === "error" ? "alert" : "status"}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                    t.tone === "error" ? "bg-[#C2412D] text-white" : t.tone === "success" ? "bg-[#D8C3A0] text-black" : "bg-white/15 text-[#D8C3A0]"
                  }`}
                >
                  <Icon className="size-4" strokeWidth={2.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{t.title}</span>
                  {t.body ? <span className="mt-0.5 block text-[12.5px] leading-snug text-[#BDB6AA]">{t.body}</span> : null}
                </span>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Zamknij" className="mt-0.5 rounded-full p-1 text-[#8C877D] hover:text-white">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirm ? (
          <motion.div
            key="confirm"
            className="fixed inset-0 z-[130] flex items-end justify-center bg-black/55 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => confirm.resolve(false)}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-label={confirm.title}
              initial={{ y: 30, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="w-full max-w-[400px] rounded-[26px] bg-[var(--lux-bg)] p-6 text-[var(--lux-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="lux-serif text-[22px] font-medium leading-tight">{confirm.title}</h2>
              {confirm.body ? <p className="mt-2 text-[14px] leading-relaxed text-[var(--lux-ink-2)]">{confirm.body}</p> : null}
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => confirm.resolve(false)} className="lux-btn lux-btn--ghost">
                  {confirm.cancelLabel || "Anuluj"}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => confirm.resolve(true)}
                  className={`lux-btn ${confirm.destructive ? "bg-[var(--lux-danger)] text-white" : "lux-btn--ink"}`}
                >
                  {confirm.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
