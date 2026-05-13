import type { Metadata } from "next";
import Link from "next/link";
import HomeOffersMapGate from "@/components/map/HomeOffersMapGate";

export const metadata: Metadata = {
  title: "EstateOS | Ekskluzywne Nieruchomości w Warszawie",
  description:
    "Luksusowe apartamenty, wille i penthouse'y. Przeglądaj oferty, odkrywaj mapę i narzędzia dla właścicieli oraz agencji.",
};

export default function HomePage() {
  return (
    <main className="bg-black text-white min-h-screen pt-28 md:pt-32 pb-24">
      <section className="max-w-[1400px] mx-auto px-4 md:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500 mb-6">
          EstateOS™ — Warszawa
        </p>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.95] mb-8">
          Nieruchomości
          <br />
          <span className="text-white/35 italic">premium.</span>
        </h1>
        <p className="text-lg md:text-xl text-white/55 max-w-2xl font-light leading-relaxed mb-12">
          Jedna platforma dla właścicieli rezydencji i agencji: oferty, concierge,
          bezpieczne logowanie i przejrzysty proces sprzedaży.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="#map-section"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm font-black uppercase tracking-widest text-white/80 hover:border-emerald-400/50 hover:text-white transition-colors"
          >
            Mapa ofert
          </Link>
          <Link
            href="/oferty"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-8 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-emerald-400 transition-colors"
          >
            Przeglądaj oferty
          </Link>
          <Link
            href="/dodaj-oferte"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm font-black uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white transition-colors"
          >
            Dodaj ofertę
          </Link>
          <Link
            href="/eksperci"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm font-black uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white transition-colors"
          >
            Eksperci
          </Link>
          <Link
            href="/cennik"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-8 py-3 text-sm font-black uppercase tracking-widest text-white/80 hover:border-white/40 hover:text-white transition-colors"
          >
            Cennik
          </Link>
        </div>
      </section>

      <section
        id="map-section"
        className="max-w-[1400px] mx-auto px-4 md:px-6 mt-16 md:mt-24 scroll-mt-28 md:scroll-mt-32"
      >
        <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="min-w-0">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight">Mapa i katalog</h2>
            <p className="mt-2 text-white/50 max-w-2xl text-sm md:text-base leading-relaxed">
              Poniżej mapa z pinezkami aktywnych ofert (klik → karta ogłoszenia). Pełna lista filtrów i zdjęć jest w
              katalogu.
            </p>
          </div>
          <Link
            href="/oferty"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-emerald-200 transition-colors"
          >
            Otwórz katalog
          </Link>
        </div>
        <div className="mt-6">
          <HomeOffersMapGate />
        </div>
      </section>
    </main>
  );
}
