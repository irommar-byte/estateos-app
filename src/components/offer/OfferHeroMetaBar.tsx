"use client";

import { Briefcase, CalendarDays, Eye, MessageCircleQuestion, ShieldCheck, Star } from "lucide-react";

type Props = {
  sellerLabel: string;
  sellerPersonLine?: string | null;
  sellerAvatar?: string | null;
  sellerIsAgency?: boolean;
  averageRating: number;
  totalReviews: number;
  isOnline: boolean;
  /** ISO last activity — shown when offline */
  lastSeenAt?: string | null;
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
    lastSeenPrefix: string;
    legalVerifiedKw: string;
    legalUnverifiedKw: string;
    legalVerifiedKwSublabel: string;
    newOfferBadge: string;
    noData: string;
    openHouseMark?: string;
    openHouseDate?: string | null;
  };
  locale?: string;
  onOpenProfile: () => void;
  onAsk: () => void;
  onOpenHousePress?: () => void;
  onLegalShieldPress?: () => void;
};

function formatLastSeenLabel(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const loc = locale === "en" ? "en-GB" : "pl-PL";
  const date = d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

function PresenceDot({
  online,
  onlineLabel,
  offlineLabel,
  lastSeenAt,
  lastSeenPrefix,
  locale,
}: {
  online: boolean;
  onlineLabel: string;
  offlineLabel: string;
  lastSeenAt?: string | null;
  lastSeenPrefix: string;
  locale: string;
}) {
  const when = !online ? formatLastSeenLabel(lastSeenAt, locale) : null;
  const label = online ? onlineLabel : when ? `${lastSeenPrefix} ${when}` : offlineLabel;
  return (
    <span className={`eos-presence ${online ? "eos-presence--on" : "eos-presence--off"}`}>
      <span className="eos-presence__dot" aria-hidden />
      <span className="eos-presence__label">{label}</span>
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
  lastSeenAt,
  isOwner,
  canAsk,
  views,
  offerId,
  listedAtLabel,
  isLegalKwVerified,
  isNewListing,
  labels,
  locale = "pl",
  onOpenProfile,
  onAsk,
  onOpenHousePress,
  onLegalShieldPress,
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
              <PresenceDot
                online={isOnline}
                onlineLabel={labels.online}
                offlineLabel={labels.offline}
                lastSeenAt={lastSeenAt}
                lastSeenPrefix={labels.lastSeenPrefix}
                locale={locale}
              />
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

        {isOwner && !isLegalKwVerified && onLegalShieldPress ? (
          <button
            type="button"
            className="eos-offer-hero-bar__cell is-warn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onLegalShieldPress();
            }}
          >
            <span className="eos-offer-hero-bar__k">{labels.legalVerifiedKwSublabel}</span>
            <span className="eos-offer-hero-bar__v eos-offer-hero-bar__v--wrap">
              <ShieldCheck size={14} aria-hidden />
              {kwLabel}
            </span>
          </button>
        ) : (
          <div className={`eos-offer-hero-bar__cell ${isLegalKwVerified ? "is-ok" : "is-warn"}`}>
            <span className="eos-offer-hero-bar__k">{labels.legalVerifiedKwSublabel}</span>
            <span className="eos-offer-hero-bar__v eos-offer-hero-bar__v--wrap">
              <ShieldCheck size={14} aria-hidden />
              {kwLabel}
            </span>
          </div>
        )}

        {labels.openHouseDate ? (
          <button
            type="button"
            className="eos-offer-hero-bar__cell is-oh"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenHousePress?.();
            }}
          >
            <span className="eos-offer-hero-bar__k">{labels.openHouseMark || "OH"}</span>
            <span className="eos-offer-hero-bar__v eos-offer-hero-bar__v--wrap">
              <CalendarDays size={14} aria-hidden />
              {labels.openHouseDate}
            </span>
          </button>
        ) : null}

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
