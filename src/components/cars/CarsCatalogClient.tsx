"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EstateOsCarListing } from "@/lib/carsCatalog";
import {
  CAR_SORT_OPTIONS,
  carImageSrc,
  formatCarPrice,
  sortCarListings,
  type CarSortKey,
} from "@/lib/carsPresentation";

type Filters = {
  query: string;
  make: string;
  fuelType: string;
  maxPrice: string;
  sort: CarSortKey;
};

const EMPTY_FILTERS: Filters = {
  query: "",
  make: "",
  fuelType: "",
  maxPrice: "",
  sort: "newest",
};

export default function CarsCatalogClient() {
  const [cars, setCars] = useState<EstateOsCarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cars", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: EstateOsCarListing[]) => {
        if (!cancelled) setCars(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const makes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.make).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pl")),
    [cars],
  );

  const fuelTypes = useMemo(
    () => Array.from(new Set(cars.map((c) => c.fuelType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pl")),
    [cars],
  );

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const maxPrice = Number(filters.maxPrice);
    const rows = cars.filter((car) => {
      if (filters.make && car.make !== filters.make) return false;
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
            <Link
              href="/oferty"
              className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--eos-text)] transition hover:border-emerald-400/40"
            >
              Przełącz na EstateOS™Home
            </Link>
          </div>
          {!loading ? (
            <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-sky-300/90">
              {cars.length} aktywnych ogłoszeń w katalogu
            </p>
          ) : null}
        </header>

        <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1.5 text-sm lg:col-span-2">
            <span className="text-[var(--eos-muted)]">Szukaj</span>
            <input
              value={filters.query}
              onChange={(e) => setFilter("query", e.target.value)}
              placeholder="BMW, Warszawa, diesel..."
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Marka</span>
            <select
              value={filters.make}
              onChange={(e) => setFilter("make", e.target.value)}
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
            >
              <option value="">Wszystkie</option>
              {makes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[var(--eos-muted)]">Paliwo</span>
            <select
              value={filters.fuelType}
              onChange={(e) => setFilter("fuelType", e.target.value)}
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
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
            <span className="text-[var(--eos-muted)]">Sortowanie</span>
            <select
              value={filters.sort}
              onChange={(e) => setFilter("sort", e.target.value as CarSortKey)}
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
            >
              {CAR_SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm sm:col-span-2 lg:col-span-5">
            <span className="text-[var(--eos-muted)]">Maks. cena (PLN)</span>
            <input
              type="number"
              value={filters.maxPrice}
              onChange={(e) => setFilter("maxPrice", e.target.value)}
              placeholder="np. 300000"
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
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
