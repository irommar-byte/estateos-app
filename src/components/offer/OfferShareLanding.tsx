'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, MessageCircle, Phone, QrCode } from 'lucide-react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import OfferShareAppBanner from '@/components/offer/OfferShareAppBanner';
import AppointmentModal from '@/components/AppointmentModal';
import OfferShareMessageModal from '@/components/offer/OfferShareMessageModal';
import OfferSharePrintActions from '@/components/offer/OfferSharePrintActions';
import { buildOfferShareQrSrc } from '@/lib/offerSharePrint';
import { loadOfferShareIntent, resumeOfferShareIntent } from '@/lib/offerShareIntent';
import { offerFontVars } from '@/components/offer/offerFonts';

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'E';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function QrPanel({ card, onClose }: { card: OfferShareCard; onClose?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[11px] font-bold uppercase tracking-[0.3em]">EstateOS™</span>
      <div className="mt-5 rounded-[24px] bg-white p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={buildOfferShareQrSrc(card.canonicalUrl, 480)} alt="Kod QR oferty" width={216} height={216} className="block size-[216px]" />
      </div>
      <p className="mt-5 text-[20px] font-semibold tracking-[-0.01em]">Zeskanuj, żeby otworzyć ofertę</p>
      <p className="mt-1.5 max-w-[290px] text-[13px] leading-snug opacity-70">
        {onClose ? 'Pokaż ten kod klientowi — otworzy tę samą wizytówkę na swoim telefonie.' : 'Aparatem telefonu — wizytówka otworzy się w przeglądarce albo w aplikacji EstateOS™.'}
      </p>
      <p className="mt-3 font-[family-name:var(--ofb-mono)] text-[12px] opacity-70">estateos.pl/o/{card.id}</p>
      {onClose ? (
        <button type="button" onClick={onClose} className="mt-7 h-12 rounded-full bg-white px-7 text-[14px] font-semibold text-[#15171a]">
          Zamknij
        </button>
      ) : null}
    </div>
  );
}

