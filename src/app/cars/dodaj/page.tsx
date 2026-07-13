"use client";

import Link from "next/link";
import CarListingForm from "@/components/cars/CarListingForm";
import CatalogBrandHero from "@/components/catalog/CatalogBrandHero";

export default function AddCarPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <CatalogBrandHero
          brand="car"
          title="Dodaj ogłoszenie samochodu"
          description="Wypełnij formularz, dodaj zdjęcia i opublikuj — bez logowania na start. Po publikacji założysz konto, ogłoszenie trafi od razu do katalogu, a Ty będziesz mógł edytować zdjęcia i dostawać powiadomienia."
        >
          <Link
            href="/cars"
            className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)] transition hover:border-sky-400/30 hover:text-sky-300"
          >
            Katalog Cars
          </Link>
          <Link
            href="/moje-konto/ogloszenia"
            className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-sky-300"
          >
            Moje ogłoszenia
          </Link>
        </CatalogBrandHero>

        <CarListingForm mode="create" />
      </div>
    </main>
  );
}
