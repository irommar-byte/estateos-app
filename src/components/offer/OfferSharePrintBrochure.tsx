'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { buildOfferShareQrSrc, formatOfferShareFloor, truncateOfferShareDescription } from '@/lib/offerSharePrint';
import { offerSerif } from '@/components/offer/offerSerif';


type OfferSharePrintBrochureProps = {
  card: OfferShareCard;
  /** Widoczne kartki A4 (aplikacja / tablet). Domyślnie ukryty portal pod wydruk i PDF na WWW. */
  inline?: boolean;
};

function Img({ src, alt = '', className }: { src: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} crossOrigin="anonymous" />;
}

function AgentBlock({ card, compact = false }: { card: OfferShareCard; compact?: boolean }) {
  const publisher = card.publisher;
  if (!publisher) return null;
  const name = publisher.personName || publisher.displayName;
  const company = publisher.companyName && publisher.companyName !== name ? publisher.companyName : null;
  const role = publisher.isPresentingAgent ? 'Twój doradca' : publisher.isAgent ? 'Agent prowadzący' : 'Kontakt';
  return (
    <div className={`ofb-agent ${compact ? 'ofb-agent--compact' : ''}`}>
      <div className="ofb-agent__photo">
        {publisher.imageUrl ? <Img src={publisher.imageUrl} alt={name} /> : <span>{(name.charAt(0) || 'E').toUpperCase()}</span>}
      </div>
      <div className="ofb-agent__body">
        <p className="ofb-eyebrow">{role}</p>
        <p className="ofb-agent__name">{name}</p>
        {company ? <p className="ofb-agent__company">{company}</p> : null}
        <p className="ofb-agent__contact">
          {[publisher.phone, publisher.email].filter(Boolean).join('   ·   ')}
        </p>
      </div>
    </div>
  );
}

function PageFoot({ card, page }: { card: OfferShareCard; page: number }) {
  return (
    <footer className="ofb-foot">
      <span className="ofb-foot__brand">EstateOS™</span>
      <span>Oferta #{card.id} · estateos.pl/o/{card.id}</span>
      <span>{page} / 2</span>
    </footer>
  );
}

/**
 * Ofertówka na prezentację — dwie strony A4:
 *  1. okładka: duże zdjęcie, cena, najważniejsze parametry, opiekun oferty i kod QR,
 *  2. szczegóły: pełny opis, układ pomieszczeń, galeria, mapa okolicy i miejsce na notatki z oglądania.
 * Te same kartki trafiają do druku, PDF (każda kartka osobno) i podglądu w aplikacji.
 */
export default function OfferSharePrintBrochure({ card, inline = false }: OfferSharePrintBrochureProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  const hero = card.imageUrl || card.images[0] || '';
  const strip = card.gallery.slice(0, 3);
  const extra = card.gallery.slice(3, 9);
  const gallery = extra.length >= 2 ? extra.slice(0, extra.length >= 4 ? 4 : 2) : [];
  const floor = formatOfferShareFloor(card.floor);
  const specs = [
    card.area != null ? { label: 'Powierzchnia', value: `${card.area} m²` } : null,
    card.rooms != null ? { label: 'Pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'Piętro', value: floor } : null,
    card.yearBuilt != null ? { label: 'Rok budowy', value: String(card.yearBuilt) } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const facts = [
    { label: 'Rodzaj', value: `${card.propertyTypeLabel} · ${card.transactionLabel.toLowerCase()}` },
    card.addressLine ? { label: 'Adres', value: card.addressLine } : null,
    card.heating ? { label: 'Ogrzewanie', value: card.heating } : null,
    card.amenities.length ? { label: 'Udogodnienia', value: card.amenities.join(', ') } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  const description = truncateOfferShareDescription(card.description, card.roomAreas.length ? 1250 : 1650);
  const qrSrc = buildOfferShareQrSrc(card.canonicalUrl, 320);

  const sheet = (
    <div id="offer-share-print-brochure" className={`ofb ${offerSerif.variable}`}>
      <section className="ofb-page ofb-page--cover">
        <header className="ofb-head">
          <span className="ofb-head__brand">EstateOS™</span>
          <span className="ofb-head__meta">
            {card.transactionLabel} · {card.propertyTypeLabel} · Oferta #{card.id}
          </span>
        </header>

        <div className="ofb-hero">
          {hero ? <Img src={hero} alt={card.title} /> : <div className="ofb-hero__empty">EstateOS™</div>}
        </div>

        <div className="ofb-title">
          <p className="ofb-eyebrow">{card.locationLabel}</p>
          <h1>{card.title}</h1>
          {card.addressLine ? <p className="ofb-title__address">{card.addressLine}</p> : null}
        </div>

        <div className="ofb-price">
          <div>
            <p className="ofb-eyebrow">{card.isRent ? 'Czynsz najmu' : 'Cena ofertowa'}</p>
            <p className="ofb-price__value">{card.priceLabel}</p>
            {card.pricePerSqmLabel ? <p className="ofb-price__sub">{card.pricePerSqmLabel}</p> : null}
          </div>
          {specs.length ? (
            <dl className="ofb-specs">
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {strip.length ? (
          <div className="ofb-strip" style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}>
            {strip.map((src) => (
              <Img key={src} src={src} />
            ))}
          </div>
        ) : null}

        <div className="ofb-contact">
          <AgentBlock card={card} />
          <div className="ofb-qr">
            <Img src={qrSrc} alt="Kod QR oferty" />
            <p>
              Pełna oferta,
              <br />
              galeria i umówienie
              <br />
              oglądania
            </p>
          </div>
        </div>

        <PageFoot card={card} page={1} />
      </section>

      <section className="ofb-page ofb-page--details">
        <header className="ofb-head">
          <span className="ofb-head__brand">EstateOS™</span>
          <span className="ofb-head__meta">{card.title}</span>
        </header>

        <div className="ofb-details">
          <div className="ofb-details__main">
            <h2 className="ofb-h2">O nieruchomości</h2>
            {description ? <p className="ofb-description">{description}</p> : null}

            <dl className="ofb-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>

            {card.roomAreas.length ? (
              <>
                <h2 className="ofb-h2">Układ pomieszczeń</h2>
                <ul className="ofb-rooms">
                  {card.roomAreas.map((room) => (
                    <li key={`${room.name}-${room.areaLabel}`}>
                      <span>{room.name}</span>
                      <strong>{room.areaLabel}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <aside className="ofb-details__side">
            {gallery.length ? (
              <div className="ofb-gallery">
                {gallery.map((src) => (
                  <Img key={src} src={src} />
                ))}
              </div>
            ) : null}
            {card.mapImageUrl ? (
              <figure className="ofb-map">
                <Img src={card.mapImageUrl} alt={`Mapa okolicy: ${card.locationLabel}`} />
                <figcaption>Okolica · {card.locationLabel}</figcaption>
              </figure>
            ) : null}
          </aside>
        </div>

        <div className="ofb-notes">
          <p className="ofb-eyebrow">Notatki z oglądania</p>
          <div className="ofb-notes__lines" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>

        <div className="ofb-closing">
          <AgentBlock card={card} compact />
          <p className="ofb-closing__note">
            Materiał informacyjny, nie stanowi oferty w rozumieniu Kodeksu cywilnego. Aktualne dane:
            estateos.pl/o/{card.id}
          </p>
        </div>

        <PageFoot card={card} page={2} />
      </section>
    </div>
  );

  if (inline) return sheet;
  return createPortal(
    <div id="offer-share-print-portal" className="offer-share-print-portal" aria-hidden="true">
      {sheet}
    </div>,
    document.body,
  );
}