/** Wizytówka oferty — jeden ekran telefonu: zdjęcia, cena, liczby, agent i dwa przyciski. */
export default function OfferShareLanding({ card }: { card: OfferShareCard }) {
  const [activeImage, setActiveImage] = useState(0);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  const images = card.images.length ? card.images : card.imageUrl ? [card.imageUrl] : [];
  const returnPath = `/o/${card.id}`;
  const publisher = card.publisher;
  const publisherName = publisher ? publisher.personName || publisher.displayName : '';
  const publisherRole = publisher
    ? [publisher.isPresentingAgent ? 'Twój doradca' : publisher.isAgent ? 'Agent' : 'Wystawca', publisher.companyName && publisher.companyName !== publisherName ? publisher.companyName : null]
        .filter(Boolean)
        .join(' · ')
    : '';

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

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQrOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [qrOpen]);

  const onGalleryScroll = useCallback(() => {
    const el = galleryRef.current;
    if (!el || !el.clientWidth) return;
    setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const floor =
    card.floor == null || String(card.floor).trim() === ''
      ? null
      : Number(card.floor) === 0
        ? 'parter'
        : card.totalFloors
          ? `${card.floor} / ${card.totalFloors}`
          : String(card.floor);
  const specs = [
    card.area != null ? { label: 'metraż', value: `${card.area} m²` } : null,
    card.rooms != null ? { label: 'pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'piętro', value: floor } : null,
    card.yearBuilt != null ? { label: 'rok', value: String(card.yearBuilt) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  const roundBtn =
    'flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f2f0ec] text-[#15171a] dark:bg-white/[0.08] dark:text-[#f3eee6]';

  return (
    <main className={`${offerFontVars} font-[family-name:var(--ofb-sans)] min-h-[100dvh] bg-[#ece7df] text-[#15171a] dark:bg-[#0c0b0a] dark:text-[#f3eee6]`}>
      <OfferShareAppBanner offerId={card.id} canonicalUrl={card.canonicalUrl} offerTitle={card.title} />

      <div className="mx-auto flex min-h-[100dvh] max-w-[960px] items-stretch justify-center gap-12 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:items-center lg:py-10">
        <div className="flex w-full max-w-[440px] flex-col">
          <div className="flex items-center justify-between px-1 pb-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">EstateOS™</span>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-semibold shadow-sm lg:hidden dark:bg-white/[0.08]"
            >
              <QrCode size={15} />
              Kod QR
            </button>
          </div>

          <article className="flex flex-1 flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_20px_40px_rgba(40,30,20,0.12)] dark:bg-[#161412] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
            <div className="relative h-[42dvh] min-h-[220px] max-h-[460px] shrink-0 bg-[#d9d4cc] dark:bg-[#1c1a17]">
              {images.length ? (
                <div
                  ref={galleryRef}
                  onScroll={onGalleryScroll}
                  className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt={i === 0 ? card.title : ''}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="h-full w-full shrink-0 snap-center object-cover"
                    />
                  ))}
                </div>
              ) : null}
              <span className="absolute left-3.5 top-3.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15171a]">
                {card.transactionLabel} · {card.propertyTypeLabel}
              </span>
              {images.length > 1 ? (
                <>
                  <span className="absolute right-3.5 top-3.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {activeImage + 1} / {images.length}
                  </span>
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {images.slice(0, 8).map((src, i) => (
                      <span
                        key={`${src}-dot-${i}`}
                        className={`h-[5px] rounded-full transition-all ${i === Math.min(activeImage, 7) ? 'w-[18px] bg-white' : 'w-[5px] bg-white/60'}`}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-[18px] pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[28px] font-semibold leading-none tracking-[-0.03em]">{card.priceLabel}</p>
                {card.pricePerSqmLabel ? <p className="shrink-0 text-[12px] text-[#77736c] dark:text-[#968e82]">{card.pricePerSqmLabel}</p> : null}
              </div>
              <h1 className="mt-2 text-[17px] font-semibold leading-[1.25]">{card.title}</h1>
              <p className="mt-0.5 text-[12.5px] text-[#5d6068] dark:text-[#a8a095]">{card.addressLine || card.locationLabel}</p>
              {specs.length ? (
                <dl
                  className="mt-3 grid border-t border-[#ebe8e3] pt-2.5 dark:border-white/10"
                  style={{ gridTemplateColumns: `repeat(${specs.length}, minmax(0, 1fr))` }}
                >
                  {specs.map((spec) => (
                    <div key={spec.label}>
                      <dd className="text-[16px] font-semibold">{spec.value}</dd>
                      <dt className="text-[11px] text-[#77736c] dark:text-[#968e82]">{spec.label}</dt>
                    </div>
                  ))}
                </dl>
              ) : null}
              {card.amenities.length ? (
                <div className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {card.amenities.map((item) => (
                    <span key={item} className="shrink-0 rounded-full bg-[#f2f0ec] px-2.5 py-1 text-[11.5px] font-medium dark:bg-white/[0.07]">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative mt-4 border-t-2 border-dashed border-[#e1dcd3] dark:border-white/10">
              <span className="absolute -left-3 -top-3 size-[22px] rounded-full bg-[#ece7df] dark:bg-[#0c0b0a]" />
              <span className="absolute -right-3 -top-3 size-[22px] rounded-full bg-[#ece7df] dark:bg-[#0c0b0a]" />
            </div>

            <div className="mt-auto px-[18px] pb-[18px] pt-4">
              {publisher ? (
                <div className="flex items-center gap-2.5">
                  <Link href={publisher.profileHref} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#15171a] text-[15px] font-semibold text-white">
                      {publisher.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={publisher.imageUrl} alt={publisherName} className="h-full w-full object-cover" />
                      ) : (
                        initialsFrom(publisherName)
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{publisherName}</span>
                      <span className="block truncate text-[12px] text-[#77736c] dark:text-[#968e82]">{publisherRole}</span>
                    </span>
                  </Link>
                  {publisher.phone ? (
                    <a href={`tel:${publisher.phone.replace(/\s+/g, '')}`} aria-label={`Zadzwoń: ${publisher.phone}`} className={roundBtn}>
                      <Phone size={18} />
                    </a>
                  ) : null}
                  <button type="button" onClick={() => setMessageOpen(true)} aria-label="Napisz wiadomość" className={roundBtn}>
                    <MessageCircle size={18} />
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                {publisher ? (
                  <button
                    type="button"
                    onClick={() => setAppointmentOpen(true)}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#15171a] text-[14px] font-semibold text-white dark:bg-[#f3eee6] dark:text-[#15171a]"
                  >
                    <CalendarDays size={16} />
                    Umów wizytę
                  </button>
                ) : null}
                <Link
                  href={card.fullOfferPath}
                  className={`flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-[#dedad3] px-4 text-[14px] font-semibold dark:border-white/15 ${publisher ? '' : 'flex-1'}`}
                >
                  Pełna oferta
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </article>

          <div className="mt-3 empty:hidden">
            <OfferSharePrintActions card={card} />
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 rounded-[28px] bg-[#15171a] p-8 text-white lg:block">
          <QrPanel card={card} />
        </aside>
      </div>

      {qrOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kod QR oferty"
          onClick={(event) => {
            if (event.target === event.currentTarget) setQrOpen(false);
          }}
          className="fixed inset-0 eos-z-modal-nested flex items-center justify-center bg-[#15171a]/95 p-6 text-white backdrop-blur-sm"
        >
          <QrPanel card={card} onClose={() => setQrOpen(false)} />
        </div>
      ) : null}

      {publisher ? (
        <>
          <AppointmentModal
            isOpen={appointmentOpen}
            onClose={() => setAppointmentOpen(false)}
            offerId={card.id}
            sellerId={publisher.userId}
            returnPath={returnPath}
            publisherName={publisherName}
            offerTitle={card.title}
          />
          <OfferShareMessageModal
            isOpen={messageOpen}
            onClose={() => setMessageOpen(false)}
            peerUserId={publisher.userId}
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
    </main>
  );
}
