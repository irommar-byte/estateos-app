"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Briefcase, MapPin } from "lucide-react";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import LegalVerifiedShieldBadge from "@/components/offer/LegalVerifiedShieldBadge";
import OfferNewBadge from "@/components/offer/OfferNewBadge";
import { isOfferNew } from "@/lib/offerNewBadge";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import { useLocale } from "@/contexts/LocaleContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import GoldFeaturedFrame from "@/components/ui/GoldFeaturedFrame";
import { fetchHomeCatalogJson } from "@/lib/homeCatalogCache";
import { OfferAdaptiveImage } from "@/components/offer/OfferAdaptiveImage";
import { useOfferImageMeta } from "@/hooks/useOfferImageMeta";

type Offer = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  price?: string | number | null;
  priceCurrency?: string | null;
  pricePln?: number | null;
  area?: string | number | null;
  rooms?: string | number | null;
  imageUrl?: string | null;
  images?: unknown;
  transactionType?: string | null;
  isLegalSafeVerified?: boolean | null;
  createdAt?: string | null;
  featured?: boolean | null;
  badges?: {
    isPartner?: boolean;
    isInvestorPro?: boolean;
  } | null;
};

const FALLBACK_IMAGE = "/fallback-luxury.svg";
const MAX_FEATURED = 6;

const ACTIVE_DEAL_STATUSES = new Set([
  "INITIATED",
  "NEGOTIATION",
  "AGREED",
  "MEETING",
  "IN_DEAL",
]);

function firstImage(offer: Offer, index: number) {
  if (offer.imageUrl) return offer.imageUrl;
  if (Array.isArray(offer.images) && typeof offer.images[0] === "string") return offer.images[0];
  if (typeof offer.images === "string") {
    try {
      const parsed = JSON.parse(offer.images);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    } catch {
      return FALLBACK_IMAGE;
    }
  }
  return FALLBACK_IMAGE;
}

function FeaturedOfferCover({ offer, index }: { offer: Offer; index: number }) {
  const { meta } = useOfferImageMeta(offer.id);
  const src = firstImage(offer, index);
  return (
    <OfferAdaptiveImage
      sdrSrc={src}
      meta={meta[src] || null}
      className="absolute inset-0 h-full w-full"
      imgClassName="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
      alt=""
      loading="lazy"
    />
  );
}

