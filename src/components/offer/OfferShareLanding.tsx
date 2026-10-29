'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Copy, MapPin } from 'lucide-react';
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
import { offerSerif } from '@/components/offer/offerSerif';

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

  const specs = [
    card.area != null ? { label: 'Powierzchnia', value: `${card.area} m²` } : null,
    card.rooms != null ? { label: 'Pokoje', value: String(card.rooms) } : null,
    card.floor != null && String(card.floor).trim() !== ''
      ? { label: 'Piętro', value: Number(card.floor) === 0 ? 'Parter' : String(card.floor) }
      : null,
    card.yearBuilt != null ? { label: 'Rok budowy', value: String(card.yearBuilt) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <main className={`${offerSerif.variable} min-h-[100dvh] bg-[#f6f3ee] text-[#15171a] dark:bg-[#0c0b0a] dark:text-[#f3eee6]`}>
      <OfferShareAppBanner offerId={card.id} canonicalUrl={card.canonicalUrl} offerTitle={card.title} />

      <div className="mx-auto max-w-xl px-3 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <article className="overflow-hidden rounded-[26px] border border-[#e4dccd] bg-white shadow-[0_24px_60px_rgba(21,23,26,0.08)] dark:border-[#d8c3a0]/15 dark:bg-[#161412] dark:shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <header className="flex items-center justify-between gap-3 border-b border-[#e4dccd] px-5 py-3.5 dark:border-[#d8c3a0]/15">
            <span className="text-[11px] font-bold uppercase tracking-[0.28em]">EstateOS™</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a8478] dark:text-[#968e82]">
              Oferta #{card.id}
            </span>
          </header>

          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1c1b19]">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt={card.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm tracking-[0.3em] text-[#d8c3a0]">ESTATEOS™</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d8c3a0]">
                {card.transactionLabel} · {card.propertyTypeLabel}
              </p>
              <h1 className="mt-1.5 font-[family-name:var(--ofb-serif)] text-[26px] font-medium leading-[1.12] text-white">
                {card.title}
              </h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/85">
                <MapPin size={14} className="shrink-0" />
                {card.addressLine || card.locationLabel}
              </p>
            </div>
          </div>

          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {images.slice(0, 10).map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  aria-label={`Zdjęcie ${i + 1}`}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl transition ${
                    i === activeImage ? 'ring-2 ring-[#a8844e] ring-offset-2 ring-offset-white dark:ring-offset-[#161412]' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-6 px-5 pb-6 pt-4">
            <div className="border-b border-[#e4dccd] pb-5 dark:border-[#d8c3a0]/15">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8a6a3a] dark:text-[#d8c3a0]">
                {card.isRent ? 'Czynsz najmu' : 'Cena ofertowa'}
              </p>
              <p className="mt-1 font-[family-name:var(--ofb-serif)] text-[34px] font-medium leading-none">{card.priceLabel}</p>
              {card.pricePerSqmLabel ? (
                <p className="mt-1.5 text-[13px] text-[#8a8478] dark:text-[#968e82]">{card.pricePerSqmLabel}</p>
              ) : null}
              {specs.length ? (
                <dl className="mt-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}>
                  {specs.map((spec, index) => (
                    <div key={spec.label} className={index ? 'border-l border-[#e4dccd] pl-3 dark:border-[#d8c3a0]/15' : ''}>
                      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8a8478] dark:text-[#968e82]">{spec.label}</dt>
                      <dd className="mt-1 font-[family-name:var(--ofb-serif)] text-[18px]">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {card.amenities.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {card.amenities.map((item) => (
                    <span key={item} className="rounded-full border border-[#e4dccd] px-2.5 py-1 text-[11px] font-semibold text-[#4a4740] dark:border-[#d8c3a0]/20 dark:text-[#c8c0b3]">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {card.description ? (
              <p className="line-clamp-6 text-[14px] leading-relaxed text-[#4a4740] dark:text-[#c8c0b3]">{card.description}</p>
            ) : null}

            {card.publisher ? (
              <OfferSharePublisherCard
                publisher={card.publisher}
                onScheduleVisit={() => setAppointmentOpen(true)}
                onWriteMessage={() => setMessageOpen(true)}
              />
            ) : null}

            <div className="flex flex-col gap-2.5">
              <Link
                href={card.fullOfferPath}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#15171a] text-[14px] font-semibold text-[#d8c3a0] dark:bg-[#d8c3a0] dark:text-[#0c0b0a]"
              >
                Zobacz pełną ofertę
                <ArrowRight size={16} />
              </Link>
              <OfferShareOpenInAppButton offerId={card.id} canonicalUrl={card.canonicalUrl} />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#e4dccd] text-[13px] font-semibold dark:border-[#d8c3a0]/20"
              >
                <Copy size={14} />
                {copied ? 'Skopiowano link' : 'Kopiuj link wizytówki'}
              </button>
              <OfferSharePrintActions card={card} />
            </div>

            <OfferShareQr
              url={card.canonicalUrl}
              label="Kod QR oferty"
              caption="Zeskanuj telefonem — otworzy tę ofertę na stronie albo w aplikacji EstateOS™."
            />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4dccd] bg-[#f8f5ef] px-5 py-4 dark:border-[#d8c3a0]/15 dark:bg-[#1c1a17]">
            <p className="text-[11px] text-[#8a8478] dark:text-[#968e82]">Zweryfikowany rynek nieruchomości · estateos.pl</p>
            <AppStoreBadgeLink compact androidComingSoon />
          </footer>
        </article>
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
        <div className="pointer-events-none fixed inset-0 eos-z-modal-nested flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <p className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-[#141416] shadow-xl dark:bg-[#101014] dark:text-white">
            Kończymy rezerwację terminu…
          </p>
        </div>
      ) : null}

      <OfferSharePrintBrochure card={card} />
    </main>
  );
}
