"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import CarAddEntryScreen, { type CarAddEntryMethod } from "@/components/cars/CarAddEntryScreen";
import CarListingForm from "@/components/cars/CarListingForm";

export default function AddCarPageClient() {
  const { dict } = useLocale();
  const c = dict.cars;
  const [phase, setPhase] = useState<"entry" | "form">("entry");
  const [entryMethod, setEntryMethod] = useState<CarAddEntryMethod>("manual");

  const handleChoose = useCallback((method: CarAddEntryMethod) => {
    setEntryMethod(method);
    setPhase("form");
  }, []);

  if (phase === "entry") {
    return (
      <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
        <div className="mx-auto max-w-4xl">
          <CarAddEntryScreen onChoose={handleChoose} />
          <p className="mt-6 text-center text-xs text-[var(--eos-muted)]">
            {c.entry.hasAccount}{" "}
            <Link
              href="/login?next=/cars/dodaj"
              className="font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
            >
              {c.entry.signIn}
            </Link>
            {" · "}
            <Link href="/cars" className="font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400">
              {c.common.carsCatalog}
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPhase("entry")}
            className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)] transition hover:border-sky-400/30 hover:text-sky-600 dark:hover:text-sky-300"
          >
            {c.entry.changeEntryMethod}
          </button>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/cars"
              className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--eos-muted)] transition hover:border-sky-400/30 hover:text-sky-600 dark:hover:text-sky-300"
            >
              {c.common.carsCatalog}
            </Link>
            <Link
              href="/moje-konto/ogloszenia?vertical=car"
              className="rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300"
            >
              {c.common.myListings}
            </Link>
          </div>
        </div>

        <CarListingForm mode="create" entryMethod={entryMethod} />
      </div>
    </main>
  );
}
