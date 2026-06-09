"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Loader2,
  Building2,
  KeyRound,
  Sparkles,
  BadgePercent,
  Gem,
  LayoutGrid,
  MapPin,
  Navigation,
} from "lucide-react";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { normalizeTransactionType } from "@/lib/transactionType";
import { useLocale } from "@/contexts/LocaleContext";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import LegalVerifiedShieldBadge from "@/components/offer/LegalVerifiedShieldBadge";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatDistanceKm, haversineKm } from "@/lib/geo/haversine";

type CatalogOffer = {
  id: number;
  title?: string | null;
  area?: unknown;
  price?: unknown;
  priceCurrency?: unknown;
  pricePln?: unknown;
  imageUrl?: string | null;
  district?: string | null;
  city?: string | null;
  transactionType?: string | null;
  createdAt?: string | null;
  featured?: boolean | null;
  previousPrice?: unknown;
  oldPrice?: unknown;
  isLegalSafeVerified?: boolean | null;
  badges?: { isPartner?: boolean; isPro?: boolean } | null;
  lat?: number | null;
  lng?: number | null;
  isDiscounted?: boolean | null;
  priceDiscountPercent?: number | null;
};

type GallerySection = "all" | "sale" | "rent" | "newest" | "discounted" | "featured";

const SECTION_ORDER: GallerySection[] = [
  "all",
  "sale",
  "rent",
  "newest",
  "discounted",
  "featured",
];

function formatPriceLabel(
  offer: CatalogOffer,
  formatOffer: ReturnType<typeof useFormatOfferPrice>["formatOffer"],
  perMonthSuffix: string,
): string {
  const info = formatOffer(offer);
  if (info.listingAmount <= 0) return "—";
  const tx = normalizeTransactionType(offer.transactionType);
  return tx === "rent" ? `${info.primary} ${perMonthSuffix}` : info.primary;
}

function formatAreaLabel(offer: CatalogOffer): string {
  const raw = offer.area;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return `${raw} m²`;
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  if (/m²|m2/i.test(s)) return s;
  return `${s} m²`;
}

