"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Loader2, MapPin } from "lucide-react";

type CatalogOffer = {
  id: number;
  title: string;
  price: number;
  area: number;
  city: string;
  district: string;
  propertyType: string;
  transactionType: string;
  image: string | null;
};

const PROPERTY_LABEL: Record<string, string> = {
  FLAT: "Mieszkanie",
  HOUSE: "Dom",
  PLOT: "Działka",
  COMMERCIAL: "Komercja",
};

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

export default function CatalogPage() {
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/offers-catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.offers)) setOffers(data.offers);
        else setOffers([]);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(true);
          setOffers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countLabel = useMemo(() => {
    if (loading) return "Ładowanie…";
    if (!offers.length) return "Brak aktywnych ogłoszeń";
    return `${offers.length} aktywnych ofert`;
  }, [loading, offers.length]);

  return (
    <main id="main-content" className="min-h-screen bg-black pb-24 pt-10 text-white md:pt-14">
      <div className="eos-page-x">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 border-b border-white/[0.08] pb-12 md:mb-20 md:pb-16"
        >
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45">
            Katalog
          </p>
          <h1 className="mb-6 text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl md:tracking-tighter">
            Wybrane
            <br />
            <span className="text-white/35">nieruchomości.</span>
          </h1>
          <p className="max-w-2xl text-lg font-light leading-relaxed text-white/50 md:text-xl">
            Aktualne ogłoszenia z platformy EstateOS™ — przejrzysta cena, metraż i lokalizacja. Karta prowadzi do
            publicznej strony oferty.
          </p>
          <p className="mt-6 text-sm text-white/35">{countLabel}</p>
          {fetchError && (
            <p className="mt-3 text-sm text-amber-200/80">
              Nie udało się odświeżyć listy. Spróbuj ponownie za chwilę.
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-white/45">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400/80" aria-hidden />
            <span className="text-sm font-medium tracking-wide">Ładowanie ofert…</span>
          </div>
        ) : offers.length === 0 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-[2rem] border border-white/[0.08] bg-white/[0.03] px-8 py-16 text-center">
            <Building2 className="mb-4 h-10 w-10 text-white/25" strokeWidth={1.25} />
            <p className="text-lg font-medium text-white/80">Na razie brak aktywnych ofert</p>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Gdy pojawią się nowe ogłoszenia, zobaczysz je tutaj i na mapie strony głównej.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white/80 transition-colors hover:border-white/35 hover:text-white"
            >
              Strona główna
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-x-10 md:gap-y-16">
            {offers.map((offer, i) => (
              <a href={`/o/${offer.id}`} key={offer.id} className="group block outline-none">
                <motion.article
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ delay: Math.min(i * 0.04, 0.24), duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="cursor-pointer"
                >
                  <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-[#0a0a0c] shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-[border-color,box-shadow] duration-500 group-hover:border-white/[0.12] group-hover:shadow-[0_32px_100px_rgba(16,185,129,0.06)]">
                    {offer.image ? (
                      <Image
                        src={offer.image}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover opacity-[0.88] transition-all duration-[1.2s] ease-out group-hover:scale-[1.03] group-hover:opacity-100"
                        unoptimized={offer.image.startsWith("data:") || offer.image.startsWith("blob:")}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/[0.04] to-transparent">
                        <Building2 className="h-14 w-14 text-white/15" strokeWidth={1} />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                      <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/70 backdrop-blur-md">
                        {PROPERTY_LABEL[offer.propertyType] ?? offer.propertyType}
                      </span>
                      {offer.transactionType === "RENT" && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur-md">
                          Wynajem
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4 px-1">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-white md:text-[1.65rem] md:leading-snug">
                        {offer.title}
                      </h2>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                        <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-white/50">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
                          {formatDistrict(offer.district)}, {offer.city}
                        </span>
                        <span>{Math.round(offer.area)} m²</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tracking-tight tabular-nums md:text-xl">
                        {formatPrice(offer.price)}
                      </p>
                      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35 transition-colors group-hover:text-white/80">
                        Szczegóły
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </p>
                    </div>
                  </div>
                </motion.article>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
