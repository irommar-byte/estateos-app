"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
  requireEmail?: boolean;
};

export default function PhoneVerificationGateModal({ open, onClose, requireEmail = false }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full rounded-[2.5rem] border border-white/10 bg-[#0a0a0a] p-8 md:p-10 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 text-white/40 hover:text-white"
              aria-label="Zamknij"
            >
              <X size={22} />
            </button>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck size={36} className="text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Weryfikacja wymagana</h3>
            <p className="text-sm text-white/55 leading-relaxed mb-8">
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
              className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white/35 hover:text-white/60"
            >
              Anuluj
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
