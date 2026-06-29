'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import {
  buildOfferShareQrSrc,
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
  const qrSrc = buildOfferShareQrSrc(card.canonicalUrl, 120);

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
          <img src={qrSrc} alt="Kod QR oferty" className="offer-share-agent-print-qr" />
          <p className="offer-share-agent-print-qr-label">Zeskanuj ofertę</p>
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

export default function OfferSharePrintBrochure({ card }: OfferSharePrintBrochureProps) {
  const [mounted, setMounted] = useState(false);
  const hero = card.imageUrl || card.images[0] || '';
  const description = truncateOfferShareDescription(card.description);
  const qrSrc = buildOfferShareQrSrc(card.canonicalUrl, 160);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div id="offer-share-print-portal" className="offer-share-print-portal" aria-hidden="true">
      <article id="offer-share-print-brochure" className="offer-share-print-brochure">
        <header className="offer-share-print-header">
          <div className="offer-share-print-brand-left">
            <strong>EstateOS™</strong>
            <span>Wizytówka oferty</span>
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
        </div>

        <div className="offer-share-print-body">
          <div className="offer-share-print-badges">
            <span>{card.transactionLabel}</span>
            <span>{card.propertyTypeLabel}</span>
          </div>
          <h1>{card.title}</h1>
          <p className="offer-share-print-location">{card.locationLabel}</p>
          <p className="offer-share-print-summary">{card.summaryLine}</p>
          <p className="offer-share-print-price">{card.priceLabel}</p>

          <div className="offer-share-print-spec-grid">
            {card.area != null ? (
              <div>
                <label>Metraż</label>
                <strong>{card.area} m²</strong>
              </div>
            ) : null}
            {card.rooms != null ? (
              <div>
                <label>Pokoje</label>
                <strong>{card.rooms}</strong>
              </div>
            ) : null}
            {card.floor != null ? (
              <div>
                <label>Piętro</label>
                <strong>{card.floor}</strong>
              </div>
            ) : null}
          </div>

          {description ? (
            <section className="offer-share-print-description">
              <p className="offer-share-print-section-title">Opis</p>
              <p className="offer-share-print-description-body">{description}</p>
            </section>
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
        </div>

        <AgentPrintCard card={card} />
      </article>
    </div>,
    document.body,
  );
}
