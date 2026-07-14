"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Home } from "lucide-react";
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
      return `inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition ${
        active
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300 shadow-[0_8px_24px_rgba(16,185,129,0.15)]"
          : "border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-muted)] hover:border-emerald-400/30 hover:text-[var(--eos-text)]"
      }`;
    }
    return `inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition ${
      active
        ? "border-sky-400/50 bg-sky-500/15 text-sky-300 shadow-[0_8px_24px_rgba(14,165,233,0.18)]"
        : "border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-muted)] hover:border-sky-400/30 hover:text-[var(--eos-text)]"
    }`;
  };

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
          className={`relative mb-8 overflow-hidden rounded-3xl border p-6 text-center sm:p-10 ${
            vertical === "car"
              ? "border-sky-400/25 bg-[var(--eos-card)] shadow-[0_22px_70px_rgba(14,165,233,0.1)]"
              : "border-emerald-400/20 bg-[var(--eos-card)] shadow-[0_22px_70px_rgba(16,185,129,0.08)]"
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
              vertical === "car" ? "text-sky-400" : "text-emerald-400"
            }`}
          >
            {vertical === "car" ? "EstateOS™Car" : "EstateOS™Home"}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {vertical === "car" ? "Twoje ogłoszenia samochodowe" : "Twoje ogłoszenia nieruchomości"}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--eos-muted)]">
            {vertical === "car"
              ? "Zarządzaj autami, edytuj zdjęcia i odpowiadaj na zapytania kupujących z jednego konta."
              : "Zarządzaj ofertami Home, promuj ogłoszenia i odpowiadaj na zapytania z jednego konta."}
          </p>

          <div className="relative mx-auto mt-8 flex max-w-xl flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => setVertical("home")} className={verticalTabClass(vertical === "home", "home")}>
              <Home size={14} />
              EstateOS™Home ({homeListings.length})
            </button>
            <button type="button" onClick={() => setVertical("car")} className={verticalTabClass(vertical === "car", "car")}>
              <Car size={14} />
              EstateOS™Car ({carListings.length})
            </button>
          </div>

          {!loading ? (
            <p
              className={`mt-5 text-xs font-black uppercase tracking-[0.14em] ${
                vertical === "car" ? "text-sky-600 dark:text-sky-300" : "text-emerald-600 dark:text-emerald-300"
              }`}
            >
              {activeItems.length}{" "}
              {activeItems.length === 1 ? "aktywne ogłoszenie" : activeItems.length < 5 ? "aktywne ogłoszenia" : "aktywnych ogłoszeń"}
            </p>
          ) : null}
        </section>

        {loading ? (
          <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ogłoszeń...</p>
        ) : activeItems.length === 0 ? (
          <div
            className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center ${
              vertical === "car"
                ? "border-sky-400/20 bg-gradient-to-b from-sky-500/[0.06] to-transparent"
                : "border-emerald-400/20 bg-gradient-to-b from-emerald-500/[0.05] to-transparent"
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
                className={`inline-flex rounded-full border px-6 py-3 text-xs font-black uppercase tracking-[0.14em] transition ${
                  vertical === "car"
                    ? "border-sky-400/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                    : "border-emerald-400/35 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                }`}
              >
                {vertical === "home" ? "Dodaj ofertę Home" : "Dodaj ofertę Car"}
              </Link>
            </div>
            {vertical === "car" ? (
              <Link
                href="/cars"
                className="mt-4 inline-block text-xs font-semibold text-sky-400 underline underline-offset-2 hover:text-sky-300"
              >
                Przejdź do katalogu Cars
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {vertical === "home"
              ? (homeListings as HomeListing[]).map((offer) => (
                  <div
                    key={`home-${offer.id}`}
                    className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 transition hover:border-emerald-400/40"
                  >
                    <Link href={`/oferta/${offer.id}`}>
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-300">EstateOS™Home</p>
                      <h2 className="mt-2 text-lg font-semibold">{offer.title || `Oferta #${offer.id}`}</h2>
                      <p className="mt-1 text-sm text-[var(--eos-muted)]">
                        {[offer.city, offer.district].filter(Boolean).join(" · ") || "Lokalizacja"}
                      </p>
                      <p className="mt-2 text-base font-bold">{formatPrice(offer.pricePln ?? null)}</p>
                      {offer.featured ? (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                          Wyróżnione do{" "}
                          {offer.promotedUntil ? new Date(offer.promotedUntil).toLocaleDateString("pl-PL") : "—"}
                        </p>
                      ) : null}
                    </Link>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/edytuj-oferte/${offer.id}`}
                        className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300"
                      >
                        Edytuj
                      </Link>
                      <PromoteListingButton
                        endpoint={`/api/offers/${offer.id}/promote`}
                        onPromoted={() => void loadHomeListings()}
                        disabled={Boolean(offer.featured)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleArchiveHome(offer.id)}
                        disabled={archivingHomeId === offer.id}
                        className="rounded-full border border-red-400/35 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-300 disabled:opacity-60"
                      >
                        {archivingHomeId === offer.id ? "Kończenie..." : "Zakończ"}
                      </button>
                    </div>
                  </div>
                ))
              : (carListings as CarListing[]).map((car) => (
                  <div
                    key={`car-${car.id}`}
                    className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 transition hover:border-sky-400/40"
                  >
                    <Link href={`/cars/${car.id}`}>
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-300">EstateOS™Car</p>
                      <h2 className="mt-2 text-lg font-semibold">{car.title}</h2>
                      <p className="mt-1 text-sm text-[var(--eos-muted)]">
                        {car.make} · {car.model} · {car.year} · {car.city}
                      </p>
                      <p className="mt-2 text-base font-bold">{formatPrice(car.pricePln)}</p>
                      {car.featured ? (
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-500">
                          Wyróżnione do{" "}
                          {car.promotedUntil ? new Date(car.promotedUntil).toLocaleDateString("pl-PL") : "—"}
                        </p>
                      ) : null}
                    </Link>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/cars/${car.id}/edytuj`}
                        className="rounded-full border border-sky-400/35 bg-sky-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-sky-300"
                      >
                        Edytuj
                      </Link>
                      <PromoteListingButton
                        endpoint={`/api/cars/${car.id}/promote`}
                        onPromoted={() => void loadCarListings()}
                        disabled={Boolean(car.featured)}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteCar(car.id)}
                        disabled={deletingCarId === car.id}
                        className="rounded-full border border-red-400/35 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-300 disabled:opacity-60"
                      >
                        {deletingCarId === car.id ? "Usuwanie..." : "Usuń"}
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
    </main>
  );
}
