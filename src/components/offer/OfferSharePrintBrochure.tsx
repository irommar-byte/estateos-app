'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import {
  buildOfferShareQrSrc,
  formatOfferShareFloor,
  truncateOfferShareDescription,
} from '@/lib/offerSharePrint';

type OfferSharePrintBrochureProps = {
  card: OfferShareCard;
};

function AgentPrintCard({ card }: { card: OfferShareCard }) {
  const publisher = card.publisher;
  if (!publisher) return null;

  const primary = publisher.personName || publisher.displayName;
  const company =
    publisher.companyName && publisher.companyName !== primary ? publisher.companyName : null;
  const kicker = publisher.isPresentingAgent
    ? 'Twój doradca'
    : publisher.isAgent
      ? 'Agent nieruchomości'
      : 'Kontakt do wystawcy';
  const initial = (primary.charAt(0) || 'E').toUpperCase();
  const agentProfileUrl = publisher.profileUrl || card.canonicalUrl;
  const qrSrc = buildOfferShareQrSrc(agentProfileUrl, 220);

  return (
    <section className="offer-share-agent-print-card" aria-label="Wizytówka agenta">
      <div className="offer-share-agent-print-inner">
        <div className="offer-share-agent-print-photo">
          {publisher.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publisher.imageUrl} alt={primary} crossOrigin="anonymous" />
          ) : (
            <span className="offer-share-agent-photo-initial">{initial}</span>
          )}
        </div>
        <div className="offer-share-agent-print-details">
          <p className="offer-share-agent-print-kicker">{kicker}</p>
          <h3 className="offer-share-agent-print-name">{primary}</h3>
          {company ? <p className="offer-share-agent-print-company">{company}</p> : null}
          {publisher.phone ? (
            <p className="offer-share-agent-print-contact">Tel. {publisher.phone}</p>
          ) : null}
          {publisher.email ? (
            <p className="offer-share-agent-print-contact">{publisher.email}</p>
          ) : null}
          <p className="offer-share-agent-print-ref">
            Ref. #{card.id} · estateos.pl/o/{card.id}
          </p>
        </div>
        <div className="offer-share-agent-print-qr-col">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="Kod QR wizytówki agenta" className="offer-share-agent-print-qr" />
          <p className="offer-share-agent-print-qr-label">Wizytówka agenta</p>
        </div>
        <div className="offer-share-agent-print-brand">
          <span className="offer-share-agent-print-badge">EstateOS™</span>
          <strong>EstateOS™</strong>
          <p>Zweryfikowany rynek nieruchomości</p>
        </div>
      </div>
    </section>
  );
}

function PrintMapPanel({ card }: { card: OfferShareCard }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(card.mapImageUrl) && !failed;

  return (
    <div className="offer-share-print-map">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.mapImageUrl || ''}
          alt={`Mapa okolicy: ${card.locationLabel}`}
          crossOrigin="anonymous"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="offer-share-print-map-fallback">
          <p>Okolica</p>
          <strong>{card.locationLabel}</strong>
        </div>
      )}
      <p className="offer-share-print-map-caption">
        {showImage ? 'Okolica · komunikacja i usługi' : 'Lokalizacja oferty'}
      </p>
    </div>
  );
}

export default function OfferSharePrintBrochure({ card }: OfferSharePrintBrochureProps) {
  const [mounted, setMounted] = useState(false);
  const hero = card.imageUrl || card.images[0] || '';
  const description = truncateOfferShareDescription(card.description, 480);
  const qrSrc = buildOfferShareQrSrc(card.canonicalUrl, 240);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const floorLabel = formatOfferShareFloor(card.floor);
  const specs: Array<{ label: string; value: string }> = [
    card.area != null ? { label: 'Metraż', value: `${card.area} m²` } : null,
    card.rooms != null ? { label: 'Pokoje', value: String(card.rooms) } : null,
    floorLabel ? { label: 'Piętro', value: floorLabel } : null,
    card.yearBuilt != null ? { label: 'Rok budowy', value: String(card.yearBuilt) } : null,
    card.heating ? { label: 'Ogrzewanie', value: card.heating } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return createPortal(
    <div id="offer-share-print-portal" className="offer-share-print-portal" aria-hidden="true">
      <article id="offer-share-print-brochure" className="offer-share-print-brochure">
        <header className="offer-share-print-header">
          <div className="offer-share-print-brand-left">
            <strong>EstateOS™</strong>
            <span>Karta nieruchomości</span>
          </div>
          <span className="offer-share-print-ref">#{card.id}</span>
        </header>

        <div className="offer-share-print-hero">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt={card.title} crossOrigin="anonymous" />
          ) : (
            <div className="offer-share-print-hero-placeholder">Brak zdjęcia</div>
          )}
          <div className="offer-share-print-hero-overlay">
            <div className="offer-share-print-badges">
              <span>{card.transactionLabel}</span>
              <span>{card.propertyTypeLabel}</span>
            </div>
            <p className="offer-share-print-price">{card.priceLabel}</p>
          </div>
        </div>

        <div className="offer-share-print-main">
          <div className="offer-share-print-copy">
            <h1>{card.title}</h1>
            <p className="offer-share-print-location">{card.addressLine || card.locationLabel}</p>
            <p className="offer-share-print-summary">{card.detailLine}</p>

            {specs.length ? (
              <div className="offer-share-print-spec-grid">
                {specs.map((spec) => (
                  <div key={spec.label} className="offer-share-print-spec">
                    <span className="offer-share-print-spec-label">{spec.label}</span>
                    <strong className="offer-share-print-spec-value">{spec.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            {card.amenities.length ? (
              <div className="offer-share-print-amenities">
                {card.amenities.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : null}

            {description ? (
              <section className="offer-share-print-description">
                <p className="offer-share-print-section-title">Opis</p>
                <p className="offer-share-print-description-body">{description}</p>
              </section>
            ) : null}
          </div>

          <aside className="offer-share-print-side">
            <PrintMapPanel card={card} />

            {card.gallery.length ? (
              <div className="offer-share-print-gallery">
                {card.gallery.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" crossOrigin="anonymous" />
                ))}
              </div>
            ) : null}

            <div className="offer-share-print-qr-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt="Kod QR oferty" className="offer-share-print-qr" />
              <div>
                <p className="offer-share-print-qr-title">Kod QR oferty</p>
                <p className="offer-share-print-qr-caption">
                  Zeskanuj telefonem — otworzy wizytówkę lub aplikację EstateOS™.
                </p>
                <p className="offer-share-print-qr-url">{card.canonicalUrl}</p>
              </div>
            </div>
          </aside>
        </div>

        <AgentPrintCard card={card} />

        <footer className="offer-share-print-foot">
          <span>estateos.pl</span>
          <span>Radar · Deal Room · zweryfikowany rynek</span>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
