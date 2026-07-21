"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import CarAddEntryScreen, { type CarAddEntryMethod } from "@/components/cars/CarAddEntryScreen";
import CarListingForm from "@/components/cars/CarListingForm";
import { OTOMOTO_IMPORT_STORAGE_KEY } from "@/lib/otomotoCarImport";
import { clearCarListingDraft, draftHasContent } from "@/lib/carListingDraft";

export default function AddCarPageClient() {
  const { dict } = useLocale();
  const c = dict.cars;
  const [phase, setPhase] = useState<"entry" | "form" | "draft-resume">("entry");
  const [entryMethod, setEntryMethod] = useState<CarAddEntryMethod>("manual");
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const entry = params.get("entry");
      const fromOtomoto = params.get("from") === "otomoto";
      const raw = sessionStorage.getItem(OTOMOTO_IMPORT_STORAGE_KEY);

      if (entry === "scan" || entry === "upload" || entry === "capture" || entry === "manual") {
        setEntryMethod(entry);
        setPhase("form");
        return;
      }

      if (fromOtomoto || raw) {
        setEntryMethod("otomoto");
        setPhase("form");
        return;
      }
      if (draftHasContent()) {
        setPhase("draft-resume");
      }
    } catch {
      // ignore
    } finally {
      setBootstrapped(true);
    }
  }, []);

  const handleChoose = useCallback((method: CarAddEntryMethod) => {
    setEntryMethod(method);
    setPhase("form");
  }, []);

  if (!bootstrapped) {
    return (
      <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
        <div className="mx-auto max-w-4xl text-sm text-[var(--eos-muted)]">…</div>
      </main>
    );
  }

  if (phase === "draft-resume") {
    return (
      <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
        <div className="mx-auto max-w-lg rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">Szkic ogłoszenia</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--eos-text)]">
            Masz niedokończone ogłoszenie Cars
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">
            Kontynuować zapisany szkic, czy zacząć nowe ogłoszenie od zera?
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setEntryMethod("manual");
                setPhase("form");
              }}
              className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.28)] transition hover:bg-sky-400"
            >
              Kontynuuj szkic
            </button>
            <button
              type="button"
              onClick={() => {
                clearCarListingDraft();
                setEntryMethod("manual");
                setPhase("entry");
              }}
              className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-3 text-sm font-semibold text-[var(--eos-text)] transition hover:border-sky-400/40"
            >
              Dodaj nowe
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-[var(--eos-muted)]">
            <Link href="/cars" className="font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400">
              {c.common.carsCatalog}
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (phase === "entry") {
    return (
      <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
        <div className="mx-auto max-w-6xl">
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
