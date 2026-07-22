"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Crown, Home, Loader2, Pencil, Sparkles } from "lucide-react";
import PromoteListingButton from "@/components/catalog/PromoteListingButton";

type HomeListing = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  pricePln?: number | null;
  status?: string | null;
  images?: string | null;
  imageUrl?: string | null;
  featured?: boolean | null;
  promotedUntil?: string | null;
};

type CarListing = {
  id: number;
  title: string;
  make: string;
  model: string;
  year: number;
  city: string;
  pricePln: number;
  userId?: number | null;
  featured?: boolean | null;
  promotedUntil?: string | null;
};

type Vertical = "home" | "car";

function formatPrice(price: number | null | undefined) {
  if (!price || !Number.isFinite(Number(price))) return "Cena na zapytanie";
  return `${new Intl.NumberFormat("pl-PL").format(Number(price))} PLN`;
}

const actionBtnBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55";

function editBtnClass(brand: "home" | "car") {
  if (brand === "home") {
    return `${actionBtnBase} border border-emerald-300/70 bg-gradient-to-b from-emerald-100 to-emerald-50 text-emerald-800 shadow-[0_8px_22px_rgba(16,185,129,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] hover:from-emerald-50 hover:to-emerald-100/80 dark:border-emerald-400/35 dark:from-emerald-500/25 dark:to-emerald-500/10 dark:text-emerald-200 dark:shadow-[0_10px_28px_rgba(16,185,129,0.18)]`;
  }
  return `${actionBtnBase} border border-sky-300/70 bg-gradient-to-b from-sky-100 to-sky-50 text-sky-900 shadow-[0_8px_22px_rgba(14,165,233,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] hover:from-sky-50 hover:to-sky-100/80 dark:border-sky-400/40 dark:from-sky-500/25 dark:to-sky-500/10 dark:text-sky-100 dark:shadow-[0_10px_28px_rgba(14,165,233,0.2)]`;
}

function dangerBtnClass() {
  return `${actionBtnBase} border border-rose-300/70 bg-gradient-to-b from-rose-100 to-rose-50 text-rose-800 shadow-[0_8px_20px_rgba(244,63,94,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:from-rose-50 hover:to-rose-100/90 dark:border-rose-400/35 dark:from-rose-500/20 dark:to-rose-500/8 dark:text-rose-200`;
}

const promoteBtnClass =
  "inline-flex items-center gap-2 rounded-full border border-black/8 bg-gradient-to-b from-white to-neutral-50 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-800 shadow-[0_8px_22px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] transition duration-200 hover:border-amber-400/50 hover:from-amber-50 hover:to-white hover:text-amber-950 active:scale-[0.98] disabled:opacity-55 dark:border-white/10 dark:from-white/[0.08] dark:to-white/[0.02] dark:text-amber-100 dark:shadow-[0_10px_28px_rgba(0,0,0,0.25)] dark:hover:border-amber-400/40";

