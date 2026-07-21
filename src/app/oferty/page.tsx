"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  ChevronDown,
  ChevronUp,
  Gem,
  Heart,
  Home,
  LandPlot,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Store,
  UserRound,
} from "lucide-react";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { normalizeTransactionType } from "@/lib/transactionType";
import { useLocale } from "@/contexts/LocaleContext";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import LegalVerifiedShieldBadge from "@/components/offer/LegalVerifiedShieldBadge";
import OfferNewBadge from "@/components/offer/OfferNewBadge";
import OfferTransactionBadge from "@/components/offer/OfferTransactionBadge";
import { isOfferNew } from "@/lib/offerNewBadge";
import CatalogTransactionToggle, {
  type CatalogTransactionMode,
} from "@/components/catalog/CatalogTransactionToggle";
import CatalogLocationFilter, {
  offerMatchesCatalogLocationFilter,
  type CatalogLocationFilterValue,
} from "@/components/catalog/CatalogLocationFilter";
import CatalogPropertyTypeToggle, {
  type CatalogPropertyTypeFilter,
} from "@/components/catalog/CatalogPropertyTypeToggle";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import {
  CatalogHeroActionRow,
  CatalogHeroPrimaryLink,
  CatalogHeroSecondaryButton,
} from "@/components/catalog/CatalogHeroActions";
import FeaturedSpotlightCarousel from "@/components/catalog/FeaturedSpotlightCarousel";
import InfiniteHorizontalRail from "@/components/catalog/InfiniteHorizontalRail";
import PromoteListingButton from "@/components/catalog/PromoteListingButton";
import { useFavorites } from "@/hooks/useFavorites";
import { getOfferPageCopy } from "@/content/offerPageCopy";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatDistanceKm, haversineKm } from "@/lib/geo/haversine";
import { computePriceDiscountPercent } from "@/lib/offerPriceHistoryShared";

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
  promotedUntil?: string | null;
  propertyType?: string | null;
  status?: string | null;
  previousPrice?: unknown;
  oldPrice?: unknown;
  listPricePln?: unknown;
  localityCountry?: string | null;
  localityCountryCode?: string | null;
  isLegalSafeVerified?: boolean | null;
  badges?: { isPartner?: boolean; isPro?: boolean } | null;
  lat?: number | null;
  lng?: number | null;
  isDiscounted?: boolean | null;
  priceDiscountPercent?: number | null;
};

type PropertyRailKey = "FLAT" | "HOUSE" | "PLOT" | "COMMERCIAL";

const PROPERTY_RAIL_ORDER: PropertyRailKey[] = ["FLAT", "HOUSE", "PLOT", "COMMERCIAL"];

const PROPERTY_RAIL_META: Record<
  PropertyRailKey,
  { icon: typeof Home; pl: string; en: string; uk: string }
> = {
  FLAT: { icon: Home, pl: "Mieszkania", en: "Apartments", uk: "Квартири" },
  HOUSE: { icon: Building2, pl: "Domy", en: "Houses", uk: "Будинки" },
  PLOT: { icon: LandPlot, pl: "Działki", en: "Plots", uk: "Ділянки" },
  COMMERCIAL: { icon: Store, pl: "Lokale", en: "Commercial", uk: "Комерція" },
};

function sortByNewest(items: CatalogOffer[]) {
  return [...items].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number(a.id) * 1000;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number(b.id) * 1000;
    return tb - ta;
  });
}

function offerListPricePln(offer: CatalogOffer): number {
  return Number(offer.previousPrice ?? offer.oldPrice ?? offer.listPricePln ?? 0);
}

function offerDiscountPercent(offer: CatalogOffer): number | null {
  const fromApi = Number(offer.priceDiscountPercent);
  if (Number.isFinite(fromApi) && fromApi > 0) return Math.round(fromApi);
  const current = Number(offer.pricePln ?? offer.price ?? 0);
  return computePriceDiscountPercent(offerListPricePln(offer), current);
}

function isDiscountedOffer(offer: CatalogOffer) {
  if (offer.isDiscounted) return true;
  return offerDiscountPercent(offer) != null;
}

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

