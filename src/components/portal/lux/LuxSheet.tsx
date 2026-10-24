"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** Arkusz od dołu (telefon) / okno (komputer) w stylu panelu. */
export default function LuxSheet({
  open,
  onClose,
  title,
  kicker,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="lux-sheet-backdrop portal-lux" onClick={onClose} role="presentation">
      <div
        className="lux-sheet"
        style={wide ? { maxWidth: 860 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#F6F3EE]/95 px-5 pb-3 pt-5 backdrop-blur">
            <div className="min-w-0">
              {kicker ? <p className="lux-kicker">{kicker}</p> : null}
              <h2 className="lux-serif mt-1 text-[24px] font-medium leading-tight">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij"
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E6E0D6] bg-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className={title ? "px-5 pb-8" : ""}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
