"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
  maxWidth?: string;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode;
  /** Nagłówek wbudowany — wyłącz gdy przekazujesz własny w children */
  hideHeader?: boolean;
  ariaLabelledBy?: string;
  iconWrapClassName?: string;
};

export default function EosModal({
  open,
  onClose,
  children,
  title,
  subtitle,
  badge,
  icon,
  maxWidth = "max-w-3xl",
  zIndexClass = "z-[999999]",
  closeOnBackdrop = true,
  showCloseButton = true,
  footer,
  hideHeader = false,
  ariaLabelledBy,
  iconWrapClassName = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const titleId = ariaLabelledBy || (title ? "eos-modal-title" : undefined);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 ${zIndexClass} flex items-end justify-center sm:items-center sm:p-6`}
          role="presentation"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Zamknij okno"
            className="eos-modal-backdrop absolute inset-0 cursor-default border-0 p-0"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          <motion.div
            initial={{ y: 28, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`eos-modal-surface eos-modal-shell eos-themed-modal pointer-events-auto relative z-10 flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] ${maxWidth}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--eos-accent)]/[0.06] to-transparent" />

            {!hideHeader && (title || showCloseButton) ? (
              <div className="relative flex shrink-0 items-start justify-between gap-4 border-b border-[var(--eos-border)] px-6 py-5">
                <div className="flex min-w-0 items-start gap-3">
                  {icon ? <div className={iconWrapClassName}>{icon}</div> : null}
                  <div className="min-w-0">
                    {badge ? (
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D4AF37]">{badge}</p>
                    ) : null}
                    {title ? (
                      <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)] sm:text-lg">
                        {title}
                      </h2>
                    ) : null}
                    {subtitle ? (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--eos-muted)] sm:text-[13px]">{subtitle}</p>
                    ) : null}
                  </div>
                </div>
                {showCloseButton ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-full p-2 text-[var(--eos-subtle)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)]"
                    aria-label="Zamknij"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="custom-scrollbar relative flex-1 overflow-y-auto px-6 py-5 text-[var(--eos-text)]">{children}</div>

            {footer ? (
              <div className="relative shrink-0 border-t border-[var(--eos-border)] bg-[var(--eos-surface)] px-6 py-4">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
