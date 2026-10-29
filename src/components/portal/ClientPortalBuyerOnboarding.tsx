'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, HeartHandshake, MessageCircle, Sparkles, X } from 'lucide-react';
import { usePortalLocale } from '@/components/portal/PortalLocale';
import { buyerOnboardingStorageKey } from '@/lib/clientPortalPath';

type Props = {
  token: string;
  agentName: string;
  hasPendingOffer: boolean;
  welcomeEmailSent: boolean;
  intelligenceEnabled?: boolean;
  onDismiss: () => void;
  onShowOffers: () => void;
};

export default function ClientPortalBuyerOnboarding({
  token,
  agentName,
  hasPendingOffer,
  welcomeEmailSent,
  intelligenceEnabled = false,
  onDismiss,
  onShowOffers,
}: Props) {
  const { t } = usePortalLocale();
  const [visible, setVisible] = useState(false);
  const storageKey = buyerOnboardingStorageKey(token);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) === '1') return;
    } catch {
      /* pokaż */
    }
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, '1');
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

  const steps = [
    {
      icon: Sparkles,
      title: t("Propozycje trafiają tutaj"),
      body: intelligenceEnabled
        ? t("{agent} i system dopasowują oferty do Twoich kryteriów — każda nowa pojawi się w tym panelu.", { agent: agentFirst })
        : t("{agent} wysyła Ci oferty dopasowane do Twoich kryteriów — każda pojawi się w tym panelu.", { agent: agentFirst }),
    },
    {
      icon: HeartHandshake,
      title: t("Oceniasz jednym dotknięciem"),
      body: t("„Chcę oglądać”, „Do przemyślenia” albo „Nie pasuje” — agent od razu widzi Twoją decyzję."),
    },
    {
      icon: MessageCircle,
      title: t("Wszystko w jednym miejscu"),
      body: t("Terminy oglądania, negocjacje, dokumenty i czat z agentem — wszystko w Twoim panelu klienta."),
    },
  ];

  return (
    <section className="lux-card lux-card--gold relative p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--lux-ink-3)] hover:bg-[var(--lux-well)]"
        aria-label={t("Zamknij")}
      >
        <X className="size-4" />
      </button>
      <p className="lux-kicker pr-8">{t("Twój panel klienta")}</p>
      <h2 className="lux-serif mt-1.5 pr-8 text-[23px] font-medium leading-tight">
        {hasPendingOffer ? t("Pierwsza propozycja już czeka") : t("Witamy — tak będzie wyglądać współpraca")}
      </h2>
      {welcomeEmailSent ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--lux-ink-2)]">
          {t("Link do tego panelu wysłaliśmy też na Twój e-mail.")}
        </p>
      ) : null}
      <ol className="mt-4 space-y-2.5">
        {steps.map((step) => (
          <li key={step.title} className="flex gap-3 rounded-2xl bg-[var(--lux-well)] px-3.5 py-3">
            <step.icon className="mt-0.5 size-4 shrink-0 text-[var(--lux-gold-ink)]" aria-hidden />
            <div className="text-[13px] leading-snug">
              <p className="font-semibold text-[var(--lux-ink)]">{step.title}</p>
              <p className="mt-0.5 text-[var(--lux-ink-2)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={hasPendingOffer ? showOffers : dismiss} className="lux-btn lux-btn--ink mt-4">
        {hasPendingOffer ? t("Pokaż pierwszą propozycję") : t("Rozumiem")}
        {hasPendingOffer ? <ArrowDown className="size-4" /> : null}
      </button>
    </section>
  );
}
