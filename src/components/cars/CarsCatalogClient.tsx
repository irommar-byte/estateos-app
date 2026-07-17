"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Car, Heart, UserRound } from "lucide-react";
import CarFavoriteButton from "@/components/cars/CarFavoriteButton";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import {
  CatalogHeroActionRow,
  CatalogHeroPrimaryLink,
} from "@/components/catalog/CatalogHeroActions";
import OtomotoImportHeroCard from "@/components/cars/OtomotoImportHeroCard";
import FeaturedSpotlightCarousel from "@/components/catalog/FeaturedSpotlightCarousel";
import PromoteListingButton from "@/components/catalog/PromoteListingButton";
import { useCarCatalogOptions } from "@/hooks/useCarCatalogOptions";
import { useLocale } from "@/contexts/LocaleContext";
import type { EstateOsCarListing } from "@/lib/carsCatalog";
import { isCarFavoriteId, loadCarFavoriteIds } from "@/lib/carFavoritesStorage";
import {
  carImageSrc,
  formatCarPrice,
  formatMileage,
  sortCarListings,
  type CarSortKey,
} from "@/lib/carsPresentation";
import { fmtCars, getCarSortOptions } from "@/i18n/carsDictionary";
import { carAlertWarningClass } from "@/components/cars/carFormStyles";

type CatalogTab = "all" | "favorites" | "mine";

type Filters = {
  query: string;
  makeSlug: string;
  make: string;
  modelSlug: string;
  model: string;
  generationSlug: string;
  generation: string;
  fuelType: string;
  maxPrice: string;
  sort: CarSortKey;
};

const EMPTY_FILTERS: Filters = {
  query: "",
  makeSlug: "",
  make: "",
  modelSlug: "",
  model: "",
  generationSlug: "",
  generation: "",
  fuelType: "",
  maxPrice: "",
  sort: "newest",
};

const filterLabelClass =
  "text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]";

const filterInputClass =
  "w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3.5 py-2.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-sky-400/55 focus:ring-2 focus:ring-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className={filterLabelClass}>{label}</span>
      {children}
    </label>
  );
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

