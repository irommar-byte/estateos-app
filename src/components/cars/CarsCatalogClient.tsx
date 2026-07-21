"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Car,
  ChevronDown,
  ChevronUp,
  Heart,
  Keyboard,
  Loader2,
  ScanLine,
  Search,
  Upload,
  UserRound,
} from "lucide-react";
import CarFavoriteButton from "@/components/cars/CarFavoriteButton";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";
import {
  CatalogHeroActionRow,
  CatalogHeroSecondaryButton,
} from "@/components/catalog/CatalogHeroActions";
import OtomotoImportHeroCard from "@/components/cars/OtomotoImportHeroCard";
import FeaturedSpotlightCarousel from "@/components/catalog/FeaturedSpotlightCarousel";
import InfiniteHorizontalRail from "@/components/catalog/InfiniteHorizontalRail";
import PromoteListingButton from "@/components/catalog/PromoteListingButton";
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

type AddPath = "scan" | "upload" | "manual" | "otomoto";

type Filters = {
  query: string;
  vehicleType: string;
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
  vehicleType: "",
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

function FilterField({ label, children }: { label: string; children: ReactNode }) {
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

function sortByNewest(rows: EstateOsCarListing[]) {
  return [...rows].sort(
    (a, b) =>
      Date.parse(String(b.createdAt || 0)) -
      Date.parse(String(a.createdAt || 0)),
  );
}

function railTitleByType(type: string, cat: ReturnType<typeof useLocale>["dict"]["cars"]["catalog"]) {
  if (type === "motorcycle") return cat.typeMotorcycle;
  if (type === "van") return cat.typeVan;
  if (type === "truck") return cat.typeTruck;
  return cat.typeCar;
}

export default function CarsCatalogClient() {
  const { dict, locale } = useLocale();
  const cat = dict.cars.catalog;
  const sortOptions = useMemo(() => getCarSortOptions(locale), [locale]);

  const [cars, setCars] = useState<EstateOsCarListing[]>([]);
  const [myCars, setMyCars] = useState<EstateOsCarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMine, setLoadingMine] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  const [activeAddPath, setActiveAddPath] = useState<AddPath | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const loadCars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cars", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as EstateOsCarListing[];
      setCars(Array.isArray(data) ? data : []);
    } catch {
      setCars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const res = await fetch("/api/cars?scope=mine", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        setMyCars([]);
        return;
      }
      const data = (await res.json()) as EstateOsCarListing[];
      setMyCars(Array.isArray(data) ? data : []);
    } catch {
      setMyCars([]);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  const deleteMineCar = useCallback(
    async (carId: number) => {
      if (!window.confirm(dict.cars.owner.confirmDelete)) return;
      setDeletingId(carId);
      try {
        const response = await fetch(`/api/cars/${carId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          alert(typeof data?.error === "string" ? data.error : dict.cars.owner.deleteFailed);
          return;
        }
        setMyCars((prev) => prev.filter((car) => car.id !== carId));
        setCars((prev) => prev.filter((car) => car.id !== carId));
      } catch {
        alert(dict.cars.owner.deleteNetworkError);
      } finally {
        setDeletingId(null);
      }
    },
    [dict.cars.owner.confirmDelete, dict.cars.owner.deleteFailed, dict.cars.owner.deleteNetworkError],
  );

  useEffect(() => {
    setFavoriteIds(loadCarFavoriteIds());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profileRes = await fetch("/api/user/profile", { cache: "no-store", credentials: "include" });
        const profile = await profileRes.json().catch(() => ({}));
        const isLogged = profileRes.ok && Boolean(profile?.id || profile?.user?.id);
        if (cancelled) return;
        setLoggedIn(isLogged);
        await loadCars();
        if (isLogged) await loadMine();
        else setMyCars([]);
      } catch {
        if (!cancelled) {
          setCars([]);
          setMyCars([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCars, loadMine]);

  const makeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const car of cars) {
      const carType = String((car as EstateOsCarListing & { vehicleType?: string }).vehicleType || "car");
      if (filters.vehicleType && carType !== filters.vehicleType) continue;
      const label = String(car.make || "").trim();
      if (!label) continue;
      const key = normalizeLabel(label);
      if (!map.has(key)) map.set(key, label);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], locale))
      .map(([key, label]) => ({ value: key, label }));
  }, [cars, filters.vehicleType, locale]);

  const modelOptions = useMemo(() => {
    if (!filters.make) return [];
    const map = new Map<string, string>();
    for (const car of cars) {
      if (normalizeLabel(car.make) !== normalizeLabel(filters.make)) continue;
      const label = String(car.model || "").trim();
      if (!label) continue;
      const key = normalizeLabel(label);
      if (!map.has(key)) map.set(key, label);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], locale))
      .map(([key, label]) => ({ value: key, label }));
  }, [cars, filters.make, locale]);

  const generationOptions = useMemo(() => {
    if (!filters.make || !filters.model) return [];
    const map = new Map<string, string>();
    for (const car of cars) {
      if (normalizeLabel(car.make) !== normalizeLabel(filters.make)) continue;
      if (normalizeLabel(car.model) !== normalizeLabel(filters.model)) continue;
      const label = String((car as EstateOsCarListing & { generation?: string }).generation || "").trim();
      if (!label) continue;
      const key = normalizeLabel(label);
      if (!map.has(key)) map.set(key, label);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], locale))
      .map(([key, label]) => ({ value: key, label }));
  }, [cars, filters.make, filters.model, locale]);

  const fuelTypes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean))).sort((a, b) => a.localeCompare(b, locale)),
    [cars, locale],
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const maxPrice = Number(filters.maxPrice.replace(/\D/g, ""));
    const rows = cars.filter((car) => {
      const carType = String((car as EstateOsCarListing & { vehicleType?: string }).vehicleType || "car");
      if (filters.vehicleType && carType !== filters.vehicleType) return false;
      if (filters.make && normalizeLabel(car.make) !== normalizeLabel(filters.make)) return false;
      if (filters.model && normalizeLabel(car.model) !== normalizeLabel(filters.model)) return false;
      if (filters.generation) {
        const carGeneration = String((car as EstateOsCarListing & { generation?: string }).generation || "");
        if (carGeneration && normalizeLabel(carGeneration) !== normalizeLabel(filters.generation)) return false;
        if (
          !carGeneration &&
          !normalizeLabel([car.make, car.model, car.title].join(" ")).includes(normalizeLabel(filters.generation))
        ) {
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

  const newestCars = useMemo(() => sortByNewest(cars), [cars]);

  const featuredCars = useMemo(
    () =>
      cars
        .filter((car) => car.featured)
        .sort(
          (a, b) =>
            Date.parse(String(b.promotedUntil || b.createdAt || 0)) -
            Date.parse(String(a.promotedUntil || a.createdAt || 0)),
        ),
    [cars],
  );

  const featuredSpotlightItems = useMemo(
    () =>
      featuredCars.slice(0, 6).map((car) => ({
        id: car.id,
        href: `/cars/${car.id}`,
        title: car.title,
        subtitle: `${car.make} · ${car.model} · ${car.year} · ${car.city}`,
        priceLabel: formatCarPrice(car.pricePln, locale),
        imageUrl: carImageSrc(car.imageUrl),
        badge: cat.featuredBadge,
      })),
    [featuredCars, cat.featuredBadge, locale],
  );

  const typeRails = useMemo(() => {
    const typeOrder = ["motorcycle", "car", "van", "truck"];
    return typeOrder
      .map((type) => ({
        type,
        title: railTitleByType(type, cat),
        items: sortByNewest(
          cars.filter(
            (car) => String((car as EstateOsCarListing & { vehicleType?: string }).vehicleType || "car") === type,
          ),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [cars, cat, locale]);

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

  const statsLabel = !loading
    ? tab === "favorites"
      ? fmtCars(cat.statsFavorites, { n: filtered.length })
      : tab === "mine"
        ? fmtCars(cat.statsMine, { n: filtered.length })
        : fmtCars(cat.statsAll, { n: filtered.length })
    : cat.resultsLoading;

  const showLoginMineBanner = tab === "mine" && !loggedIn;

  const railCard = (car: EstateOsCarListing) => (
    <Link
      href={`/cars/${car.id}`}
      className="group w-[280px] shrink-0 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-sky-400/45 hover:shadow-[0_20px_60px_rgba(14,165,233,0.08)]"
    >
      <div className="relative aspect-[16/10]">
        <Image
          src={carImageSrc(car.imageUrl)}
          alt={car.title}
          fill
          sizes="280px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          unoptimized
        />
      </div>
      <div className="space-y-2 p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">
          {car.make} · {car.model} · {car.year}
        </p>
        <h3 className="line-clamp-2 text-base font-semibold">{car.title}</h3>
        <p className="text-sm text-[var(--eos-muted)]">{car.city} · {formatMileage(car.mileageKm, locale)}</p>
        <p className="text-base font-bold text-sky-300">{formatCarPrice(car.pricePln, locale)}</p>
      </div>
    </Link>
  );

  const chooserTitle =
    locale === "en"
      ? "Choose how you want to add a listing"
      : locale === "uk"
        ? "Оберіть спосіб додавання оголошення"
        : "Wybierz, jak chcesz dodać ogłoszenie";

  const findLabel = cat.findListing;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-32 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <CatalogBrandHero
          brand="car"
          title={cat.heroTitle}
          description={cat.heroDescription}
          stats={statsLabel}
        >
          <CatalogHeroActionRow>
            <button
              type="button"
              onClick={() => {
                setAddChooserOpen((prev) => !prev);
                setActiveAddPath(null);
                setFiltersExpanded(false);
              }}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-3.5 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_10px_28px_rgba(14,165,233,0.38)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-sky-400 hover:shadow-[0_14px_36px_rgba(14,165,233,0.5)]"
            >
              {cat.addListing}
              {addChooserOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <CatalogHeroSecondaryButton
              onClick={() => {
                setFiltersExpanded((prev) => !prev);
                setAddChooserOpen(false);
                setActiveAddPath(null);
              }}
              aria-expanded={filtersExpanded}
            >
              <Search size={16} aria-hidden />
              {findLabel}
              {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </CatalogHeroSecondaryButton>
          </CatalogHeroActionRow>
        </CatalogBrandHero>

        {filtersExpanded ? (
          <section className="mt-4 rounded-[1.75rem] border border-sky-400/20 bg-[var(--eos-card)] p-5 shadow-[0_20px_55px_rgba(14,165,233,0.08)] sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">{cat.filtersEyebrow}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--eos-text)]">{cat.filtersTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="rounded-xl border border-[var(--eos-border)] bg-transparent px-3 py-2 text-[11px] font-semibold text-[var(--eos-muted)] transition hover:border-sky-400/35 hover:text-sky-600 dark:hover:text-sky-300"
              >
                {cat.clearFilters}
              </button>
            </div>

            <div className="grid gap-5">
              <FilterField label={cat.searchLabel}>
                <input
                  value={filters.query}
                  onChange={(e) => setFilter("query", e.target.value)}
                  placeholder={cat.searchPlaceholder}
                  className={filterInputClass}
                />
              </FilterField>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FilterField label={cat.vehicleTypeFilterLabel}>
                  <select
                    value={filters.vehicleType}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        vehicleType: e.target.value,
                        makeSlug: "",
                        make: "",
                        modelSlug: "",
                        model: "",
                        generationSlug: "",
                        generation: "",
                      }))
                    }
                    className={filterInputClass}
                  >
                    <option value="">{cat.allVehicleTypes}</option>
                    <option value="car">{cat.typeCar}</option>
                    <option value="motorcycle">{cat.typeMotorcycle}</option>
                    <option value="van">{cat.typeVan}</option>
                    <option value="truck">{cat.typeTruck}</option>
                  </select>
                </FilterField>

                <FilterField label={cat.makeLabel}>
                  <select value={filters.makeSlug} onChange={(e) => selectMake(e.target.value)} className={filterInputClass}>
                    <option value="">{cat.allMakes}</option>
                    {makeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label={cat.modelLabel}>
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

                <FilterField label={cat.generationLabel}>
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
        ) : null}

        {addChooserOpen ? (
          <section className="mt-4 rounded-[1.75rem] border border-sky-400/20 bg-[var(--eos-card)] p-5 shadow-[0_20px_55px_rgba(14,165,233,0.08)] sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">EstateOS™Car</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--eos-text)]">{chooserTitle}</h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => setActiveAddPath("otomoto")}
                className={`rounded-2xl border p-4 text-left transition ${
                  activeAddPath === "otomoto"
                    ? "border-sky-400/45 bg-sky-500/10"
                    : "border-[var(--eos-border)] bg-[var(--eos-surface)] hover:border-sky-400/40 hover:bg-sky-500/10"
                }`}
              >
                <Car className="size-5 text-sky-500" />
                <p className="mt-3 text-sm font-semibold">Import z Otomoto</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">Wklej link i przenieś treść do formularza.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAddPath("scan");
                  window.location.href = "/cars/dodaj?entry=scan";
                }}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 text-left transition hover:border-sky-400/40 hover:bg-sky-500/10"
              >
                <ScanLine className="size-5 text-sky-500" />
                <p className="mt-3 text-sm font-semibold">Zeskanuj kod aparatem</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">Live skan Aztec z dowodu rejestracyjnego.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAddPath("upload");
                  window.location.href = "/cars/dodaj?entry=upload";
                }}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 text-left transition hover:border-sky-400/40 hover:bg-sky-500/10"
              >
                <Upload className="size-5 text-sky-500" />
                <p className="mt-3 text-sm font-semibold">Dodaj zdjęcie dowodu z kodem</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">Wybierz zdjęcie z plików i odczytaj kod Aztec.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAddPath("manual");
                  window.location.href = "/cars/dodaj?entry=manual";
                }}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4 text-left transition hover:border-sky-400/40 hover:bg-sky-500/10"
              >
                <Keyboard className="size-5 text-sky-500" />
                <p className="mt-3 text-sm font-semibold">Dodaj ręcznie</p>
                <p className="mt-1 text-xs text-[var(--eos-muted)]">Wypełnij formularz samodzielnie od zera.</p>
              </button>
            </div>

            {activeAddPath === "otomoto" ? (
              <div className="mt-4">
                <OtomotoImportHeroCard
                  title={cat.otomotoImportTitle}
                  body={cat.otomotoImportBody}
                  placeholder={cat.otomotoImportPlaceholder}
                  cta={cat.otomotoImportCta}
                  loadingLabel={cat.otomotoImportLoading}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {!loading && featuredSpotlightItems.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">{cat.featuredBadge} · 6</h2>
              <span className="text-xs text-[var(--eos-muted)]">Top oferty</span>
            </div>
            <FeaturedSpotlightCarousel items={featuredSpotlightItems} />
          </section>
        ) : null}

        {!loading && newestCars.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">Najnowsze</h2>
            <InfiniteHorizontalRail
              items={newestCars}
              getKey={(car) => car.id}
              renderItem={(car) => railCard(car)}
            />
          </section>
        ) : null}

        {!loading
          ? typeRails.map((group) => (
              <section key={group.type} className="mt-8">
                <h2 className="mb-3 text-lg font-semibold tracking-tight">{group.title}</h2>
                <InfiniteHorizontalRail
                  items={group.items}
                  getKey={(car) => car.id}
                  renderItem={(car) => railCard(car)}
                />
              </section>
            ))
          : null}

        {showLoginMineBanner ? (
          <div className={`mt-8 ${carAlertWarningClass}`}>
            {cat.loginMineBanner}{" "}
            <Link href="/login?next=/cars" className="font-semibold underline">
              {cat.goLogin}
            </Link>
          </div>
        ) : null}

        <section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
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
          </div>
        </section>

        <p className="mb-4 mt-6 text-xs uppercase tracking-[0.16em] text-[var(--eos-muted)]">
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