export default function AccountListingsPage() {
  const searchParams = useSearchParams();
  const [vertical, setVertical] = useState<Vertical>("home");
  const [homeListings, setHomeListings] = useState<HomeListing[]>([]);
  const [carListings, setCarListings] = useState<CarListing[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingCars, setLoadingCars] = useState(true);
  const [deletingCarId, setDeletingCarId] = useState<number | null>(null);
  const [archivingHomeId, setArchivingHomeId] = useState<number | null>(null);

  const loadHomeListings = useCallback(async () => {
    setLoadingHome(true);
    try {
      const res = await fetch("/api/offers?scope=mine", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        setHomeListings([]);
        return;
      }
      const data = await res.json();
      setHomeListings(Array.isArray(data) ? (data as HomeListing[]) : []);
    } catch {
      setHomeListings([]);
    } finally {
      setLoadingHome(false);
    }
  }, []);

  const loadCarListings = useCallback(async () => {
    setLoadingCars(true);
    try {
      const res = await fetch("/api/cars?scope=mine", { cache: "no-store", credentials: "include" });
      const payload = await res.json();
      setCarListings(Array.isArray(payload) ? (payload as CarListing[]) : []);
    } catch {
      setCarListings([]);
    } finally {
      setLoadingCars(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("vertical") === "car") {
      setVertical("car");
    }
  }, [searchParams]);

  useEffect(() => {
    void loadHomeListings();
    void loadCarListings();
  }, [loadHomeListings, loadCarListings]);

  const activeItems = useMemo(() => (vertical === "home" ? homeListings : carListings), [vertical, homeListings, carListings]);
  const loading = vertical === "home" ? loadingHome : loadingCars;

  const handleDeleteCar = async (carId: number) => {
    if (!window.confirm("Usunąć to ogłoszenie samochodu?")) return;
    setDeletingCarId(carId);
    try {
      const response = await fetch(`/api/cars/${carId}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(typeof data?.error === "string" ? data.error : "Nie udało się usunąć ogłoszenia.");
        return;
      }
      setCarListings((prev) => prev.filter((item) => item.id !== carId));
    } catch {
      alert("Błąd sieci podczas usuwania ogłoszenia.");
    } finally {
      setDeletingCarId(null);
    }
  };

  const handleArchiveHome = async (offerId: number) => {
    if (!window.confirm("Zakończyć publikację tego ogłoszenia?")) return;
    setArchivingHomeId(offerId);
    try {
      const response = await fetch(`/api/offers/${offerId}/archive`, { method: "POST", credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(typeof data?.error === "string" ? data.error : "Nie udało się zarchiwizować ogłoszenia.");
        return;
      }
      setHomeListings((prev) => prev.filter((item) => item.id !== offerId));
    } catch {
      alert("Błąd sieci podczas archiwizacji.");
    } finally {
      setArchivingHomeId(null);
    }
  };

  const verticalTabClass = (active: boolean, brand: "home" | "car") => {
    if (brand === "home") {
      return `inline-flex items-center gap-2.5 rounded-full border px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition duration-200 ${
        active
          ? "border-emerald-300/80 bg-gradient-to-b from-emerald-100 to-emerald-50 text-emerald-900 shadow-[0_12px_32px_rgba(16,185,129,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-emerald-400/45 dark:from-emerald-500/25 dark:to-emerald-500/10 dark:text-emerald-100"
          : "border-black/8 bg-white/80 text-neutral-500 shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:border-emerald-300/50 hover:text-emerald-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--eos-muted)] dark:hover:border-emerald-400/30 dark:hover:text-[var(--eos-text)]"
      }`;
    }
    return `inline-flex items-center gap-2.5 rounded-full border px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition duration-200 ${
      active
        ? "border-sky-300/80 bg-gradient-to-b from-sky-100 to-sky-50 text-sky-950 shadow-[0_12px_32px_rgba(14,165,233,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-sky-400/45 dark:from-sky-500/25 dark:to-sky-500/10 dark:text-sky-100"
        : "border-black/8 bg-white/80 text-neutral-500 shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:border-sky-300/50 hover:text-sky-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-[var(--eos-muted)] dark:hover:border-sky-400/30 dark:hover:text-[var(--eos-text)]"
    }`;
  };

  const listingCardClass = (brand: "home" | "car") =>
    `group relative overflow-hidden rounded-[1.75rem] border bg-[var(--eos-card)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition duration-300 sm:p-7 ${
      brand === "home"
        ? "border-black/[0.06] hover:border-emerald-300/50 hover:shadow-[0_22px_60px_rgba(16,185,129,0.12)] dark:border-white/10 dark:hover:border-emerald-400/35"
        : "border-black/[0.06] hover:border-sky-300/50 hover:shadow-[0_22px_60px_rgba(14,165,233,0.12)] dark:border-white/10 dark:hover:border-sky-400/35"
    }`;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-[var(--eos-border)] pb-6 text-center sm:text-left">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">Moje konto</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Moje ogłoszenia</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--eos-muted)] sm:mx-0">
            Jedno konto EstateOS i dwa brandy operacyjne: EstateOS™Home oraz EstateOS™Car.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Link
              href="/moje-konto/crm?tab=my_offers"
              className="inline-flex rounded-full border border-emerald-400/45 bg-emerald-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300"
            >
              Panel zarządzania
            </Link>
            <Link
              href="/moje-konto/sesje-zdjeciowe"
              className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300"
            >
              Sesje zdjęciowe EstateOS Studio
            </Link>
            <Link
              href="/moje-konto/wiadomosci"
              className="inline-flex rounded-full border border-[var(--eos-border)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em]"
            >
              Wiadomości
            </Link>
          </div>
        </header>

        <section
          className={`relative mb-8 overflow-hidden rounded-[2rem] border p-7 text-center sm:p-10 ${
            vertical === "car"
              ? "border-sky-200/80 bg-gradient-to-b from-white to-sky-50/40 shadow-[0_24px_70px_rgba(14,165,233,0.1)] dark:border-sky-400/25 dark:from-[var(--eos-card)] dark:to-[var(--eos-card)] dark:shadow-[0_22px_70px_rgba(14,165,233,0.1)]"
              : "border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/40 shadow-[0_24px_70px_rgba(16,185,129,0.1)] dark:border-emerald-400/20 dark:from-[var(--eos-card)] dark:to-[var(--eos-card)] dark:shadow-[0_22px_70px_rgba(16,185,129,0.08)]"
          }`}
        >
          <div
            className={`pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl ${
              vertical === "car" ? "bg-sky-500/12" : "bg-emerald-500/10"
            }`}
          />
          <div
            className={`pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full blur-3xl ${
              vertical === "car" ? "bg-cyan-500/8" : "bg-emerald-500/6"
            }`}
          />

          <p
            className={`text-xs font-black uppercase tracking-[0.22em] ${
              vertical === "car" ? "text-sky-500" : "text-emerald-500"
            }`}
          >
            {vertical === "car" ? "EstateOS™Car" : "EstateOS™Home"}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {vertical === "car" ? "Twoje ogłoszenia samochodowe" : "Twoje ogłoszenia nieruchomości"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--eos-muted)]">
            {vertical === "car"
              ? "Zarządzaj autami, udostępniaj telefon na ofercie i odpowiadaj na zapytania kupujących z jednego konta."
              : "Zarządzaj ofertami Home, promuj ogłoszenia i odpowiadaj na zapytania z jednego konta."}
          </p>

          <div className="relative mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => setVertical("home")} className={verticalTabClass(vertical === "home", "home")}>
              <Home size={15} strokeWidth={2.25} />
              EstateOS™Home ({homeListings.length})
            </button>
            <button type="button" onClick={() => setVertical("car")} className={verticalTabClass(vertical === "car", "car")}>
              <Car size={15} strokeWidth={2.25} />
              EstateOS™Car ({carListings.length})
            </button>
          </div>

          {!loading ? (
            <p
              className={`mt-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] ${
                vertical === "car" ? "text-sky-600 dark:text-sky-300" : "text-emerald-600 dark:text-emerald-300"
              }`}
            >
              <Sparkles className="size-3.5 opacity-70" aria-hidden />
              {activeItems.length}{" "}
              {activeItems.length === 1 ? "aktywne ogłoszenie" : activeItems.length < 5 ? "aktywne ogłoszenia" : "aktywnych ogłoszeń"}
            </p>
          ) : null}
        </section>

        {loading ? (
          <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ogłoszeń...</p>
        ) : activeItems.length === 0 ? (
          <div
            className={`mx-auto max-w-2xl rounded-[1.75rem] border p-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)] ${
              vertical === "car"
                ? "border-sky-200/70 bg-gradient-to-b from-sky-50/80 to-white dark:border-sky-400/20 dark:from-sky-500/[0.06] dark:to-transparent"
                : "border-emerald-200/70 bg-gradient-to-b from-emerald-50/80 to-white dark:border-emerald-400/20 dark:from-emerald-500/[0.05] dark:to-transparent"
            }`}
          >
            <p className="text-sm text-[var(--eos-muted)]">
              {vertical === "home"
                ? "Nie masz jeszcze aktywnych ogłoszeń nieruchomości."
                : "Nie masz jeszcze ogłoszeń samochodowych."}
            </p>
            <div className="mt-6">
              <Link
                href={vertical === "home" ? "/dodaj-oferte" : "/cars/dodaj"}
                className={vertical === "home" ? editBtnClass("home") : editBtnClass("car")}
              >
                {vertical === "home" ? "Dodaj ofertę Home" : "Dodaj ofertę Car"}
              </Link>
            </div>
            {vertical === "car" ? (
              <Link
                href="/cars"
                className="mt-5 inline-block text-xs font-semibold text-sky-500 underline underline-offset-2 hover:text-sky-400"
              >
                Przejdź do katalogu Cars
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {vertical === "home"
              ? (homeListings as HomeListing[]).map((offer) => (
                  <article key={`home-${offer.id}`} className={listingCardClass("home")}>
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
                      aria-hidden
                    />
                    <Link href={`/oferta/${offer.id}`} className="block">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                        EstateOS™Home
                      </p>
                      <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--eos-text)] sm:text-2xl">
                        {offer.title || `Oferta #${offer.id}`}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--eos-muted)]">
                        {[offer.city, offer.district].filter(Boolean).join(" · ") || "Lokalizacja"}
                      </p>
                      <p className="mt-4 text-2xl font-semibold tracking-tight">{formatPrice(offer.pricePln ?? null)}</p>
                      {offer.featured ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                          <Crown className="size-3.5" aria-hidden />
                          Wyróżnione do{" "}
                          {offer.promotedUntil ? new Date(offer.promotedUntil).toLocaleDateString("pl-PL") : "—"}
                        </p>
                      ) : null}
                    </Link>
                    <div className="mt-6 flex flex-wrap gap-2.5 border-t border-black/[0.05] pt-5 dark:border-white/10">
                      <Link href={`/edytuj-oferte/${offer.id}`} className={editBtnClass("home")}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edytuj
                      </Link>
                      <PromoteListingButton
                        endpoint={`/api/offers/${offer.id}/promote`}
                        onPromoted={() => void loadHomeListings()}
                        disabled={Boolean(offer.featured)}
                        buttonClassName={promoteBtnClass}
                      />
                      <button
                        type="button"
                        onClick={() => void handleArchiveHome(offer.id)}
                        disabled={archivingHomeId === offer.id}
                        className={dangerBtnClass()}
                      >
                        {archivingHomeId === offer.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {archivingHomeId === offer.id ? "Kończenie..." : "Zakończ"}
                      </button>
                    </div>
                  </article>
                ))
              : (carListings as CarListing[]).map((car) => (
                  <article key={`car-${car.id}`} className={listingCardClass("car")}>
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent"
                      aria-hidden
                    />
                    <Link href={`/cars/${car.id}`} className="block">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-300">
                        EstateOS™Car
                      </p>
                      <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--eos-text)] sm:text-2xl">
                        {car.title}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--eos-muted)]">
                        {car.make} · {car.model} · {car.year} · {car.city}
                      </p>
                      <p className="mt-4 text-2xl font-semibold tracking-tight">{formatPrice(car.pricePln)}</p>
                      {car.featured ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-400">
                          <Crown className="size-3.5" aria-hidden />
                          Wyróżnione do{" "}
                          {car.promotedUntil ? new Date(car.promotedUntil).toLocaleDateString("pl-PL") : "—"}
                        </p>
                      ) : null}
                    </Link>
                    <div className="mt-6 flex flex-wrap gap-2.5 border-t border-black/[0.05] pt-5 dark:border-white/10">
                      <Link href={`/cars/${car.id}/edytuj`} className={editBtnClass("car")}>
                        <Pencil className="size-3.5" aria-hidden />
                        Edytuj
                      </Link>
                      <PromoteListingButton
                        endpoint={`/api/cars/${car.id}/promote`}
                        onPromoted={() => void loadCarListings()}
                        disabled={Boolean(car.featured)}
                        buttonClassName={promoteBtnClass}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteCar(car.id)}
                        disabled={deletingCarId === car.id}
                        className={dangerBtnClass()}
                      >
                        {deletingCarId === car.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {deletingCarId === car.id ? "Usuwanie..." : "Usuń"}
                      </button>
                    </div>
                  </article>
                ))}
          </div>
        )}
      </div>
    </main>
  );
}