function parsePrice(price: Offer["price"]) {
  const n = Number(String(price ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function FeaturedGallery() {
  const { dict, locale } = useLocale();
  const { formatOffer } = useFormatOfferPrice();
  const reduceMotion = useReducedMotion();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [negotiatingOfferIds, setNegotiatingOfferIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    fetchHomeCatalogJson<Offer[]>("/api/offers")
      .then((json) => {
        if (!cancelled && Array.isArray(json)) {
          const featuredOnly = json.filter((offer: Offer) => offer?.featured === true);
          const pool = featuredOnly.length ? featuredOnly : json;
          setOffers(pool.slice(0, MAX_FEATURED));
        }
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/deals/my", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success || !Array.isArray(json.deals)) return;
        const ids = new Set<number>();
        for (const deal of json.deals) {
          const status = String(deal?.status || "").toUpperCase();
          if (!ACTIVE_DEAL_STATUSES.has(status)) continue;
          const offerId = Number(deal?.offerId ?? deal?.offer?.id);
          if (Number.isFinite(offerId) && offerId > 0) ids.add(offerId);
        }
        setNegotiatingOfferIds(ids);
      })
      .catch(() => {
        if (!cancelled) setNegotiatingOfferIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => offers.slice(0, MAX_FEATURED), [offers]);

  if (!featured.length) {
    return null;
  }

  return (
    <section className="premium-home-surface relative overflow-hidden border-t border-[var(--eos-border)] bg-[var(--eos-bg-elevated)] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_58%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-700/90 dark:text-emerald-400/90">
              {dict.homePremium.galleryEyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-light tracking-tight text-[var(--eos-text)] sm:text-6xl">
              {dict.homePremium.galleryTitle}{" "}
              <span className="font-semibold">{dict.homePremium.galleryTitleHighlight}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)] sm:text-base">
              {dict.homePremium.gallerySubtitle}
            </p>
          </div>
          <Link
            href="/oferty"
            className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 transition-colors hover:text-emerald-600 dark:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {dict.homePremium.galleryViewAll}
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((offer, index) => {
            const location =
              [offer.city, offer.district].filter(Boolean).join(", ") ||
              dict.homePremium.countryDefault;
            const hasActiveDealRoom = negotiatingOfferIds.has(Number(offer.id));
            const priceInfo = formatOffer(offer);
            const isRent = String(offer.transactionType || "").toLowerCase().includes("rent");
            const offerCopy = getOfferPageCopy(locale);
            const isKwVerified = offer.isLegalSafeVerified === true;
            const showNewBadge = isOfferNew(offer.createdAt);
            return (
              <motion.article
                key={offer.id}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px", amount: 0.15 }}
                transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : Math.min(index, 3) * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <GoldFeaturedFrame>
                <Link
                  href={`/oferta/${offer.id}`}
                  className="eos-media-chrome eos-lux-media-card group relative block aspect-[4/5] overflow-hidden bg-[var(--eos-card)]"
                >
                  <FeaturedOfferCover offer={offer} index={index} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/15" />
                  <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 to-transparent" />

                  <div className="absolute left-5 top-5 z-20 inline-flex items-center rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_18px_rgba(212,175,55,0.45)]">
                    {dict.homePremium.carsFeaturedBadge}
                  </div>
                  <div className="absolute left-5 top-[3.35rem] rounded-full border border-white/25 bg-black/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_4px_20px_rgba(0,0,0,0.35)] eos-luxury-media-text">
                    {isRent ? dict.map.forRent : dict.map.forSale}
                  </div>
                  {showNewBadge ? (
                    <OfferNewBadge
                      createdAt={offer.createdAt}
                      className="absolute left-5 top-[5.5rem] z-10"
                    />
                  ) : null}
                  {isKwVerified ? (
                    <LegalVerifiedShieldBadge
                      variant="card"
                      active
                      label={offerCopy.legalVerifiedKw}
                      sublabel={offerCopy.legalVerifiedKwSublabel}
                      className={`absolute left-5 z-10 ${showNewBadge ? "top-[7.65rem]" : "top-[5.5rem]"}`}
                    />
                  ) : null}
                  <OfferFavoriteButton
                    offerId={offer.id}
                    variant="icon"
                    size={20}
                    className={`absolute z-20 ${hasActiveDealRoom ? "right-5 top-16" : "right-5 top-5"}`}
                    onRequireAuth={() => {
                      window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
                    }}
                  />
                  {hasActiveDealRoom && (
                    <div className="featured-deal-room-badge absolute right-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-orange-300/70 bg-orange-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_22px_rgba(249,115,22,0.45)]">
                      <Briefcase className="size-3" />
                      {dict.homePremium.dealRoom}
                    </div>
                  )}

                  <div className="eos-on-media absolute bottom-0 left-0 right-0 p-6 sm:p-7">
                    <div className="eos-offer-caption-glass rounded-2xl p-4 sm:p-5">
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300 eos-luxury-media-text">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{location}</span>
                      </div>
                      <h3 className="eos-luxury-media-text line-clamp-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
                        {offer.title || dict.homePremium.listingFallback}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90">
                        <span className="eos-luxury-media-text text-sm font-bold text-white">
                          {parsePrice(offer.price) > 0
                            ? `${priceInfo.primary}${isRent ? ` ${dict.homePremium.pricePerMonth}` : ""}`
                            : dict.homePremium.priceOnRequest}
                        </span>
                        {priceInfo.secondary ? (
                          <span className="eos-luxury-media-text text-white/80">{priceInfo.secondary}</span>
                        ) : null}
                        {offer.area ? <span className="eos-luxury-media-text text-white/80">{offer.area} m²</span> : null}
                        {offer.rooms ? (
                          <span className="eos-luxury-media-text text-white/80">
                            {offer.rooms} {dict.homePremium.galleryRoomsLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
                </GoldFeaturedFrame>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
