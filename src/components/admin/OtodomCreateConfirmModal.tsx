"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  title: string;
  imageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
};

export default function OtodomCreateConfirmModal({
  open,
  title,
  imageCount,
  onCancel,
  onConfirm,
  confirming = false,
}: Props) {
  const checkboxId = useId();
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setRightsConfirmed(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
          onClick={onCancel}
        >
          <div className="eos-modal-backdrop absolute inset-0" />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="otodom-create-modal-title"
            className="eos-modal-surface relative w-full max-w-md overflow-hidden rounded-[28px] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />

            <div className="relative px-6 pt-6 pb-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.18)]">
                <ShieldCheck size={28} strokeWidth={2.2} />
              </div>
              <h2 id="otodom-create-modal-title" className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">
                Utworzyć ofertę na koncie administratora?
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--eos-muted)]">
                Oferta trafi do statusu <span className="font-semibold text-[var(--eos-text)]">PENDING</span> i wymaga aktywacji w
                Centrali → Baza Ofert.
              </p>
            </div>

            <div className="relative mx-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--eos-subtle)] mb-2">Podsumowanie</p>
              <p className="text-sm font-medium text-[var(--eos-text)] leading-snug">{title}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1 text-[var(--eos-muted)]">
                  do {Math.min(imageCount, 20)} zdjęć
                </span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  przepisany opis EstateOS
                </span>
              </div>
            </div>

            <label
              htmlFor={checkboxId}
              className="relative mx-6 mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4 transition-colors hover:bg-[var(--eos-surface)]"
            >
              <input
                id={checkboxId}
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
                className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[5px] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] accent-emerald-500"
              />
              <span className="text-[13px] leading-relaxed text-[var(--eos-muted)]">
                Oświadczam, że posiadam prawa niezbędne do publikacji tych danych i materiałów na platformie EstateOS.
              </span>
            </label>

            <div className="relative mt-5 grid grid-cols-2 gap-px border-t border-[var(--eos-border)] bg-[var(--eos-border)]">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirming}
                className="bg-[var(--eos-card)] px-4 py-4 text-[15px] font-medium text-blue-500 transition-colors hover:bg-[var(--eos-input)] disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={!rightsConfirmed || confirming}
                className="bg-[var(--eos-card)] px-4 py-4 text-[15px] font-semibold text-emerald-500 transition-colors hover:bg-[var(--eos-input)] disabled:cursor-not-allowed disabled:text-[var(--eos-subtle)]"
              >
                {confirming ? "Tworzenie…" : "Utwórz ofertę"}
              </button>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="absolute right-4 top-4 rounded-full p-2 text-[var(--eos-subtle)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
