"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] px-4 pb-24 pt-36 text-[var(--eos-text)] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-[var(--eos-border)] pb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">Moje konto</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Moje ogłoszenia</h1>
          <p className="mt-3 text-sm text-[var(--eos-muted)]">
            Jedno konto EstateOS i dwa brandy operacyjne: EstateOS™Home oraz EstateOS™Car.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
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

        <div className="mb-6 inline-flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-1">
          <button
            type="button"
            onClick={() => setVertical("home")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              vertical === "home" ? "bg-emerald-500/20 text-emerald-300" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            }`}
          >
            EstateOS™Home ({homeListings.length})
          </button>
          <button
            type="button"
            onClick={() => setVertical("car")}
            className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              vertical === "car" ? "bg-sky-500/20 text-sky-300" : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
            }`}
          >
            EstateOS™Car ({carListings.length})
          </button>
        </div>

        {loading ? (
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ogłoszeń...</p>
        ) : activeItems.length === 0 ? (
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
            <p className="text-sm text-[var(--eos-muted)]">
              {vertical === "home" ? "Nie masz jeszcze aktywnych ogłoszeń nieruchomości." : "Nie masz jeszcze ogłoszeń samochodowych."}
            </p>
            <div className="mt-4">
              <Link
                href={vertical === "home" ? "/dodaj-oferte" : "/cars/dodaj"}
                className="inline-flex rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] px-4 py-2 text-xs font-black uppercase tracking-[0.12em]"
              >
                {vertical === "home" ? "Dodaj ofertę Home" : "Dodaj ofertę Car"}
              </Link>
            </div>
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
