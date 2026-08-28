'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, BrainCircuit, CheckCircle2, HeartHandshake, Radar, X } from 'lucide-react';
import { buyerOnboardingStorageKey } from '@/lib/clientPortalPath';

type Props = {
  token: string;
  agentName: string;
  hasPendingOffer: boolean;
  welcomeEmailSent: boolean;
  onDismiss: () => void;
  onShowOffers: () => void;
};

export default function ClientPortalBuyerOnboarding({
  token,
  agentName,
  hasPendingOffer,
  welcomeEmailSent,
  onDismiss,
  onShowOffers,
}: Props) {
  const [visible, setVisible] = useState(false);
  const storageKey = buyerOnboardingStorageKey(token);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(storageKey) === '1') return;
    } catch {
      /* pokaż */
    }
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
    onDismiss();
  };

  const showOffers = () => {
    dismiss();
    onShowOffers();
  };

  const agentFirst = agentName.split(/\s+/)[0] || agentName;

  return (
    <section className="relative overflow-hidden rounded-[1.5rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-[var(--eos-card)] to-sky-500/8 p-5 shadow-[0_16px_40px_rgba(16,185,129,0.1)] sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
        aria-label="Zamknij instrukcję"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
          <BrainCircuit className="size-5" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Twój panel wyszukiwania</p>
          <h2 className="mt-1 text-lg font-black leading-snug text-[var(--eos-text)]">Jak to działa — w 30 sekund</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--eos-muted)]">
            {hasPendingOffer
              ? 'EstateOS Intelligence właśnie wysłało pierwszą propozycję. Od Twojej reakcji zależy, co dostaniesz dalej.'
              : 'System już przeszukuje rynek pod Twoje kryteria. Pierwsza propozycja pojawi się tutaj — warto wracać.'}
            {welcomeEmailSent ? (
              <>
                {' '}
                Link do panelu wysłaliśmy też na Twój e-mail — możesz wrócić stąd kiedy chcesz.
              </>
            ) : null}
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-2.5">
        <li className="flex gap-3 rounded-xl bg-[var(--eos-input)]/60 px-3 py-2.5">
          <Radar className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <div className="text-[12px] leading-snug text-[var(--eos-text)]">
            <span className="font-bold">Wracaj na ten panel</span> — tu lądują propozycje. Baner powyżej pozwala dodać ikonę lub zakładkę.
          </div>
        </li>
        <li className="flex gap-3 rounded-xl bg-[var(--eos-input)]/60 px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <div className="text-[12px] leading-snug text-[var(--eos-text)]">
            <span className="font-bold">Sprawdź ofertę</span> — rozwiń kartę, zobacz zdjęcia i opis. Intelligence dobiera kolejne dopasowania w tle.
          </div>
        </li>
        <li className="flex gap-3 rounded-xl bg-[var(--eos-input)]/60 px-3 py-2.5">
          <HeartHandshake className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <div className="text-[12px] leading-snug text-[var(--eos-text)]">
            <span className="font-bold">Zareaguj</span> —{' '}
            <span className="font-semibold text-emerald-700">Chcę oglądać</span>,{' '}
            <span className="font-semibold text-amber-700">Do przemyślenia</span> albo{' '}
            <span className="font-semibold text-rose-700">Nie pasuje</span>. System uczy się z każdej odpowiedzi.
          </div>
        </li>
        <li className="flex gap-3 rounded-xl bg-[var(--eos-input)]/60 px-3 py-2.5">
          <span className="mt-0.5 text-sm leading-none">🧑‍💼</span>
          <div className="text-[12px] leading-snug text-[var(--eos-text)]">
            <span className="font-bold">{agentFirst} nadzoruje proces</span> — widzi reakcje, umawia oglądania i prowadzi do finalizacji. Możesz też napisać na czacie.
          </div>
        </li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={showOffers} className="eos-btn eos-btn--primary eos-btn--sm inline-flex items-center gap-2">
          {hasPendingOffer ? 'Pokaż pierwszą propozycję' : 'Rozumiem'}
          <ArrowDown className="size-4" />
        </button>
        <button type="button" onClick={dismiss} className="eos-btn eos-btn--secondary eos-btn--sm">
          Zamknij
        </button>
      </div>
    </section>
  );
}
