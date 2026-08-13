'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Copy,
  ExternalLink,
  MapPin,
  Ruler,
  Sparkles,
} from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import OfferSharePublisherCard from '@/components/offer/OfferSharePublisherCard';
import OfferShareQr from '@/components/offer/OfferShareQr';
import OfferShareAppBanner from '@/components/offer/OfferShareAppBanner';
import OfferShareOpenInAppButton from '@/components/offer/OfferShareOpenInAppButton';
import AppStoreBadgeLink from '@/components/ui/AppStoreBadgeLink';
import AppointmentModal from '@/components/AppointmentModal';
import OfferShareMessageModal from '@/components/offer/OfferShareMessageModal';
import OfferSharePrintActions from '@/components/offer/OfferSharePrintActions';
import OfferSharePrintBrochure from '@/components/offer/OfferSharePrintBrochure';
import { loadOfferShareIntent, resumeOfferShareIntent } from '@/lib/offerShareIntent';
import { eosBtn } from '@/components/ui/eosButtonStyles';

export default function OfferShareLanding({ card }: { card: OfferShareCard }) {
  const [activeImage, setActiveImage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [resuming, setResuming] = useState(false);

  const images = card.images.length ? card.images : card.imageUrl ? [card.imageUrl] : [];
  const hero = images[activeImage] || '';
  const returnPath = `/o/${card.id}`;
  const publisherName = card.publisher?.personName || card.publisher?.displayName;

  useEffect(() => {
    const pending = loadOfferShareIntent();
    if (!pending) return;
    let cancelled = false;
    void (async () => {
      setResuming(true);
      try {
        const destination = await resumeOfferShareIntent();
        if (!cancelled && destination) {
          window.location.href = destination;
        }
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(card.canonicalUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [card.canonicalUrl]);

  return (
    <main className="min-h-[100dvh] bg-[#ececea] text-[#141416] dark:bg-[#060608] dark:text-[#f5f5f7]">
      <OfferShareAppBanner offerId={card.id} canonicalUrl={card.canonicalUrl} offerTitle={card.title} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_520px_at_50%_-10%,rgba(184,146,46,0.12),transparent_60%)]" />

      <div className="relative mx-auto max-w-xl px-3 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="rounded-[28px] bg-gradient-to-br from-[#b8922e]/55 via-[#b8922e]/10 to-transparent p-[3px] shadow-[0_28px_80px_rgba(20,20,22,0.12)]">
          <article className="overflow-hidden rounded-[25px] border border-black/10 bg-[#fafaf8] dark:border-white/10 dark:bg-[#101014]">
            <header className="border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-[#5c5c66] dark:text-[#9a9aa8]">
                  <strong className="text-[11px] tracking-[0.18em] text-[#141416] dark:text-white">
                    EstateOS™
                  </strong>
                  <span>Wizytówka oferty</span>
                </div>
                <span className="rounded-full border border-[#b8922e]/35 bg-[#b8922e]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#b8922e]">
                  #{card.id}
                </span>
              </div>
            </header>

            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0a0a0c]">
              {hero ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero} alt={card.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/50">
                  Brak zdjęcia
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4 pt-16">
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                    {card.transactionLabel}
                  </span>
                  <span className="rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                    {card.propertyTypeLabel}
                  </span>
                </div>
                <h1 className="text-xl font-black leading-tight text-white sm:text-2xl">{card.title}</h1>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                  <MapPin size={14} className="shrink-0" />
                  {card.locationLabel}
                </p>
              </div>
            </div>

            {images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto border-b border-black/10 px-3 py-3 dark:border-white/10">
                {images.slice(0, 8).map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={[
                      'h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition',
                      i === activeImage ? 'border-emerald-500' : 'border-transparent opacity-75 hover:opacity-100',
                    ].join(' ')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-5 p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c5c66] dark:text-[#9a9aa8]">
                  {card.summaryLine}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-[#141416] dark:text-white">
                  {card.priceLabel}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {card.area != null ? (
                  <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c5c66] dark:text-[#9a9aa8]">Metraż</p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold">
                      <Ruler size={14} className="text-emerald-500" />
                      {card.area} m²
                    </p>
                  </div>
                ) : null}
                {card.rooms != null ? (
                  <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c5c66] dark:text-[#9a9aa8]">Pokoje</p>
                    <p className="mt-1 text-sm font-bold">{card.rooms}</p>
                  </div>
                ) : null}
                {card.floor != null ? (
                  <div className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#5c5c66] dark:text-[#9a9aa8]">Piętro</p>
                    <p className="mt-1 text-sm font-bold">{card.floor}</p>
                  </div>
                ) : null}
              </div>

              {card.description ? (
                <p className="text-sm leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8] line-clamp-6">
                  {card.description}
                </p>
              ) : null}

              {card.publisher ? (
                <OfferSharePublisherCard
                  publisher={card.publisher}
                  onScheduleVisit={() => setAppointmentOpen(true)}
                  onWriteMessage={() => setMessageOpen(true)}
                />
              ) : null}

              <OfferShareQr
                url={card.canonicalUrl}
                label="Kod QR oferty"
                caption="Zeskanuj telefonem — otworzy wizytówkę lub aplikację EstateOS™ z tą nieruchomością."
              />

              <OfferShareOpenInAppButton offerId={card.id} canonicalUrl={card.canonicalUrl} />

              <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                Galeria, rzut i mapa — na pełnej stronie oferty. Kontakt z wystawcą i negocjacje wymagają
                bezpłatnego konta na zweryfikowanej platformie EstateOS™.
              </p>

              <div className="flex flex-col gap-3">
                <Link href={card.fullOfferPath} className={eosBtn('primary', { block: true, size: 'lg' })}>
                  Zobacz pełną ofertę
                  <ArrowRight size={16} />
                </Link>
                <button type="button" onClick={() => void copyLink()} className={eosBtn('secondary', { block: true })}>
                  <Copy size={14} />
                  {copied ? 'Skopiowano link' : 'Kopiuj link wizytówki'}
                </button>
                <OfferSharePrintActions card={card} />
              </div>
            </div>

            <footer className="border-t border-black/10 bg-[#f5f5f3] px-5 py-6 dark:border-white/10 dark:bg-[#0c0c10]">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-black text-[#141416] dark:text-white">Dlaczego EstateOS™?</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#5c5c66] dark:text-[#9a9aa8]">
                    Radar dopasowań, Deal Room, weryfikacja ofert i aplikacja mobilna — nowoczesny rynek
                    nieruchomości zamiast kolejnego portalu ogłoszeń.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/dla-agencji" className={eosBtn('promote', { size: 'sm' })}>
                      <Building2 size={12} />
                      Biuro za 0 zł
                    </Link>
                    <Link href="https://estateos.pl" className={eosBtn('secondary', { size: 'sm' })}>
                      estateos.pl
                      <ExternalLink size={11} />
                    </Link>
                  </div>
                  <div className="mt-5 rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.06]">
                    <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#5c5c66] dark:text-[#9a9aa8]">
                      Pobierz aplikację
                    </p>
                    <AppStoreBadgeLink compact androidComingSoon />
                  </div>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>

      {card.publisher ? (
        <>
          <AppointmentModal
            isOpen={appointmentOpen}
            onClose={() => setAppointmentOpen(false)}
            offerId={card.id}
            sellerId={card.publisher.userId}
            returnPath={returnPath}
            publisherName={publisherName}
            offerTitle={card.title}
          />
          <OfferShareMessageModal
            isOpen={messageOpen}
            onClose={() => setMessageOpen(false)}
            peerUserId={card.publisher.userId}
            peerName={publisherName}
            offerId={card.id}
            returnPath={returnPath}
          />
        </>
      ) : null}

      {resuming ? (
        <div className="pointer-events-none fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <p className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-[#141416] shadow-xl dark:bg-[#101014] dark:text-white">
            Kończymy rezerwację terminu…
          </p>
        </div>
      ) : null}

      <OfferSharePrintBrochure card={card} />
    </main>
  );
}
