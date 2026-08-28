"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";
import EosModal from "@/components/ui/EosModal";

type NoCreditsModalProps = {
  open: boolean;
  onClose: () => void;
  topUpHref?: string;
  title?: string;
  body?: string;
};

export default function NoCreditsModal({
  open,
  onClose,
  topUpHref = "/cennik",
  title = "Brak kredytów na koncie",
  body = "Na Twoim koncie nie ma aktywnych kredytów publikacji. Doładuj pakiet, aby wyróżnić lub opublikować ogłoszenie.",
}: NoCreditsModalProps) {
  return (
    <EosModal
      open={open}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-md"
      hideHeader
      hideBodyPadding
      ariaLabelledBy="no-credits-title"
    >
      <div className="relative w-full overflow-hidden p-7 sm:p-8">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-amber-400/35 bg-amber-500/15 shadow-[0_0_36px_rgba(245,158,11,0.28)]">
          <CreditCard className="size-7 text-amber-500" />
        </div>

        <h2
          id="no-credits-title"
          className="text-center text-2xl font-black tracking-tight text-[var(--eos-text)]"
        >
          {title}
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-[var(--eos-muted)]">{body}</p>

        <div className="mt-8 grid gap-3">
          <Link
            href={topUpHref}
            className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/40 bg-gradient-to-b from-emerald-400 to-emerald-600 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_36px_rgba(16,185,129,0.32)] transition hover:brightness-105"
            onClick={onClose}
          >
            Doładuj
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--eos-text)] shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:border-[var(--eos-muted)]"
          >
            Anuluj
          </button>
        </div>
      </div>
    </EosModal>
  );
}
