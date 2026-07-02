"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type PresentationFlowModalShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  dismissLabel?: string;
};

export default function PresentationFlowModalShell({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  dismissLabel = "Zamknij",
}: PresentationFlowModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
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
        className="fixed inset-0 z-[999999] flex items-end justify-center sm:items-center sm:p-6"
        role="presentation"
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={dismissLabel}
          className="absolute inset-0 cursor-default border-0 bg-black/60 p-0 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ y: 28, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          role="dialog"
          aria-modal="true"
          className={`theme-aware-dashboard pointer-events-auto relative z-10 flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-[2rem] border border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] shadow-2xl text-[var(--eos-text)] sm:rounded-[2rem] ${maxWidth}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)] text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
            aria-label={dismissLabel}
          >
            <X size={18} />
          </button>

          <div className="custom-scrollbar flex-1 overflow-y-auto">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