export default function CarsCatalogClient() {
  const { dict, locale } = useLocale();
  const cat = dict.cars.catalog;
  const sortOptions = useMemo(() => getCarSortOptions(locale), [locale]);
  const [cars, setCars] = useState<EstateOsCarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CatalogTab>("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const loadCars = useCallback(async (activeTab: CatalogTab, isLoggedIn: boolean) => {
    setLoading(true);
    try {
      const endpoint = activeTab === "mine" && isLoggedIn ? "/api/cars?scope=mine" : "/api/cars";
      const res = await fetch(endpoint, { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as EstateOsCarListing[];
      let rows = Array.isArray(data) ? data : [];
      if (activeTab === "favorites") {
        const ids = loadCarFavoriteIds();
        rows = rows.filter((car) => isCarFavoriteId(car.id, ids));
      }
      setCars(rows);
    } catch {
      setCars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { options: makeOptions, loading: makesLoading } = useCarCatalogOptions("makes", {}, true);
  const { options: modelOptions, loading: modelsLoading } = useCarCatalogOptions(
    "models",
    { make: filters.makeSlug },
    Boolean(filters.makeSlug),
  );
  const { options: generationOptions, loading: generationsLoading } = useCarCatalogOptions(
    "generations",
    { make: filters.makeSlug, model: filters.modelSlug },
    Boolean(filters.makeSlug && filters.modelSlug),
  );

  useEffect(() => {
    setFavoriteIds(loadCarFavoriteIds());
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profileRes = await fetch("/api/user/profile", { cache: "no-store", credentials: "include" });
        const profile = await profileRes.json().catch(() => ({}));
        const isLoggedIn = profileRes.ok && Boolean(profile?.id || profile?.user?.id);
        if (!cancelled) setLoggedIn(isLoggedIn);
        if (!cancelled) await loadCars(tab, isLoggedIn);
      } catch {
        if (!cancelled) setCars([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, loadCars]);

  const fuelTypes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean))).sort((a, b) => a.localeCompare(b, locale)),
    [cars, locale],
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const maxPrice = Number(filters.maxPrice.replace(/\D/g, ""));
    const rows = cars.filter((car) => {
      if (filters.make && normalizeLabel(car.make) !== normalizeLabel(filters.make)) return false;
      if (filters.model && normalizeLabel(car.model) !== normalizeLabel(filters.model)) return false;
      if (filters.generation) {
        const carGeneration = String((car as EstateOsCarListing & { generation?: string }).generation || "");
        if (carGeneration && normalizeLabel(carGeneration) !== normalizeLabel(filters.generation)) return false;
        if (!carGeneration && !normalizeLabel([car.make, car.model, car.title].join(" ")).includes(normalizeLabel(filters.generation))) {
          return false;
        }
      }
      if (filters.fuelType && car.fuelType !== filters.fuelType) return false;
      if (Number.isFinite(maxPrice) && maxPrice > 0 && car.pricePln > maxPrice) return false;
      if (!q) return true;
      const haystack = [car.title, car.make, car.model, car.city, car.fuelType].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return sortCarListings(rows, filters.sort);
  }, [cars, filters]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const selectMake = (slug: string) => {
    const option = makeOptions.find((item) => item.value === slug);
    setFilters((prev) => ({
      ...prev,
      makeSlug: slug,
      make: option?.label || "",
      modelSlug: "",
      model: "",
      generationSlug: "",
      generation: "",
    }));
  };

  const selectModel = (slug: string) => {
    const option = modelOptions.find((item) => item.value === slug);
    setFilters((prev) => ({
      ...prev,
      modelSlug: slug,
      model: option?.label || "",
      generationSlug: "",
      generation: "",
    }));
  };

  const selectGeneration = (slug: string) => {
    const option = generationOptions.find((item) => item.value === slug);
    setFilters((prev) => ({
      ...prev,
      generationSlug: slug,
      generation: option?.label || "",
    }));
  };

  const catalogScopeClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold tracking-[-0.01em] transition ${
      active
        ? "bg-sky-500/15 text-sky-700 ring-1 ring-sky-400/35 dark:text-sky-300"
        : "text-[var(--eos-muted)] hover:bg-[var(--eos-surface)] hover:text-[var(--eos-text)]"
    }`;

  const spotlightItems = useMemo(
    () =>
      cars
        .filter((car) => car.featured)
        .sort(
          (a, b) =>
            Date.parse(String(b.promotedUntil || b.createdAt || 0)) -
            Date.parse(String(a.promotedUntil || a.createdAt || 0)),
        )
        .map((car) => ({
          id: car.id,
          href: `/cars/${car.id}`,
          title: car.title,
          subtitle: `${car.make} · ${car.model} · ${car.year} · ${car.city}`,
          priceLabel: formatCarPrice(car.pricePln, locale),
          imageUrl: carImageSrc(car.imageUrl),
          badge: cat.featuredBadge,
        })),
    [cars, cat.featuredBadge, locale],
  );

  const statsLabel = !loading
    ? tab === "favorites"
      ? fmtCars(cat.statsFavorites, { n: filtered.length, total: favoriteIds.length })
      : tab === "mine"
        ? fmtCars(cat.statsMine, { n: filtered.length })
        : fmtCars(cat.statsAll, { n: cars.length })
    : null;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <CatalogBrandHero
          brand="car"
          title={cat.heroTitle}
          description={cat.heroDescription}
          stats={statsLabel}
        >
          <CatalogHeroActionRow>
            <CatalogHeroPrimaryLink brand="car" href="/cars/dodaj">
              {cat.addListing}
            </CatalogHeroPrimaryLink>
          </CatalogHeroActionRow>
          <div className="mt-4 max-w-2xl">
            <OtomotoImportHeroCard
              title={cat.otomotoImportTitle}
              body={cat.otomotoImportBody}
              placeholder={cat.otomotoImportPlaceholder}
              cta={cat.otomotoImportCta}
              loadingLabel={cat.otomotoImportLoading}
            />
          </div>
        </CatalogBrandHero>

        {tab === "mine" && !loggedIn && !loading ? (
          <div className={`mb-6 ${carAlertWarningClass}`}>
            {cat.loginMineBanner}{" "}
            <Link href="/login" className="font-bold underline underline-offset-2">
              {cat.goLogin}
            </Link>
          </div>
        ) : null}

        {tab === "favorites" && !loading && favoriteIds.length === 0 ? (
          <div className="mb-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-sm text-[var(--eos-muted)]">
            {cat.favoritesEmpty}
          </div>
        ) : null}

        <section className="mb-8 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_22px_70px_rgba(14,165,233,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--eos-border)] bg-gradient-to-r from-sky-500/[0.07] via-transparent to-cyan-500/[0.04] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">{cat.filtersEyebrow}</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)]">{cat.filtersTitle}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex items-center gap-0.5 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/80 p-1"
                role="tablist"
                aria-label={cat.filtersTitle}
              >
                <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")} className={catalogScopeClass(tab === "all")}>
                  <Car size={13} aria-hidden />
                  {cat.tabAll}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "favorites"}
                  onClick={() => setTab("favorites")}
                  className={catalogScopeClass(tab === "favorites")}
                >
                  <Heart size={13} className={tab === "favorites" ? "fill-current" : ""} aria-hidden />
                  {cat.tabFavorites}
                </button>
                <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={catalogScopeClass(tab === "mine")}>
                  <UserRound size={13} aria-hidden />
                  {cat.tabMine}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="rounded-xl border border-[var(--eos-border)] bg-transparent px-3 py-2 text-[11px] font-semibold text-[var(--eos-muted)] transition hover:border-sky-400/35 hover:text-sky-600 dark:hover:text-sky-300"
              >
                {cat.clearFilters}
              </button>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-6">
            <FilterField label={cat.searchLabel}>
              <input
                value={filters.query}
                onChange={(e) => setFilter("query", e.target.value)}
                placeholder={cat.searchPlaceholder}
                className={filterInputClass}
              />
            </FilterField>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FilterField label={`${cat.makeLabel}${makesLoading ? "…" : ""}`}>
                <select value={filters.makeSlug} onChange={(e) => selectMake(e.target.value)} className={filterInputClass}>
                  <option value="">{cat.allMakes}</option>
                  {makeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label={`${cat.modelLabel}${modelsLoading ? "…" : ""}`}>
                <select
                  value={filters.modelSlug}
                  onChange={(e) => selectModel(e.target.value)}
                  disabled={!filters.makeSlug}
                  className={filterInputClass}
                >
                  <option value="">{filters.makeSlug ? cat.allModels : cat.pickMakeFirst}</option>
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label={`${cat.generationLabel}${generationsLoading ? "…" : ""}`}>
                <select
                  value={filters.generationSlug}
                  onChange={(e) => selectGeneration(e.target.value)}
                  disabled={!filters.modelSlug}
                  className={filterInputClass}
                >
                  <option value="">{filters.modelSlug ? cat.allGenerations : cat.pickModelFirst}</option>
                  {generationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FilterField label={cat.fuelLabel}>
                <select
                  value={filters.fuelType}
                  onChange={(e) => setFilter("fuelType", e.target.value)}
                  className={filterInputClass}
                >
                  <option value="">{cat.allFuels}</option>
                  {fuelTypes.map((fuel) => (
                    <option key={fuel} value={fuel}>
                      {fuel}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label={cat.sortLabel}>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilter("sort", e.target.value as CarSortKey)}
                  className={filterInputClass}
                >
                  {sortOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label={cat.maxPriceLabel}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={filters.maxPrice}
                  onChange={(e) =>
                    setFilter("maxPrice", e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "))
                  }
                  placeholder={cat.maxPricePlaceholder}
                  className={filterInputClass}
                />
              </FilterField>
            </div>
          </div>
        </section>

        <p className="mb-4 text-xs uppercase tracking-[0.16em] text-[var(--eos-muted)]">
          {loading
            ? dict.cars.common.loading
            : fmtCars(cat.resultsCount, { filtered: filtered.length, total: cars.length })}
        </p>

        {loading ? (
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--eos-muted)]">{cat.loadingOffers}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
            <p className="text-sm text-[var(--eos-muted)]">{cat.noResults}</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-4 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em]"
            >
              {cat.clearFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((car) => (
              <Link
                key={car.id}
                href={`/cars/${car.id}`}
                className="group overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-sky-400/45 hover:shadow-[0_20px_60px_rgba(14,165,233,0.08)]"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={carImageSrc(car.imageUrl)}
                    alt={car.title}
                    fill
                    sizes="(max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    unoptimized
                  />
                  <div className="absolute right-3 top-3">
                    <CarFavoriteButton
                      carId={car.id}
                      onChange={(ids) => {
                        setFavoriteIds(ids);
                        if (tab === "favorites") {
                          setCars((prev) => prev.filter((row) => isCarFavoriteId(row.id, ids)));
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">
                    {car.make} · {car.model} · {car.year}
                  </p>
                  <h2 className="line-clamp-2 text-lg font-semibold">{car.title}</h2>
                  <p className="text-sm text-[var(--eos-muted)]">
                    {car.city} · {formatMileage(car.mileageKm, locale)} · {car.fuelType}
                  </p>
                  <p className="text-lg font-bold text-sky-300">{formatCarPrice(car.pricePln, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
