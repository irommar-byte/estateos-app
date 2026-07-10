"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Car, Heart, UserRound } from "lucide-react";
import CarFavoriteButton from "@/components/cars/CarFavoriteButton";
import { useCarCatalogOptions } from "@/hooks/useCarCatalogOptions";
import type { EstateOsCarListing } from "@/lib/carsCatalog";
import { isCarFavoriteId, loadCarFavoriteIds } from "@/lib/carFavoritesStorage";
import {
  CAR_SORT_OPTIONS,
  carImageSrc,
  formatCarPrice,
  sortCarListings,
  type CarSortKey,
} from "@/lib/carsPresentation";

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

const fieldClass =
  "rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50";

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

export default function CarsCatalogClient() {
  const [cars, setCars] = useState<EstateOsCarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CatalogTab>("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

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
    setLoading(true);

    void (async () => {
      try {
        const profileRes = await fetch("/api/user/profile", { cache: "no-store", credentials: "include" });
        const profile = await profileRes.json().catch(() => ({}));
        const isLoggedIn = profileRes.ok && Boolean(profile?.id || profile?.user?.id);
        if (!cancelled) setLoggedIn(isLoggedIn);

        const endpoint = tab === "mine" && isLoggedIn ? "/api/cars?scope=mine" : "/api/cars";
        const res = await fetch(endpoint, { cache: "no-store", credentials: "include" });
        const data = (await res.json()) as EstateOsCarListing[];
        if (cancelled) return;

        let rows = Array.isArray(data) ? data : [];
        if (tab === "favorites") {
          const ids = loadCarFavoriteIds();
          rows = rows.filter((car) => isCarFavoriteId(car.id, ids));
        }
        setCars(rows);
      } catch {
        if (!cancelled) setCars([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tab]);

  const fuelTypes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pl")),
    [cars],
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

  const tabButtonClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
      active
        ? "border-sky-400/50 bg-sky-500/15 text-sky-300"
        : "border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-text)] hover:border-sky-400/30"
    }`;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="relative mb-8 overflow-hidden rounded-3xl border border-sky-400/20 bg-[var(--eos-card)] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-sky-500/10 blur-3xl" />
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">EstateOS™Car</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Profesjonalny katalog samochodów
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-[var(--eos-muted)] sm:text-base">
            Jedno konto EstateOS, przełączanie Home/Car i zapytania trafiające prosto do sprzedającego przez EstateOS
            Contact.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/cars/dodaj"
              className="rounded-full border border-sky-400/40 bg-sky-500/10 px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-300 transition hover:bg-sky-500/20"
            >
              Dodaj ogłoszenie auta
            </Link>
            <button type="button" onClick={() => setTab("favorites")} className={tabButtonClass(tab === "favorites")}>
              <Heart size={14} className={tab === "favorites" ? "fill-current" : ""} />
              Ulubione
            </button>
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={tabButtonClass(tab === "mine")}
            >
              <UserRound size={14} />
              Moje samochody
            </button>
            {tab !== "all" ? (
              <button type="button" onClick={() => setTab("all")} className={tabButtonClass(false)}>
                <Car size={14} />
                Cały katalog
              </button>
            ) : null}
          </div>
          {!loading ? (
            <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-sky-300/90">
              {tab === "favorites"
                ? `${filtered.length} ulubionych z ${favoriteIds.length} zapisanych`
                : tab === "mine"
                  ? `${filtered.length} Twoich ogłoszeń`
                  : `${cars.length} aktywnych ogłoszeń w katalogu`}
            </p>
          ) : null}
        </header>

        {tab === "mine" && !loggedIn && !loading ? (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Zaloguj się, aby zobaczyć swoje ogłoszenia samochodowe.{" "}
            <Link href="/login" className="font-semibold underline">
              Przejdź do logowania
            </Link>
          </div>
        ) : null}

        {tab === "favorites" && !loading && favoriteIds.length === 0 ? (
          <div className="mb-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-3 text-sm text-[var(--eos-muted)]">
            Nie masz jeszcze ulubionych aut. Kliknij serduszko na karcie ogłoszenia, aby dodać je tutaj.
          </div>
        ) : null}

        <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-[var(--eos-muted)]">Szukaj</span>
            <input
              value={filters.query}
              onChange={(e) => setFilter("query", e.target.value)}
              placeholder="BMW, Warszawa, diesel..."
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Marka{makesLoading ? "…" : ""}</span>
            <select
              value={filters.makeSlug}
              onChange={(e) => selectMake(e.target.value)}
              className={fieldClass}
            >
              <option value="">Wszystkie</option>
              {makeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Paliwo</span>
            <select
              value={filters.fuelType}
              onChange={(e) => setFilter("fuelType", e.target.value)}
              className={fieldClass}
            >
              <option value="">Wszystkie</option>
              {fuelTypes.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Seria / model{modelsLoading ? "…" : ""}</span>
            <select
              value={filters.modelSlug}
              onChange={(e) => selectModel(e.target.value)}
              disabled={!filters.makeSlug}
              className={fieldClass}
            >
              <option value="">{filters.makeSlug ? "Wszystkie serie" : "Najpierw marka"}</option>
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Generacja{generationsLoading ? "…" : ""}</span>
            <select
              value={filters.generationSlug}
              onChange={(e) => selectGeneration(e.target.value)}
              disabled={!filters.modelSlug}
              className={fieldClass}
            >
              <option value="">{filters.modelSlug ? "Wszystkie generacje" : "Najpierw seria"}</option>
              {generationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Sortowanie</span>
            <select
              value={filters.sort}
              onChange={(e) => setFilter("sort", e.target.value as CarSortKey)}
              className={fieldClass}
            >
              {CAR_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Maks. cena (PLN)</span>
            <input
              type="text"
              inputMode="numeric"
              value={filters.maxPrice}
              onChange={(e) => setFilter("maxPrice", e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " "))}
              placeholder="np. 300 000"
              className={fieldClass}
            />
          </label>
        </section>

        <p className="mb-4 text-xs uppercase tracking-[0.16em] text-[var(--eos-muted)]">
          {loading ? "Ładowanie..." : `${filtered.length} z ${cars.length} ogłoszeń`}
        </p>

        {loading ? (
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ofert samochodów...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
            <p className="text-sm text-[var(--eos-muted)]">Brak ogłoszeń pasujących do filtrów.</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-4 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em]"
            >
              Wyczyść filtry
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
                    {car.city} · {new Intl.NumberFormat("pl-PL").format(car.mileageKm)} km · {car.fuelType}
                  </p>
                  <p className="text-lg font-bold text-sky-300">{formatCarPrice(car.pricePln)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
