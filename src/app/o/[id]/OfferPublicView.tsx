"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, MapPin, MessageCircle, UserRound } from "lucide-react";
import { safeOfferImageUrl } from "@/lib/safeOfferImageUrl";

const PROPERTY_LABEL: Record<string, string> = {
  FLAT: "Mieszkanie",
  HOUSE: "Dom",
  PLOT: "Działka",
  COMMERCIAL: "Komercja",
};

function parseOfferImages(raw: string | null): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];
  try {
    const j = JSON.parse(s) as unknown;
    if (Array.isArray(j)) return j.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatPrice(pln: number) {
  try {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(pln);
  } catch {
    return `${Math.round(pln)} PLN`;
  }
}

function formatDistrict(d: string) {
  return d.replaceAll("_", " ");
}

export type OfferPublicSeller = {
  id: number;
  displayName: string;
  image: string | null;
  profileHref: string;
  isAgency: boolean;
};

export type OfferPublicPayload = {
  id: number;
  title: string;
  description: string | null;
  price: number;
  area: number;
  rooms: number | null;
  propertyType: string;
  transactionType: string;
  city: string;
  district: string;
  images: string | null;
  seller: OfferPublicSeller;
};

export default function OfferPublicView({ offer }: { offer: OfferPublicPayload }) {
  const urls = useMemo(
    () => parseOfferImages(offer.images).map((u) => safeOfferImageUrl(u)).filter(Boolean) as string[],
    [offer.images],
  );
  const [active, setActive] = useState(0);
  const hero = urls[active] ?? null;
  const safeHero = safeOfferImageUrl(hero);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/o/${offer.id}`)}`;

  return (
    <main id="main-content" className="min-h-screen bg-black pb-28 pt-28 text-white md:pt-32">
      <div className="eos-page-x max-w-4xl">
        <Link
          href="/oferty"
          className="mb-10 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/45 transition-colors hover:text-white/90"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Katalog ofert
        </Link>

        <div className="relative mb-8 aspect-[16/10] overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0a0a0c] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          {safeHero ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploady / zewnętrzne URL-e z bazy; next/image bywa zawodne dla /uploads/*
            <img
              src={safeHero}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/[0.04] to-transparent text-white/35">
              <Building2 className="h-14 w-14" strokeWidth={1} aria-hidden />
              <span className="text-sm font-medium">Brak zdjęcia</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {urls.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2">
            {urls.map((u, i) => {
              const s = safeOfferImageUrl(u);
              if (!s) return null;
              return (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setActive(i)}
                  className={`relative h-16 w-24 overflow-hidden rounded-xl border transition-colors ${
                    i === active ? "border-emerald-400/70 ring-1 ring-emerald-400/40" : "border-white/10 hover:border-white/25"
                  }`}
                  aria-label={`Miniatura ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/70">
            {PROPERTY_LABEL[offer.propertyType] ?? offer.propertyType}
          </span>
          {offer.transactionType === "RENT" && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Wynajem</span>
          )}
        </div>

        <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{offer.title}</h1>
        <p className="mb-6 flex flex-wrap items-center gap-2 text-sm text-white/50">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-500/80" aria-hidden />
          <span>
            {formatDistrict(offer.district)}, {offer.city}
          </span>
        </p>
        <p className="mb-10 text-3xl font-semibold tabular-nums text-emerald-400 md:text-4xl">{formatPrice(offer.price)}</p>

        <div className="mb-10 grid gap-4 text-sm text-white/55 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Powierzchnia</p>
            <p className="mt-1 text-lg font-semibold text-white">{Math.round(offer.area)} m²</p>
          </div>
          {offer.rooms != null && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Pokoje</p>
              <p className="mt-1 text-lg font-semibold text-white">{offer.rooms}</p>
            </div>
          )}
        </div>

        {offer.description ? (
          <section className="mb-12 border-t border-white/[0.08] pt-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Opis</h2>
            <p className="whitespace-pre-wrap text-base leading-relaxed text-white/70">{offer.description}</p>
          </section>
        ) : null}

        <section
          className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/[0.06] p-8 md:p-10"
          aria-labelledby="contact-heading"
        >
          <h2 id="contact-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/90">
            Kontakt ze sprzedawcą
          </h2>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-white/55">
            Zobacz publiczny profil w serwisie albo zaloguj się, aby pisać i umawiać spotkania w dealroomie EstateOS™.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Link
              href={offer.seller.profileHref}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-black transition-colors hover:bg-emerald-400"
            >
              <UserRound className="h-4 w-4" aria-hidden />
              Profil sprzedawcy
            </Link>
            <Link
              href={loginHref}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/30 px-6 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/90 transition-colors hover:border-white/40"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Zaloguj i napisz
            </Link>
          </div>
          {offer.seller.isAgency && (
            <p className="mt-6 text-[11px] uppercase tracking-widest text-white/35">Ogłoszeniodawca oznaczony jako agencja / firma.</p>
          )}
        </section>
      </div>
    </main>
  );
}
