"use client";

import { Briefcase, Eye, MessageCircleQuestion, ShieldCheck, Star } from "lucide-react";

type Props = {
  sellerLabel: string;
  sellerPersonLine?: string | null;
  sellerAvatar?: string | null;
  sellerIsAgency?: boolean;
  averageRating: number;
  totalReviews: number;
  isOnline: boolean;
  isOwner: boolean;
  canAsk: boolean;
  views: number;
  offerId: string | number;
  listedAtLabel: string;
  isLegalKwVerified: boolean;
  isNewListing: boolean;
  themeTextActive: string;
  themeBgActiveSoft: string;
  themeBorderActive: string;
  labels: {
    ask: string;
    views: string;
    offerId: string;
    listedSince: string;
    online: string;
    offline: string;
    legalVerifiedKw: string;
    legalUnverifiedKw: string;
    legalVerifiedKwSublabel: string;
    newOfferBadge: string;
    noData: string;
  };
  onOpenProfile: () => void;
  onAsk: () => void;
};

function PresenceDot({
  online,
  onlineLabel,
  offlineLabel,
}: {
  online: boolean;
  onlineLabel: string;
  offlineLabel: string;
}) {
  return (
    <span className={`eos-presence ${online ? "eos-presence--on" : "eos-presence--off"}`}>
      <span className="eos-presence__dot" aria-hidden />
      <span className="eos-presence__label">{online ? onlineLabel : offlineLabel}</span>
    </span>
  );
}

export default function OfferHeroMetaBar({
  sellerLabel,
  sellerPersonLine,
  sellerAvatar,
  sellerIsAgency,
  averageRating,
  totalReviews,
  isOnline,
  isOwner,
  canAsk,
  views,
  offerId,
  listedAtLabel,
  isLegalKwVerified,
  isNewListing,
  labels,
  onOpenProfile,
  onAsk,
}: Props) {
  const filledStars = totalReviews > 0 ? Math.max(0, Math.min(5, Math.round(averageRating))) : 0;
  const kwLabel = isLegalKwVerified ? labels.legalVerifiedKw : labels.legalUnverifiedKw;

  return (
    <section className="eos-offer-hero-bar" aria-label="Informacje o ofercie">
      <div className="eos-offer-hero-bar__main">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenProfile();
          }}
          className="eos-offer-hero-bar__seller"
        >
          <span className="eos-offer-hero-bar__avatar">
            {sellerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sellerAvatar} alt="" />
            ) : sellerIsAgency ? (
              <Briefcase size={18} aria-hidden />
            ) : (
              <span aria-hidden>👤</span>
            )}
          </span>
          <span className="eos-offer-hero-bar__seller-copy">
            <span className="eos-offer-hero-bar__seller-row">
              <span className="eos-offer-hero-bar__name">{sellerLabel}</span>
              <PresenceDot online={isOnline} onlineLabel={labels.online} offlineLabel={labels.offline} />
            </span>
            {sellerPersonLine ? (
              <span className="eos-offer-hero-bar__person">{sellerPersonLine}</span>
            ) : null}
            <span
              className="eos-offer-hero-bar__stars"
              aria-label={totalReviews > 0 ? `${averageRating.toFixed(1)} / 5` : undefined}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={12}
                  className={i <= filledStars ? "eos-offer-hero-bar__star is-on" : "eos-offer-hero-bar__star"}
                  aria-hidden
                />
              ))}
              {totalReviews > 0 ? (
                <span className="eos-offer-hero-bar__rating">{averageRating.toFixed(1)}</span>
              ) : null}
            </span>
          </span>
        </button>

        {!isOwner && canAsk ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAsk();
            }}
            className="eos-offer-hero-bar__ask"
          >
            <MessageCircleQuestion className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
            {labels.ask}
          </button>
        ) : null}
      </div>

      <div className="eos-offer-hero-bar__meta">
        <div className="eos-offer-hero-bar__cell">
          <span className="eos-offer-hero-bar__k">{labels.views}</span>
          <span className="eos-offer-hero-bar__v">
            <Eye size={14} aria-hidden />
            {views}
          </span>
        </div>

        <div className={`eos-offer-hero-bar__cell ${isLegalKwVerified ? "is-ok" : "is-warn"}`}>
          <span className="eos-offer-hero-bar__k">{labels.legalVerifiedKwSublabel}</span>
          <span className="eos-offer-hero-bar__v eos-offer-hero-bar__v--wrap">
            <ShieldCheck size={14} aria-hidden />
            {kwLabel}
          </span>
        </div>

        <div className="eos-offer-hero-bar__cell">
          <span className="eos-offer-hero-bar__k">{labels.offerId}</span>
          <span className="eos-offer-hero-bar__v eos-offer-hero-bar__id">{offerId}</span>
        </div>

        <div className="eos-offer-hero-bar__cell">
          <span className="eos-offer-hero-bar__k">{labels.listedSince}</span>
          <span className="eos-offer-hero-bar__v">{listedAtLabel || labels.noData}</span>
        </div>
      </div>

      {isNewListing ? (
        <div className="eos-offer-hero-bar__badge-row">
          <span className="eos-offer-hero-bar__badge">{labels.newOfferBadge}</span>
        </div>
      ) : null}
    </section>
  );
}
