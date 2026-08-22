"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Car, Crown, Home, ImageOff, Loader2, Pencil, Sparkles, LayoutDashboard } from "lucide-react";
import PromoteListingButton from "@/components/catalog/PromoteListingButton";
import EosButton from "@/components/ui/EosButton";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import { isAgentOrAgencySeller } from "@/lib/sellerDisplay";
import EstateOsDeskCrmButton from "@/components/account/EstateOsDeskCrmButton";
import {
  groupListingsBySection,
  LISTING_SECTION_LABELS,
  LISTING_SECTION_ORDER,
  type ListingSection,
} from "@/lib/offers/listingSections";

type HomeListing = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  pricePln?: number | null;
  status?: string | null;
  images?: unknown;
  imageUrl?: string | null;
  featured?: boolean | null;
  promotedUntil?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  awaitingModeration?: boolean | null;
  pendingPublicationKind?: string | null;
  legalCheckStatus?: string | null;
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
  imageUrl?: string | null;
  images?: unknown;
};

type Vertical = "home" | "car";

const FALLBACK_IMAGE = "/fallback-luxury.svg";

function formatPrice(price: number | null | undefined) {
  if (!price || !Number.isFinite(Number(price))) return "Cena na zapytanie";
  return `${new Intl.NumberFormat("pl-PL").format(Number(price))} PLN`;
}

function listingCoverUrl(item: {
  imageUrl?: string | null;
  images?: unknown;
}): string {
  const direct = String(item.imageUrl || "").trim();
  if (direct) return direct;
  if (Array.isArray(item.images)) {
    const first = item.images.find((x) => typeof x === "string" && String(x).trim());
    if (first) return String(first).trim();
  }
  if (typeof item.images === "string") {
    const raw = item.images.trim();
    if (!raw) return FALLBACK_IMAGE;
    if (raw.startsWith("http") || raw.startsWith("/")) return raw;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find((x) => typeof x === "string" && String(x).trim());
        if (first) return String(first).trim();
      }
    } catch {
      /* ignore */
    }
  }
  return FALLBACK_IMAGE;
}