export default function CatalogPage() {
  const { dict, locale } = useLocale();
  const labels = dict.catalog;
  const offerCopy = getOfferPageCopy(locale);
  const { formatOffer } = useFormatOfferPrice();
  const { favoriteOffers: favoriteOfferRecords } = useFavorites();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [myOffers, setMyOffers] = useState<CatalogOffer[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMine, setLoadingMine] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transactionMode, setTransactionMode] = useState<CatalogTransactionMode>("sale");
  const [locationFilter, setLocationFilter] = useState<CatalogLocationFilterValue>({
    countryCode: null,
    city: null,
    district: null,
  });
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<CatalogPropertyTypeFilter>("ALL");
  const [strictCityDistricts, setStrictCityDistricts] = useState<Record<string, string[]>>({});
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const { location, denied, pending, request } = useUserLocation();

  const accent = transactionMode;
  const accentText = accent === "rent" ? "text-sky-500" : "text-emerald-500";
  const accentBorderHover =
    accent === "rent"
      ? "hover:border-sky-400/45 hover:shadow-[0_20px_60px_rgba(14,165,233,0.08)]"
      : "hover:border-emerald-400/45 hover:shadow-[0_20px_60px_rgba(16,185,129,0.08)]";
  const accentPrice = accent === "rent" ? "text-sky-600 dark:text-sky-300" : "text-emerald-600 dark:text-emerald-300";

  const nearestCopy =
    locale === "pl"
      ? {
          title: "Najbliższe",
          enable: "Udostępnij lokalizację",
          denied: "Brak dostępu do lokalizacji — włącz ją w przeglądarce, aby zobaczyć odległości.",
        }
      : locale === "uk"
        ? {
            title: "Найближчі",
            enable: "Надати локацію",
            denied: "Немає доступу до локації — увімкніть її в браузері.",
          }
        : {
            title: "Nearest",
            enable: "Share location",
            denied: "Location denied — enable it in the browser to see distances.",
          };

  const railTitles = {
    favorites: locale === "en" ? "Favorites" : locale === "uk" ? "Обране" : "Ulubione",
    featured:
      locale === "en" ? "Featured" : locale === "uk" ? "Рекомендовані" : "Wyróżnione",
    newest: locale === "en" ? "Newest" : locale === "uk" ? "Найновіші" : "Najnowsze",
    discounted:
      locale === "en" ? "Discounted" : locale === "uk" ? "Зі знижкою" : "Przecenione",
    mine: locale === "en" ? "My listings" : locale === "uk" ? "Мої" : "Moje",
    filtersEyebrow:
      locale === "en" ? "Search" : locale === "uk" ? "Пошук" : "Parametry wyszukiwania",
    filtersTitle:
      locale === "en" ? "Find a property" : locale === "uk" ? "Знайдіть нерухомість" : "Znajdź nieruchomość",
    findCta: locale === "en" ? "Find" : locale === "uk" ? "Знайти" : "Znajdź",
    topOffers: locale === "en" ? "Top listings" : locale === "uk" ? "Топ оголошення" : "Top oferty",
  };

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch(`/api/offers?scope=mine&t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        setMyOffers([]);
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      setMyOffers(Array.isArray(data) ? (data as CatalogOffer[]) : []);
    } catch {
      setMyOffers([]);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const archiveOffer = useCallback(async (offerId: number) => {
    if (!window.confirm("Zakończyć publikację tego ogłoszenia?")) return;
    setArchivingId(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}/archive`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "Nie udało się zarchiwizować ogłoszenia.");
        return;
      }
      setMyOffers((prev) => prev.filter((offer) => offer.id !== offerId));
    } catch {
      alert("Błąd sieci podczas archiwizacji.");
    } finally {
      setArchivingId(null);
    }
  }, []);

  const loadAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      const isLoggedIn = Boolean(data?.loggedIn && data?.user?.id);
      setLoggedIn(isLoggedIn);
      if (isLoggedIn) void loadMine();
    } catch {
      setLoggedIn(false);
    }
  }, [loadMine]);

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
    void loadAuth();
  }, [load, loadAuth]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/location/districts", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.strictCityDistricts && typeof json.strictCityDistricts === "object") {
          setStrictCityDistricts(json.strictCityDistricts as Record<string, string[]>);
        }
      })
      .catch(() => {
        if (!cancelled) setStrictCityDistricts({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saleOffers = useMemo(
    () => offers.filter((o) => normalizeTransactionType(o.transactionType) === "sale"),
    [offers],
  );
  const rentOffers = useMemo(
    () => offers.filter((o) => normalizeTransactionType(o.transactionType) === "rent"),
    [offers],
  );
  const transactionOffers = transactionMode === "sale" ? saleOffers : rentOffers;

  const locationFilteredOffers = useMemo(
    () => transactionOffers.filter((offer) => offerMatchesCatalogLocationFilter(offer, locationFilter)),
    [transactionOffers, locationFilter],
  );

  const propertyTypeCounts = useMemo(() => {
    const counts: Record<CatalogPropertyTypeFilter, number> = {
      ALL: transactionOffers.length,
      FLAT: 0,
      HOUSE: 0,
      PLOT: 0,
      COMMERCIAL: 0,
    };
    for (const offer of transactionOffers) {
      const key = String(offer.propertyType || "").toUpperCase() as CatalogPropertyTypeFilter;
      if (key in counts && key !== "ALL") counts[key] += 1;
    }
    return counts;
  }, [transactionOffers]);

  const browseOffers = useMemo(() => {
    if (propertyTypeFilter === "ALL") return locationFilteredOffers;
    return locationFilteredOffers.filter(
      (offer) => String(offer.propertyType || "").toUpperCase() === propertyTypeFilter,
    );
  }, [locationFilteredOffers, propertyTypeFilter]);

  const distanceByOfferId = useMemo(() => {
    const map = new Map<number, number>();
    if (!location) return map;
    for (const offer of browseOffers) {
      const lat = Number(offer.lat);
      const lng = Number(offer.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      map.set(offer.id, haversineKm(location.latitude, location.longitude, lat, lng));
    }
    return map;
  }, [browseOffers, location]);

  const featuredOffers = useMemo(
    () =>
      sortByNewest(browseOffers.filter((offer) => offer.featured)).sort(
        (a, b) =>
          Date.parse(String(b.promotedUntil || b.createdAt || 0)) -
          Date.parse(String(a.promotedUntil || a.createdAt || 0)),
      ),
    [browseOffers],
  );

  const newestOffers = useMemo(() => sortByNewest(browseOffers), [browseOffers]);
  const favoriteOffers = useMemo(() => {
    const rows = (favoriteOfferRecords as CatalogOffer[]).filter(
      (offer) => normalizeTransactionType(offer.transactionType) === transactionMode,
    );
    return sortByNewest(rows);
  }, [favoriteOfferRecords, transactionMode]);
  const discountedOffers = useMemo(
    () => sortByNewest(browseOffers.filter(isDiscountedOffer)),
    [browseOffers],
  );
  const nearestOffers = useMemo(() => {
    if (!location) return [];
    return [...browseOffers]
      .filter((o) => distanceByOfferId.has(o.id))
      .sort((a, b) => (distanceByOfferId.get(a.id)! - distanceByOfferId.get(b.id)!));
  }, [browseOffers, distanceByOfferId, location]);

  const typeRails = useMemo(() => {
    return PROPERTY_RAIL_ORDER.map((type) => {
      const meta = PROPERTY_RAIL_META[type];
      const title = locale === "en" ? meta.en : locale === "uk" ? meta.uk : meta.pl;
      const source =
        propertyTypeFilter === "ALL" || propertyTypeFilter === type
          ? locationFilteredOffers.filter((o) => String(o.propertyType || "").toUpperCase() === type)
          : [];
      return {
        type,
        title,
        icon: meta.icon,
        items: sortByNewest(source),
      };
    }).filter((rail) => rail.items.length > 0);
  }, [locale, locationFilteredOffers, propertyTypeFilter]);

  const filteredMyOffers = useMemo(
    () => myOffers.filter((o) => normalizeTransactionType(o.transactionType) === transactionMode),
    [myOffers, transactionMode],
  );

  const spotlightItems = useMemo(
    () =>
      featuredOffers.slice(0, 6).map((offer) => ({
        id: offer.id,
        href: `/oferta/${offer.id}`,
        title: offer.title?.trim() || labels.offerTitleFallback.replace("{id}", String(offer.id)),
        subtitle: formatLocationLabel(offer, labels.countryDefault),
        priceLabel: formatPriceLabel(offer, formatOffer, dict.homePremium.pricePerMonth),
        imageUrl: offer.imageUrl || "/fallback-luxury.svg",
        badge: railTitles.featured,
      })),
    [featuredOffers, labels, formatOffer, dict.homePremium.pricePerMonth, railTitles.featured],
  );

  const railCard = (offer: CatalogOffer, opts?: { showDistance?: boolean }) => {
    const showNewBadge = isOfferNew(offer.createdAt);
    const distance = distanceByOfferId.get(offer.id);
    return (
      <Link
        href={`/oferta/${offer.id}`}
        className={`group w-[280px] shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition ${accentBorderHover}`}
      >
        <div className="relative aspect-[16/10]">
          <Image
            src={offer.imageUrl || "/fallback-luxury.svg"}
            alt={offer.title?.trim() || labels.offerImageAlt.replace("{id}", String(offer.id))}
            fill
            sizes="280px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            unoptimized
          />
          <OfferTransactionBadge
            transactionType={offer.transactionType}
            size="sm"
            className="absolute left-3 top-3 z-10"
          />
          {showNewBadge ? (
            <OfferNewBadge createdAt={offer.createdAt} size="sm" className="absolute left-3 top-10 z-10" />
          ) : null}
          {offer.isLegalSafeVerified === true ? (
            <LegalVerifiedShieldBadge
              variant="card"
              active
              label={offerCopy.legalVerifiedKw}
              sublabel={offerCopy.legalVerifiedKwSublabel}
              className={`absolute left-3 z-10 ${showNewBadge ? "top-[4.75rem]" : "top-10"}`}
            />
          ) : null}
          <OfferFavoriteButton
            offerId={offer.id}
            variant="icon"
            size={18}
            className="absolute right-3 top-3 z-20"
            onRequireAuth={() => {
              window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
            }}
          />
          {(() => {
            const discountPct = offerDiscountPercent(offer);
            if (discountPct == null || discountPct <= 0) return null;
            return (
              <span className="absolute bottom-3 left-3 z-10 rounded-full border border-red-500/40 bg-red-500/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                −{discountPct}%
              </span>
            );
          })()}
          {opts?.showDistance && distance != null ? (
            <span className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-black/55 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
              <MapPin className="size-3" />
              {formatDistanceKm(distance, locale)}
            </span>
          ) : null}
        </div>
        <div className="space-y-2 p-4">
          <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${accentText}`}>
            {formatAreaLabel(offer)} · {formatLocationLabel(offer, labels.countryDefault)}
          </p>
          <h3 className="line-clamp-2 text-base font-semibold text-[var(--eos-text)]">
            {offer.title?.trim() || labels.offerTitleFallback.replace("{id}", String(offer.id))}
          </h3>
          <p className={`text-base font-bold tabular-nums ${accentPrice}`}>
            {formatPriceLabel(offer, formatOffer, dict.homePremium.pricePerMonth)}
          </p>
        </div>
      </Link>
    );
  };

  const RailSection = ({
    title,
    icon: Icon,
    children,
    trailing,
  }: {
    title: string;
    icon?: typeof Sparkles;
    children: ReactNode;
    trailing?: React.ReactNode;
  }) => (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[var(--eos-text)]">
          {Icon ? <Icon className={`size-4 ${accentText}`} aria-hidden /> : null}
          {title}
        </h2>
        {trailing}
      </div>
      {children}
    </section>
  );

  return (
    <main
      className={`theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-24 pt-36 md:pt-40 font-sans text-[var(--eos-text)] transition-colors duration-500 ${
        transactionMode === "rent" ? "catalog-accent-rent" : "catalog-accent-sale"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <CatalogBrandHero
          brand="home"
          accent={transactionMode}
          title={`${labels.title} ${labels.subtitle}`}
          description={labels.lead}
          stats={!loading && !error ? `${browseOffers.length} aktywnych ogłoszeń w katalogu` : null}
        >
          <CatalogHeroActionRow>
            <CatalogHeroPrimaryLink brand="home" accent={transactionMode} href="/dodaj-oferte">
              Dodaj ogłoszenie
            </CatalogHeroPrimaryLink>
            <CatalogHeroSecondaryButton
              onClick={() => setFiltersExpanded((prev) => !prev)}
              aria-expanded={filtersExpanded}
            >
              <Search size={16} aria-hidden />
              {railTitles.findCta}
              {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </CatalogHeroSecondaryButton>
          </CatalogHeroActionRow>
        </CatalogBrandHero>

        {!loading && !error && filtersExpanded ? (
          <section
            className={`mt-4 rounded-[1.75rem] border bg-[var(--eos-card)] p-5 shadow-[0_20px_55px_rgba(15,23,42,0.07)] sm:p-6 ${
              transactionMode === "rent" ? "border-sky-400/20" : "border-emerald-400/20"
            }`}
          >
            <div className="mb-5">
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${accentText}`}>
                {railTitles.filtersEyebrow}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--eos-text)]">
                {railTitles.filtersTitle}
              </h2>
            </div>
            <div className="space-y-5">
              <CatalogTransactionToggle
                value={transactionMode}
                onChange={setTransactionMode}
                labels={labels.transactionToggle}
                saleCount={saleOffers.length}
                rentCount={rentOffers.length}
              />
              <CatalogPropertyTypeToggle
                value={propertyTypeFilter}
                onChange={setPropertyTypeFilter}
                counts={propertyTypeCounts}
                accent={transactionMode}
              />
              <CatalogLocationFilter
                offers={transactionOffers}
                value={locationFilter}
                onChange={setLocationFilter}
                labels={labels.locationFilter}
                strictCityDistricts={strictCityDistricts}
                accent={transactionMode}
              />
            </div>
          </section>
        ) : null}

        {loading ? (
          <div
            className="flex flex-col items-center justify-center gap-4 py-32 text-[var(--eos-muted)]"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-9 w-9 animate-spin text-emerald-500/85" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-[0.35em]">{labels.loading}</p>
          </div>
        ) : error ? (
          <div
            className="mx-auto mt-10 max-w-lg rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-10 text-center"
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
          </div>
        ) : (
          <>
            <RailSection title={railTitles.favorites} icon={Heart}>
              {favoriteOffers.length > 0 ? (
                <InfiniteHorizontalRail
                  items={favoriteOffers}
                  getKey={(offer) => offer.id}
                  renderItem={(offer) => railCard(offer)}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 py-6">
                  <p className="text-sm text-[var(--eos-muted)]">{labels.favoritesEmpty}</p>
                </div>
              )}
            </RailSection>

            {spotlightItems.length > 0 ? (
              <RailSection
                title={`${railTitles.featured} · 6`}
                icon={Gem}
                trailing={<span className="text-xs text-[var(--eos-muted)]">{railTitles.topOffers}</span>}
              >
                <FeaturedSpotlightCarousel items={spotlightItems} accent="home" />
              </RailSection>
            ) : null}

            {newestOffers.length > 0 ? (
              <RailSection title={railTitles.newest} icon={Sparkles}>
                <InfiniteHorizontalRail
                  items={newestOffers}
                  getKey={(offer) => offer.id}
                  renderItem={(offer) => railCard(offer)}
                />
              </RailSection>
            ) : null}

            <RailSection title={nearestCopy.title} icon={Navigation}>
              {location && nearestOffers.length > 0 ? (
                <InfiniteHorizontalRail
                  items={nearestOffers}
                  getKey={(offer) => offer.id}
                  renderItem={(offer) => railCard(offer, { showDistance: true })}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 py-6">
                  <p className="text-sm text-[var(--eos-muted)]">
                    {denied ? nearestCopy.denied : labels.nearestRequiresLocation}
                  </p>
                  {!denied ? (
                    <button
                      type="button"
                      onClick={() => void request()}
                      disabled={pending}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600 transition hover:bg-emerald-500/15 dark:text-emerald-400"
                    >
                      {pending ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                      {nearestCopy.enable}
                    </button>
                  ) : null}
                </div>
              )}
            </RailSection>

            {discountedOffers.length > 0 ? (
              <RailSection title={railTitles.discounted} icon={BadgePercent}>
                <InfiniteHorizontalRail
                  items={discountedOffers}
                  getKey={(offer) => offer.id}
                  renderItem={(offer) => railCard(offer)}
                />
              </RailSection>
            ) : null}

            {typeRails.map((rail) => (
              <RailSection key={rail.type} title={rail.title} icon={rail.icon}>
                <InfiniteHorizontalRail
                  items={rail.items}
                  getKey={(offer) => offer.id}
                  renderItem={(offer) => railCard(offer)}
                />
              </RailSection>
            ))}

            <RailSection title={railTitles.mine} icon={UserRound}>
              {!loggedIn ? (
                <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 py-6 text-center sm:text-left">
                  <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{labels.mineRequiresLogin}</p>
                  <Link
                    href={`/login?redirect=${encodeURIComponent("/oferty")}`}
                    className="mt-4 inline-flex rounded-full border border-emerald-500/35 bg-emerald-500/10 px-6 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600 transition hover:bg-emerald-500/15 dark:text-emerald-400"
                  >
                    {labels.mineLoginCta}
                  </Link>
                </div>
              ) : loadingMine ? (
                <div className="flex items-center gap-3 py-8 text-[var(--eos-muted)]">
                  <Loader2 className="size-5 animate-spin text-emerald-500/85" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">{labels.loading}</span>
                </div>
              ) : filteredMyOffers.length === 0 ? (
                <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-5 py-6">
                  <p className="text-sm text-[var(--eos-muted)]">{labels.empty}</p>
                  <Link
                    href="/dodaj-oferte"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    Dodaj ogłoszenie <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredMyOffers.map((offer) => (
                    <article
                      key={offer.id}
                      className="flex flex-col gap-4 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:flex-row sm:items-center"
                    >
                      <Link
                        href={`/oferta/${offer.id}`}
                        className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-[var(--eos-border)] sm:w-48"
                      >
                        <Image
                          src={offer.imageUrl || "/fallback-luxury.svg"}
                          alt={offer.title || `Oferta ${offer.id}`}
                          fill
                          sizes="192px"
                          className="object-cover"
                          unoptimized
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/oferta/${offer.id}`} className="block group">
                          <h3 className="text-lg font-bold tracking-tight text-[var(--eos-text)] group-hover:text-emerald-500">
                            {offer.title?.trim() || labels.offerTitleFallback.replace("{id}", String(offer.id))}
                          </h3>
                          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--eos-muted)]">
                            {formatAreaLabel(offer)} · {formatLocationLabel(offer, labels.countryDefault)}
                          </p>
                          <p className="mt-2 text-base font-bold tabular-nums">
                            {formatPriceLabel(offer, formatOffer, dict.homePremium.pricePerMonth)}
                          </p>
                          {offer.featured ? (
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                              Wyróżnione do{" "}
                              {offer.promotedUntil
                                ? new Date(offer.promotedUntil).toLocaleDateString("pl-PL")
                                : "—"}
                            </p>
                          ) : null}
                        </Link>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/edytuj-oferte/${offer.id}`}
                            className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-500"
                          >
                            Edytuj
                          </Link>
                          <PromoteListingButton
                            endpoint={`/api/offers/${offer.id}/promote`}
                            onPromoted={() => void loadMine()}
                            disabled={Boolean(offer.featured)}
                          />
                          <button
                            type="button"
                            onClick={() => void archiveOffer(offer.id)}
                            disabled={archivingId === offer.id}
                            className="rounded-full border border-red-400/35 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-400 disabled:opacity-60"
                          >
                            {archivingId === offer.id ? "Kończenie..." : "Zakończ"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </RailSection>
          </>
        )}
      </div>
    </main>
  );
}
