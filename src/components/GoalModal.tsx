'use client';

import { Key, Home, X } from 'lucide-react';
import EosModal from '@/components/ui/EosModal';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoalModal({ isOpen, onClose }: GoalModalProps) {
  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-2xl"
      hideHeader
      hideBodyPadding
    >
      <div className="relative overflow-hidden bg-[#0a0a0a] p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-20 rounded-full bg-white/5 p-3 text-white/50 transition-colors hover:bg-white/10"
        >
          <X size={20} />
        </button>
        <div className="pointer-events-none absolute right-0 top-0 z-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]" />

        <div className="relative z-10 mb-10 text-center">
          <h3 className="mb-4 text-4xl font-black tracking-tighter text-white md:text-5xl">
            Jaki jest Twój <span className="text-emerald-500">Cel</span>?
          </h3>
          <p className="text-sm text-white/50 md:text-base">
            Wybierz odpowiednią ścieżkę, abyśmy mogli dopasować narzędzia do Twoich potrzeb.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            onClick={() => (window.location.href = '/szukaj')}
            className="group flex cursor-pointer flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-[#111] p-8 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 transition-transform group-hover:scale-110">
              <Key size={36} />
            </div>
            <div>
              <div className="mb-2 text-2xl font-black text-white transition-colors group-hover:text-emerald-500">
                Chcę Kupić
              </div>
              <div className="text-xs leading-relaxed text-white/40">
                Przeglądaj ekskluzywne oferty i korzystaj z Radaru.
              </div>
            </div>
          </button>

          <button
            onClick={() => (window.location.href = '/dodaj-oferte')}
            className="group flex cursor-pointer flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-[#111] p-8 text-center transition-all hover:border-orange-500/50 hover:bg-orange-500/5 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 transition-transform group-hover:scale-110">
              <Home size={36} />
            </div>
            <div>
              <div className="mb-2 text-2xl font-black text-white transition-colors group-hover:text-orange-500">
                Chcę Sprzedać
              </div>
              <div className="text-xs leading-relaxed text-white/40">
                Dodaj swoją nieruchomość do bazy i znajdź kupca.
              </div>
            </div>
          </button>
        </div>
      </div>
    </EosModal>
  );
}
