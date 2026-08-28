"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import EosModal from "@/components/ui/EosModal";

type Props = {
  open: boolean;
  onClose: () => void;
  requireEmail?: boolean;
};

export default function PhoneVerificationGateModal({ open, onClose, requireEmail = false }: Props) {
  return (
    <EosModal
      open={open}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-md"
      hideHeader
      hideBodyPadding
      zIndexClass="eos-z-modal-nested"
    >
      <div className="p-8 md:p-10 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <ShieldCheck size={36} className="text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-[var(--eos-text)] mb-3 tracking-tight">Weryfikacja wymagana</h3>
        <p className="text-sm text-[var(--eos-muted)] leading-relaxed mb-8">
          {requireEmail
            ? "Aby opublikować ogłoszenie, potwierdź numer telefonu (SMS) i adres e-mail — tak jak w aplikacji EstateOS."
            : "Aby negocjować lub umówić wizytę, potwierdź numer telefonu kodem SMS — tak jak w aplikacji EstateOS."}
        </p>
        <Link
          href="/moje-konto/weryfikacja"
          className="block w-full py-4 rounded-2xl bg-emerald-500 text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-emerald-400 transition-colors"
        >
          Przejdź do weryfikacji
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)] hover:text-[var(--eos-muted)]"
        >
          Anuluj
        </button>
      </div>
    </EosModal>
  );
}
