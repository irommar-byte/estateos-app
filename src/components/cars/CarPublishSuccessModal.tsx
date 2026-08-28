"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Check, Pencil, Sparkles, X } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type CarPublishSuccessModalProps = {
  carId: number | null;
  open: boolean;
  onClose: () => void;
};

const BURST = Array.from({ length: 18 }, (_, i) => i);

export default function CarPublishSuccessModal({ carId, open, onClose }: CarPublishSuccessModalProps) {
  const { dict } = useLocale();
  const f = dict.cars.form;
  const c = dict.cars.common;

  if (!carId) return null;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="car-publish-success"
          className="fixed inset-0 eos-z-modal flex items-center justify-center overflow-hidden p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="car-publish-success-title"
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.35)_0%,rgba(2,8,23,0.92)_55%,rgba(2,8,23,0.97)_100%)] backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {/* Soft sky glow */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-[28%] size-[min(70vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/25 blur-3xl"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Burst rings / particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {BURST.map((i) => {
              const angle = (i / BURST.length) * Math.PI * 2;
              const dist = 110 + (i % 4) * 28;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-[32%] size-2 rounded-full bg-sky-300/90 shadow-[0_0_12px_rgba(56,189,248,0.9)]"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.2 }}
                  animate={{
                    x,
                    y,
                    opacity: [0, 1, 0],
                    scale: [0.2, 1.2, 0.4],
                  }}
                  transition={{ duration: 1.35, delay: 0.15 + i * 0.03, ease: "easeOut" }}
                />
              );
            })}
          </div>

          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-sky-400/30 bg-[var(--eos-card)]/95 p-7 text-center shadow-[0_30px_100px_rgba(14,165,233,0.35)] backdrop-blur-2xl sm:p-9"
            initial={{ opacity: 0, y: 36, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.08 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2 text-[var(--eos-muted)] transition hover:text-[var(--eos-text)]"
              aria-label="Zamknij"
            >
              <X size={16} />
            </button>

            <motion.div
              className="relative mx-auto mb-6 flex size-24 items-center justify-center"
              initial={{ scale: 0.3, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
            >
              <span className="absolute inset-0 rounded-full border border-sky-400/40 bg-sky-500/15 shadow-[0_0_50px_rgba(56,189,248,0.45)]" />
              <motion.span
                className="absolute inset-[-10px] rounded-full border border-sky-300/30"
                initial={{ scale: 0.7, opacity: 0.8 }}
                animate={{ scale: 1.35, opacity: 0 }}
                transition={{ duration: 1.2, repeat: 2, ease: "easeOut" }}
              />
              <Check className="relative size-11 text-sky-400" strokeWidth={2.75} />
              <Car className="absolute -bottom-1 -right-1 size-7 rounded-full border border-sky-400/40 bg-[var(--eos-card)] p-1 text-sky-500" />
            </motion.div>

            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-sky-500">
              <Sparkles size={12} />
              EstateOS™Car
            </p>
            <h2
              id="car-publish-success-title"
              className="mt-3 text-3xl font-black tracking-tight text-[var(--eos-text)] sm:text-4xl"
            >
              {f.successCongrats}
            </h2>
            <p className="mt-3 text-base font-semibold leading-snug text-sky-600 dark:text-sky-300">
              {f.successTitle}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">{f.successBody}</p>

            <div className="mt-8 grid gap-3">
              <Link
                href={`/cars/${carId}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-400/45 bg-gradient-to-b from-sky-400 to-sky-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_36px_rgba(14,165,233,0.35)] transition hover:brightness-105"
              >
                {c.viewListing}
              </Link>
              <Link
                href={`/cars/${carId}/edytuj`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--eos-text)] transition hover:border-sky-400/40 hover:text-sky-600 dark:hover:text-sky-300"
              >
                <Pencil size={14} />
                {c.edit}
              </Link>
              <Link
                href="/cars"
                className="pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--eos-muted)] transition hover:text-sky-500"
              >
                {f.successCtaCatalog}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
