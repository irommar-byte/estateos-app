"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import EosModal from "@/components/ui/EosModal";

type Props = {
  open: boolean;
  title: string;
  imageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  confirming?: boolean;
  variant?: "admin" | "pro";
};

export default function OtodomCreateConfirmModal({
  open,
  title,
  imageCount,
  onCancel,
  onConfirm,
  confirming = false,
  variant = "admin",
}: Props) {
  const checkboxId = useId();
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  useEffect(() => {
    if (!open) {
      setRightsConfirmed(false);
    }
  }, [open]);

  return (
    <EosModal
      open={open}
      onClose={onCancel}
      maxWidth="max-w-md"
      hideHeader
      showCloseButton={false}
      closeOnBackdrop={!confirming}
      footer={
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-border)]">
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
            className="bg-[var(--eos-card)] px-4 py-4 text-[15px] font-semibold text-emerald-600 transition-colors hover:bg-[var(--eos-input)] disabled:cursor-not-allowed disabled:text-[var(--eos-subtle)] dark:text-emerald-500"
          >
            {confirming ? "Tworzenie…" : "Utwórz ofertę"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 pb-2 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-500 shadow-[0_12px_32px_rgba(16,185,129,0.15)]">
          <ShieldCheck size={28} strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--eos-text)]">
            {variant === "pro" ? "Potwierdzić import na EstateOS?" : "Utworzyć ofertę na koncie administratora?"}
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--eos-muted)]">
            {variant === "pro" ? (
              <>
                Publikacja jest już <span className="font-semibold text-[var(--eos-text)]">opłacona</span>. Oferta trafi do
                weryfikacji, a po akceptacji od razu na aktywny rynek.
              </>
            ) : (
              <>
                Publikacja jest już <span className="font-semibold text-[var(--eos-text)]">opłacona</span>. Oferta trafi do
                weryfikacji — po akceptacji w Centrali aktywuje się automatycznie.
              </>
            )}
          </p>
        </div>

        <div className="eos-modal-panel px-4 py-4 text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--eos-subtle)] mb-2">Podsumowanie</p>
          <p className="text-sm font-medium text-[var(--eos-text)] leading-snug">{title}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-1 text-[var(--eos-muted)]">
              do {Math.min(imageCount, 20)} zdjęć
            </span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-300">
              przepisany opis EstateOS
            </span>
          </div>
        </div>

        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-4 text-left transition-colors hover:bg-[var(--eos-surface)]"
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
      </div>
    </EosModal>
  );
}
