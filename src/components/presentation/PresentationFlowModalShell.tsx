"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { pushModalStack } from "@/hooks/useModalStack";

type PresentationFlowModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer (CTA) — always visible without scrolling the body. */
  footer?: ReactNode;
  maxWidth?: string;
  dismissLabel?: string;
};

/**
 * Presentation outcome/review shell.
 * Important: scroll child needs `min-h-0` or flex refuses to shrink and overflow-y never scrolls.
 */
export default function PresentationFlowModalShell({
  open,
  onClose,
  children,
  footer,
  maxWidth = "max-w-lg",
  dismissLabel = "Zamknij",
}: PresentationFlowModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const pop = pushModalStack();
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      pop();
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="presentation-flow-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 eos-z-modal flex items-end justify-center sm:items-center sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={dismissLabel}
          className="absolute inset-0 cursor-default border-0 bg-black/55 p-0 backdrop-blur-sm dark:bg-black/65"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: 28, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          role="dialog"
          aria-modal="true"
          className={`theme-aware-dashboard pointer-events-auto relative z-10 flex max-h-[min(88dvh,720px)] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)] shadow-[var(--eos-shadow-strong)] sm:rounded-[1.75rem] ${maxWidth}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex size-8 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
            aria-label={dismissLabel}
          >
            <X size={16} />
          </button>

          {/* min-h-0 is required for overflow scroll inside a flex column */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

          {footer ? (
            <div className="shrink-0 border-t border-[var(--eos-border)] bg-[var(--eos-surface)]/95 px-4 py-3 backdrop-blur-md sm:px-5">
              {footer}
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
