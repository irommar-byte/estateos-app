"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { EstateOsCarListing } from "@/lib/carsCatalog";

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("pl-PL").format(price)} PLN`;
}

function carImageSrc(imageUrl?: string) {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) {
    return "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1400&q=80";
  }
  return trimmed;
}

export default function CarsCatalogPage() {
  const [cars, setCars] = useState<EstateOsCarListing[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-[var(--eos-border)] pb-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">EstateOS™Car</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Katalog samochodów premium</h1>
          <p className="mt-4 max-w-3xl text-sm text-[var(--eos-muted)] sm:text-base">
            Ten sam ekosystem EstateOS, jedno konto i nowe ogłoszenia samochodowe. Wyszukuj, porównuj i kontaktuj się
            ze sprzedającymi bez przełączania aplikacji.
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
        </header>

        {loading ? (
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ofert samochodów...</p>
        ) : cars.length === 0 ? (
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--eos-muted)]">Brak ogłoszeń samochodowych.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cars.map((car) => (
              <Link
                key={car.id}
                href={`/cars/${car.id}`}
                className="group overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-sky-400/45"
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
                  <p className="text-lg font-bold text-sky-300">{formatPrice(car.pricePln)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