function ListingThumb({
  src,
  alt,
  brand,
}: {
  src: string;
  alt: string;
  brand: "home" | "car";
}) {
  const [broken, setBroken] = useState(false);
  const show = !broken && src;
  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden sm:aspect-auto sm:h-full sm:min-h-[148px] sm:w-[220px] sm:shrink-0 ${
        brand === "home" ? "bg-emerald-500/8" : "bg-sky-500/8"
      }`}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 text-[var(--eos-subtle)] sm:min-h-[148px]">
          <ImageOff className="size-6 opacity-60" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wider">Brak zdjęcia</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-[var(--eos-card)]/40" />
    </div>
  );
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
  const [isAgent, setIsAgent] = useState(false);

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
    void fetch("/api/user/profile", { cache: "no-store", credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        setIsAgent(isAgentOrAgencySeller(json?.user || json));
      })
      .catch(() => setIsAgent(false));
  }, [loadHomeListings, loadCarListings]);

  const activeItems = useMemo(() => (vertical === "home" ? homeListings : carListings), [vertical, homeListings, carListings]);
  const homeGrouped = useMemo(() => groupListingsBySection(homeListings), [homeListings]);
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

  const renderHomeOffer = (offer: HomeListing) => {
    const cover = listingCoverUrl(offer);
    const title = offer.title || `Oferta #${offer.id}`;
    return (
      <article key={`home-${offer.id}`} className={listingCardClass("home")}>
        <div className="flex flex-col sm:flex-row">
          <Link href={`/oferta/${offer.id}`} className="block sm:contents">
            <ListingThumb src={cover} alt={title} brand="home" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-7">
            <Link href={`/oferta/${offer.id}`} className="block">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                EstateOS™Home
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-[var(--eos-text)] sm:text-2xl">
                {title}
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
            <div className="mt-6 flex flex-wrap gap-2.5 border-t border-[var(--eos-border)] pt-5">
              <EosButton href={`/edytuj-oferte/${offer.id}`} variant="home" size="sm">
                <Pencil className="size-3.5" aria-hidden />
                Edytuj
              </EosButton>
              <PromoteListingButton
                endpoint={`/api/offers/${offer.id}/promote`}
                onPromoted={() => void loadHomeListings()}
                disabled={Boolean(offer.featured)}
              />
              <EosButton
                type="button"
                variant="danger"
                size="sm"
                onClick={() => void handleArchiveHome(offer.id)}
                disabled={archivingHomeId === offer.id}
              >
                {archivingHomeId === offer.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {archivingHomeId === offer.id ? "Kończenie..." : "Zakończ"}
              </EosButton>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const sectionNavLabel = (key: ListingSection, count: number) => {
    if (key === "ACTIVE") return `Aktywne (${count})`;
    if (key === "PENDING") return `Oczekujące (${count})`;
    return `Zakończone (${count})`;
  };

  const scrollToListingSection = (key: ListingSection) => {
    document.getElementById(`ogloszenia-section-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const listingCardClass = (brand: "home" | "car") =>
    `group relative overflow-hidden rounded-[1.75rem] border bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)] transition duration-300 ${
      brand === "home"
        ? "border-[var(--eos-border)] hover:border-emerald-400/45"
        : "border-[var(--eos-border)] hover:border-sky-400/45"
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
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:items-stretch sm:justify-start">
            <a
              href="/moje-konto/crm?tab=my_offers"
              className="eos-mgmt-panel-btn group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-7 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white"
            >
              <span className="eos-mgmt-panel-btn__sheen" aria-hidden />
              <LayoutDashboard className="relative z-10 size-4 transition duration-500 group-hover:rotate-[-8deg] group-hover:scale-110" aria-hidden />
              <span className="relative z-10">Panel zarządzania</span>
            </a>
            {isAgent ? <EstateOsDeskCrmButton /> : null}
          </div>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-7 text-center shadow-[var(--eos-shadow-soft)] sm:p-10">
          <p
            className={`text-xs font-black uppercase tracking-[0.22em] ${
              vertical === "car" ? "text-sky-600 dark:text-sky-400" : "text-emerald-600 dark:text-emerald-400"
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

          <div className="mx-auto mt-8 flex w-full max-w-xl flex-col items-center gap-4">
            <div className="eos-btn-seg">
              <button
                type="button"
                onClick={() => setVertical("home")}
                className={eosBtn(vertical === "home" ? "home" : "ghost", { size: "sm" })}
              >
                <Home size={15} strokeWidth={2.25} />
                EstateOS™Home ({homeListings.length})
              </button>
              <button
                type="button"
                onClick={() => setVertical("car")}
                className={eosBtn(vertical === "car" ? "car" : "ghost", { size: "sm" })}
              >
                <Car size={15} strokeWidth={2.25} />
                EstateOS™Car ({carListings.length})
              </button>
            </div>

            {!loading ? (
              <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                <Sparkles className="size-3.5 opacity-70" aria-hidden />
                {activeItems.length}{" "}
                {activeItems.length === 1
                  ? "aktywne ogłoszenie"
                  : activeItems.length < 5
                    ? "aktywne ogłoszenia"
                    : "aktywnych ogłoszeń"}
              </p>
            ) : null}
          </div>
        </section>

        {loading ? (
          <p className="text-center text-xs uppercase tracking-[0.2em] text-[var(--eos-muted)]">Ładowanie ogłoszeń...</p>
        ) : activeItems.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-10 text-center shadow-[var(--eos-shadow-soft)]">
            <p className="text-sm text-[var(--eos-muted)]">
              {vertical === "home"
                ? "Nie masz jeszcze aktywnych ogłoszeń nieruchomości."
                : "Nie masz jeszcze ogłoszeń samochodowych."}
            </p>
            <div className="mt-6 flex justify-center">
              <EosButton
                href={vertical === "home" ? "/dodaj-oferte" : "/cars/dodaj"}
                variant={vertical === "home" ? "home" : "car"}
              >
                {vertical === "home" ? "Dodaj ofertę Home" : "Dodaj ofertę Car"}
              </EosButton>
            </div>
            {vertical === "car" ? (
              <Link
                href="/cars"
                className="mt-5 inline-block text-xs font-semibold text-sky-600 underline underline-offset-2 hover:text-sky-500 dark:text-sky-400"
              >
                Przejdź do katalogu Cars
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {vertical === "home" ? (
                <div className="flex flex-wrap gap-2">
                  {LISTING_SECTION_ORDER.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => scrollToListingSection(key)}
                      className="rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)] transition hover:border-emerald-400/45 hover:text-[var(--eos-text)]"
                    >
                      {sectionNavLabel(key, homeGrouped[key].length)}
                    </button>
                  ))}
                </div>
              ) : (
                <div />
              )}
              <EosButton
                href={vertical === "home" ? "/dodaj-oferte" : "/cars/dodaj"}
                variant={vertical === "home" ? "home" : "car"}
                size="sm"
              >
                Dodaj kolejną ofertę
              </EosButton>
            </div>
            {vertical === "home" ? (
              <div className="space-y-10">
                {LISTING_SECTION_ORDER.map((key) => {
                  const sectionOffers = homeGrouped[key];
                  if (sectionOffers.length === 0 && key !== "ACTIVE") return null;
                  return (
                    <section
                      key={key}
                      id={`ogloszenia-section-${key}`}
                      className="scroll-mt-32 space-y-4"
                      aria-labelledby={`ogloszenia-section-title-${key}`}
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                          {LISTING_SECTION_LABELS[key]}
                        </p>
                        <h2
                          id={`ogloszenia-section-title-${key}`}
                          className="mt-1 text-xl font-semibold tracking-tight"
                        >
                          {sectionNavLabel(key, sectionOffers.length)}
                        </h2>
                      </div>
                      {sectionOffers.length === 0 ? (
                        <p className="rounded-[1.25rem] border border-dashed border-[var(--eos-border)] px-5 py-8 text-center text-sm text-[var(--eos-muted)]">
                          Brak ogłoszeń w tej grupie.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-5">{sectionOffers.map(renderHomeOffer)}</div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              (carListings as CarListing[]).map((car) => {
                  const cover = listingCoverUrl(car);
                  return (
                    <article key={`car-${car.id}`} className={listingCardClass("car")}>
                      <div className="flex flex-col sm:flex-row">
                        <Link href={`/cars/${car.id}`} className="block sm:contents">
                          <ListingThumb src={cover} alt={car.title} brand="car" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-7">
                          <Link href={`/cars/${car.id}`} className="block">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
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
                          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-[var(--eos-border)] pt-5">
                            <EosButton href={`/cars/${car.id}/edytuj`} variant="car" size="sm">
                              <Pencil className="size-3.5" aria-hidden />
                              Edytuj
                            </EosButton>
                            <PromoteListingButton
                              endpoint={`/api/cars/${car.id}/promote`}
                              onPromoted={() => void loadCarListings()}
                              disabled={Boolean(car.featured)}
                            />
                            <EosButton
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteCar(car.id)}
                              disabled={deletingCarId === car.id}
                            >
                              {deletingCarId === car.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                              {deletingCarId === car.id ? "Usuwanie..." : "Usuń"}
                            </EosButton>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
            )}
          </div>
        )}
      </div>
    </main>
  );
}
