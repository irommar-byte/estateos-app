"use client";

import Link from "next/link";
import CarListingForm from "@/components/cars/CarListingForm";

export default function AddCarPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="relative mb-8 overflow-hidden rounded-3xl border border-sky-400/20 bg-[var(--eos-card)] p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full bg-cyan-500/8 blur-3xl" />
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">EstateOS™Car</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Dodaj ogłoszenie samochodu
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-[var(--eos-muted)] sm:text-base">
            Wypełnij formularz, dodaj zdjęcia i opublikuj — bez logowania na start. Po publikacji założysz konto,
            ogłoszenie trafi od razu do katalogu, a Ty będziesz mógł edytować zdjęcia i dostawać powiadomienia.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
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
          </div>
        </header>

        <div className="rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
          <CarListingForm mode="create" />
        </div>
      </div>
    </main>
  );
}
