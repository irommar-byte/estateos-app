"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string;
}

export default function BaseModal({ isOpen, onClose, children, title, maxWidth = "max-w-2xl" }: BaseModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Zamknij okno"
        className="eos-modal-backdrop absolute inset-0 cursor-default border-0 p-0"
        onClick={onClose}
      />
      <div
        className={`eos-modal-surface eos-modal-shell eos-themed-modal relative z-10 my-auto flex w-full ${maxWidth} max-h-[90vh] flex-col overflow-hidden rounded-2xl pointer-events-auto`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 sm:p-6">
          {title ? (
            <h3 className="text-xl font-semibold text-[var(--eos-text)]">{title}</h3>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)] focus:outline-none"
            aria-label="Zamknij"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6 text-[var(--eos-text)]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
