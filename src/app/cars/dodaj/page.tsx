"use client";

import Link from "next/link";
import CarListingForm from "@/components/cars/CarListingForm";

export default function AddCarPage() {
  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-400">EstateOS™Car</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Dodaj ogłoszenie samochodu</h1>
        <p className="mt-4 text-sm text-[var(--eos-muted)] sm:text-base">
          Publikujesz auto na tym samym koncie EstateOS. Wgraj zdjęcie lub podaj URL obrazu.
        </p>
        <CarListingForm mode="create" />
        <div className="mt-4">
          <Link href="/cars" className="text-xs font-black uppercase tracking-[0.12em] text-sky-300 hover:text-sky-200">
            Wróć do katalogu Cars
          </Link>
        </div>
      </div>
    </main>
  );
}
