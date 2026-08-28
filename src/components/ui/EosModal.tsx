"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { modalZIndexClass, useModalStack } from "@/hooks/useModalStack";

export type EosModalVariant = "sheet" | "centered" | "fullscreen";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
  maxWidth?: string;
  variant?: EosModalVariant;
  zIndexClass?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode;
  /** Nagłówek wbudowany — wyłącz gdy przekazujesz własny w children */
  hideHeader?: boolean;
  hideBodyPadding?: boolean;
  ariaLabelledBy?: string;
  iconWrapClassName?: string;
  className?: string;
  bodyClassName?: string;
};

const VARIANT_SHELL: Record<EosModalVariant, string> = {
  sheet: "items-end justify-center sm:items-center sm:p-6",
  centered: "items-center justify-center p-4 sm:p-6",
  fullscreen: "items-stretch justify-stretch p-0",
};

const VARIANT_SURFACE: Record<EosModalVariant, string> = {
  sheet:
    "max-h-[min(92dvh,920px)] rounded-t-[28px] sm:rounded-[28px]",
  centered: "max-h-[min(92dvh,920px)] rounded-[28px]",
  fullscreen: "h-[100dvh] max-h-[100dvh] rounded-none",
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
  variant = "sheet",
  zIndexClass,
  closeOnBackdrop = true,
  showCloseButton = true,
  footer,
  hideHeader = false,
  hideBodyPadding = false,
  ariaLabelledBy,
  iconWrapClassName = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.12)]",
  className = "",
  bodyClassName = "",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const stackDepth = useModalStack(open);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  const resolvedZ = zIndexClass ?? modalZIndexClass(stackDepth > 0 ? 1 : 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!mounted) return null;

  const titleId = ariaLabelledBy || (title ? "eos-modal-title" : undefined);
  const isFullscreen = variant === "fullscreen";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 ${resolvedZ} flex ${VARIANT_SHELL[variant]} ${className}`}
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
            ref={dialogRef}
            initial={isFullscreen ? { opacity: 0 } : { y: 28, opacity: 0, scale: 0.97 }}
            animate={isFullscreen ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={isFullscreen ? { opacity: 0 } : { y: 20, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`eos-modal-surface eos-modal-shell eos-themed-modal pointer-events-auto relative z-10 flex w-full flex-col overflow-hidden ${VARIANT_SURFACE[variant]} ${isFullscreen ? "" : maxWidth}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {!isFullscreen ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--eos-accent)]/[0.06] to-transparent" />
            ) : null}

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

            <div
              className={`custom-scrollbar relative flex-1 overflow-y-auto text-[var(--eos-text)] ${hideBodyPadding ? "" : "px-6 py-5"} ${bodyClassName}`}
            >
              {children}
            </div>

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