function formatLocationLabel(offer: CatalogOffer, countryDefault: string): string {
  const parts = [offer.district, offer.city].map((p) => String(p || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : countryDefault;
}

const sectionIcons: Record<GallerySection, typeof LayoutGrid> = {
  all: LayoutGrid,
  sale: Building2,
  rent: KeyRound,
  newest: Sparkles,
  discounted: BadgePercent,
  featured: Gem,
};

export default function CatalogPage() {
  const { dict, locale } = useLocale();
  const labels = dict.catalog;
  const offerCopy = getOfferPageCopy(locale);
  const { formatOffer } = useFormatOfferPrice();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<GallerySection>("all");
  const { location, denied, pending, request } = useUserLocation();

  const nearestCopy =
    locale === "pl"
      ? {
          title: "Najbliższe nieruchomości",
          lead: "Posortowane według odległości od Twojej lokalizacji.",
          enable: "Udostępnij lokalizację",
          denied: "Brak dostępu do lokalizacji — włącz ją w przeglądarce, aby zobaczyć odległości.",
        }
      : locale === "uk"
        ? {
            title: "Найближчі об'єкти",
            lead: "Відсортовано за відстанню від вашої локації.",
            enable: "Надати локацію",
            denied: "Немає доступу до локації — увімкніть її в браузері.",
          }
        : {
            title: "Nearest properties",
            lead: "Sorted by distance from your location.",
            enable: "Share location",
            denied: "Location denied — enable it in the browser to see distances.",
          };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers?t=${Date.now()}`, { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : labels.errorNetwork;
        setError(msg);
        setOffers([]);
        return;
      }
      if (!Array.isArray(data)) {
        setError(labels.errorUnexpected);
        setOffers([]);
        return;
      }
      setOffers(data as CatalogOffer[]);
    } catch {
      setError(labels.errorNetwork);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, [labels.errorNetwork, labels.errorUnexpected]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedByNewest = [...offers].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number(a.id) * 1000;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number(b.id) * 1000;
    return tb - ta;
  });

  const discountedOffers = offers.filter((offer) => {
    if (offer.isDiscounted) return true;
    const current = Number(offer.pricePln ?? offer.price ?? 0);
    const prev = Number(offer.previousPrice ?? offer.oldPrice ?? 0);
    return Number.isFinite(current) && Number.isFinite(prev) && prev > current && current > 0;
  });

  const distanceByOfferId = new Map<number, number>();
  if (location) {
    for (const offer of offers) {
      const lat = Number(offer.lat);
      const lng = Number(offer.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      distanceByOfferId.set(offer.id, haversineKm(location.latitude, location.longitude, lat, lng));
    }
  }

  const nearestOffers = location
    ? [...offers]
        .filter((o) => distanceByOfferId.has(o.id))
        .sort((a, b) => (distanceByOfferId.get(a.id)! - distanceByOfferId.get(b.id)!))
        .slice(0, 6)
    : [];

  const featuredOffers = offers.filter(
    (offer) => offer.featured || offer.badges?.isPartner || offer.badges?.isPro,
  );

  const sectionCounts: Record<GallerySection, number> = {
    all: offers.length,
    sale: offers.filter((o) => normalizeTransactionType(o.transactionType) === "sale").length,
    rent: offers.filter((o) => normalizeTransactionType(o.transactionType) === "rent").length,
    newest: sortedByNewest.length,
    discounted: discountedOffers.length,
    featured: featuredOffers.length,
  };

  const offersInSection = (() => {
    switch (activeSection) {
      case "sale":
        return offers.filter((o) => normalizeTransactionType(o.transactionType) === "sale");
      case "rent":
        return offers.filter((o) => normalizeTransactionType(o.transactionType) === "rent");
      case "newest":
        return sortedByNewest;
      case "discounted":
        return discountedOffers;
      case "featured":
        return featuredOffers.length > 0 ? featuredOffers : sortedByNewest.slice(0, 8);
      default:
        return offers;
    }
  })();

  const resultLabel = labels.resultSummary.replace("{n}", String(offersInSection.length));

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-24 pt-36 md:pt-40 font-sans text-[var(--eos-text)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="mb-10 md:mb-14 border-b border-[var(--eos-border)] pb-8 md:pb-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[var(--eos-text)] md:text-6xl lg:text-7xl">
              {labels.title}
              <span className="block font-serif italic font-normal text-[var(--eos-muted)] mt-1 md:mt-2">
                {labels.subtitle}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base md:text-lg font-light leading-relaxed text-[var(--eos-muted)]">
              {labels.lead}
            </p>
            {!location ? (
              <button
                type="button"
                onClick={request}
                disabled={pending}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 transition hover:bg-emerald-500/15 dark:text-emerald-400"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                {nearestCopy.enable}
              </button>
            ) : denied ? (
              <p className="mt-4 text-xs text-[var(--eos-muted)]">{nearestCopy.denied}</p>
            ) : null}
          </motion.div>

          {!loading && !error && offers.length > 0 && (
            <motion.nav
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-8 md:mt-10"
              aria-label={labels.title}
            >
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none [scrollbar-width:none]">
                {SECTION_ORDER.map((section) => {
                  const Icon = sectionIcons[section];
                  const active = activeSection === section;
                  const count = sectionCounts[section];
                  return (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setActiveSection(section)}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-left transition-all duration-200 border ${
                        active
                          ? "border-emerald-500/40 bg-emerald-500/10 text-[var(--eos-text)] shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                          : "border-transparent bg-transparent text-[var(--eos-muted)] hover:bg-[var(--eos-card)] hover:text-[var(--eos-text)] hover:border-[var(--eos-border)]"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? "text-emerald-500" : "text-[var(--eos-subtle)]"}`}
                        strokeWidth={2.25}
                      />
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] whitespace-nowrap">
                        {labels.sections[section]}
                      </span>
                      <span
                        className={`min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${
                          active
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                            : "bg-[var(--eos-border)]/80 text-[var(--eos-subtle)]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--eos-subtle)]">
                {resultLabel}
                <span className="mx-2 text-[var(--eos-border)]">·</span>
                <span className="text-[var(--eos-muted)]">{labels.sections[activeSection]}</span>
              </p>
            </motion.nav>
          )}
        </header>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-32 text-[var(--eos-muted)]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-9 w-9 animate-spin text-emerald-500/85" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.35em]">{labels.loading}</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-lg rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-10 text-center"
              role="alert"
            >
              <p className="mb-8 text-sm leading-relaxed text-[var(--eos-muted)]">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-8 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20"
              >
                {labels.retry}
              </button>
            </motion.div>
          ) : offersInSection.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center text-sm uppercase tracking-[0.2em] text-[var(--eos-muted)]"
            >
              {labels.empty}
            </motion.p>
          ) : (
            <motion.div
              key={activeSection}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-x-10 md:gap-y-14 lg:gap-x-14"
            >
              {offersInSection.map((offer, i) => (
                <Link href={`/oferta/${offer.id}`} key={offer.id} className="block group">
                  <motion.article
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: Math.min(i * 0.05, 0.35), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-2xl md:rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]">
                      {offer.isLegalSafeVerified === true ? (
                        <LegalVerifiedShieldBadge
                          variant="card"
                          active
                          label={offerCopy.legalVerifiedKw}
                          sublabel={offerCopy.legalVerifiedKwSublabel}
                          className="absolute left-3 top-3 z-10"
                        />
                      ) : null}
                      <OfferFavoriteButton
                        offerId={offer.id}
                        variant="icon"
                        size={20}
                        className="absolute right-3 top-3 z-20"
                        onRequireAuth={() => {
                          window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
                        }}
                      />
                      {offer.isDiscounted && Number(offer.priceDiscountPercent) > 0 ? (
                        <span className="absolute bottom-3 left-3 z-10 rounded-full border border-red-500/40 bg-red-500/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                          −{offer.priceDiscountPercent}%
                        </span>
                      ) : null}
                      {distanceByOfferId.has(offer.id) ? (
                        <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                          <MapPin className="size-3" />
                          {formatDistanceKm(distanceByOfferId.get(offer.id)!, locale)}
                        </span>
                      ) : null}
                      {offer.imageUrl ? (
                        <Image
                          src={offer.imageUrl}
                          alt={
                            offer.title?.trim() ||
                            labels.offerImageAlt.replace("{id}", String(offer.id))
                          }
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
                          unoptimized
                          priority={i < 2}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--eos-border)] to-[var(--eos-bg)]" aria-hidden />
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-4 px-0.5">
                      <div className="min-w-0">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--eos-text)] transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400 line-clamp-2">
                          {offer.title?.trim() ||
                            labels.offerTitleFallback.replace("{id}", String(offer.id))}
                        </h2>
                        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                          {formatAreaLabel(offer)} · {formatLocationLabel(offer, labels.countryDefault)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg md:text-xl font-bold tabular-nums text-[var(--eos-text)]">
                          {formatPriceLabel(offer, formatOffer, dict.homePremium.pricePerMonth)}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-subtle)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {labels.discover}
                          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </motion.article>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && !error && nearestOffers.length > 0 ? (
          <section className="mt-20 border-t border-[var(--eos-border)] pt-14">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--eos-text)] md:text-3xl">
              {nearestCopy.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[var(--eos-muted)]">{nearestCopy.lead}</p>
            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {nearestOffers.map((offer) => (
                <Link href={`/oferta/${offer.id}`} key={`near-${offer.id}`} className="group block">
                  <article className="overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)]">
                    <div className="relative aspect-[4/3]">
                      {offer.imageUrl ? (
                        <Image
                          src={offer.imageUrl}
                          alt={offer.title || labels.offerImageAlt.replace("{id}", String(offer.id))}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                          unoptimized
                        />
                      ) : null}
                      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                        <MapPin className="size-3" />
                        {formatDistanceKm(distanceByOfferId.get(offer.id)!, locale)}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 font-bold text-[var(--eos-text)] group-hover:text-emerald-500">
                        {offer.title?.trim() ||
                          labels.offerTitleFallback.replace("{id}", String(offer.id))}
                      </h3>
                      <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--eos-text)]">
                        {formatPriceLabel(offer, formatOffer, dict.homePremium.pricePerMonth)}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
