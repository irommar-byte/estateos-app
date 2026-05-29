"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Loader2, Building2, KeyRound, Sparkles, BadgePercent, Gem, Grid2x2 } from "lucide-react";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { normalizeTransactionType } from "@/lib/transactionType";
import { useLocale } from "@/contexts/LocaleContext";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";

type CatalogOffer = {
  id: number;
  title?: string | null;
  area?: unknown;
  price?: unknown;
  priceCurrency?: unknown;
  pricePln?: unknown;
  imageUrl?: string | null;
  district?: string | null;
  city?: string | null;
  transactionType?: string | null;
  createdAt?: string | null;
  featured?: boolean | null;
  previousPrice?: unknown;
  oldPrice?: unknown;
  badges?: { isPartner?: boolean; isPro?: boolean } | null;
};

type GallerySection = "all" | "sale" | "rent" | "newest" | "discounted" | "featured";

function formatPriceLabel(
  offer: CatalogOffer,
  formatOffer: ReturnType<typeof useFormatOfferPrice>["formatOffer"],
): string {
  const info = formatOffer(offer);
  if (info.listingAmount <= 0) return "—";
  const tx = normalizeTransactionType(offer.transactionType);
  return tx === "rent" ? `${info.primary} / mc` : info.primary;
}

function formatAreaLabel(offer: CatalogOffer): string {
  const raw = offer.area;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return `${raw} m²`;
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  if (/m²|m2/i.test(s)) return s;
  return `${s} m²`;
}

function formatLocationLabel(offer: CatalogOffer): string {
  const parts = [offer.district, offer.city].map((p) => String(p || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "Polska";
}

export default function CatalogPage() {
  const { locale } = useLocale();
  const { formatOffer } = useFormatOfferPrice();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<GallerySection>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/offers?t=${Date.now()}`, { cache: "no-store" });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Failed to load catalog.";
        setError(msg);
        setOffers([]);
        return;
      }
      if (!Array.isArray(data)) {
        setError("Niespodziewany format odpowiedzi serwera.");
        setOffers([]);
        return;
      }
      setOffers(data as CatalogOffer[]);
    } catch {
      setError("No server connection. Check your network and try again.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labels =
    locale === "pl"
      ? {
          title: "Katalog nieruchomości",
          subtitle: "EstateOS™",
          lead:
            "Galeria działów rynku: kup, wynajmij, najnowsze, przecenione i wyróżnione. Ten sam katalog co na mapie i w aplikacji mobilnej.",
          loading: "Ładowanie katalogu",
          retry: "Spróbuj ponownie",
          empty: "Brak aktywnych ofert w tym dziale.",
          discover: "Odkryj",
          cardCaption: "ofert",
          sections: {
            all: "Wszystkie",
            sale: "Kup",
            rent: "Wynajem",
            newest: "Najnowsze",
            discounted: "Przecenione",
            featured: "Wyróżnione",
          } as Record<GallerySection, string>,
        }
      : {
          title: "EstateOS™ Property Catalog",
          subtitle: "EstateOS™",
          lead:
            "Curated market galleries: buy, rent, newest, discounted, and featured. The same inventory as the map and mobile app.",
          loading: "Loading catalog",
          retry: "Try again",
          empty: "No active listings in this section.",
          discover: "Discover",
          cardCaption: "listings",
          sections: {
            all: "All",
            sale: "Buy",
            rent: "Rent",
            newest: "Newest",
            discounted: "Discounted",
            featured: "Featured",
          } as Record<GallerySection, string>,
        };

  const sortedByNewest = [...offers].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number(a.id) * 1000;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number(b.id) * 1000;
    return tb - ta;
  });

  const discountedOffers = offers.filter((offer) => {
    const current = Number(offer.pricePln ?? offer.price ?? 0);
    const prev = Number(offer.previousPrice ?? offer.oldPrice ?? 0);
    return Number.isFinite(current) && Number.isFinite(prev) && prev > current && current > 0;
  });

  const featuredOffers = offers.filter(
    (offer) => offer.featured || offer.badges?.isPartner || offer.badges?.isPro,
  );

  const sectionCounts: Record<GallerySection, number> = {
    all: offers.length,
    sale: offers.filter((o) => normalizeTransactionType(o.transactionType) === "sale").length,
    rent: offers.filter((o) => normalizeTransactionType(o.transactionType) === "rent").length,
    newest: sortedByNewest.length,
    discounted: discountedOffers.length,
    featured: featuredOffers.length,
  };

  const sectionIcons: Record<GallerySection, typeof Grid2x2> = {
    all: Grid2x2,
    sale: Building2,
    rent: KeyRound,
    newest: Sparkles,
    discounted: BadgePercent,
    featured: Gem,
  };

  const offersInSection = (() => {
    switch (activeSection) {
      case "sale":
        return offers.filter((o) => normalizeTransactionType(o.transactionType) === "sale");
      case "rent":
        return offers.filter((o) => normalizeTransactionType(o.transactionType) === "rent");
      case "newest":
        return sortedByNewest;
      case "discounted":
        return discountedOffers;
      case "featured":
        return featuredOffers.length > 0 ? featuredOffers : sortedByNewest.slice(0, 8);
      default:
        return offers;
    }
  })();

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-24 pt-40 font-sans text-[var(--eos-text)]">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24 border-b border-[var(--eos-border)] pb-12"
        >
          <h1 className="mb-8 text-5xl font-bold leading-none tracking-tighter text-[var(--eos-text)] md:text-7xl">
            {labels.title}
            <br />
            <span className="italic text-[var(--eos-muted)]">{labels.subtitle}</span>
          </h1>
          <p className="max-w-3xl text-xl font-light tracking-wide text-[var(--eos-muted)] md:text-2xl">
            {labels.lead}
          </p>

          <div className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]/80 p-2 backdrop-blur-xl">
            {(
              ["all", "sale", "rent", "newest", "discounted", "featured"] as GallerySection[]
            ).map((section) => {
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setActiveSection(section)}
                  className={`rounded-full px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.2em] transition ${
                    active
                      ? "bg-emerald-500 text-black shadow-[0_0_18px_rgba(16,185,129,0.38)]"
                      : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
                  }`}
                >
                  {labels.sections[section]}
                </button>
              );
            })}
          </div>
        </motion.div>

        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
          >
            {(
              ["all", "sale", "rent", "newest", "discounted", "featured"] as GallerySection[]
            ).map((section) => {
              const Icon = sectionIcons[section];
              const active = activeSection === section;
              return (
                <button
                  key={`card-${section}`}
                  type="button"
                  onClick={() => setActiveSection(section)}
                  className={`rounded-[1.25rem] border p-4 text-left backdrop-blur-xl transition ${
                    active
                      ? "border-emerald-400/50 bg-emerald-500/12 shadow-[0_0_26px_rgba(16,185,129,0.2)]"
                      : "border-[var(--eos-border)] bg-[var(--eos-card)]/70 hover:border-[var(--eos-border-strong)]"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <Icon className={`h-4 w-4 ${active ? "text-emerald-400" : "text-[var(--eos-muted)]"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--eos-muted)]">
                      {labels.sections[section]}
                    </span>
                  </div>
                  <p className="text-2xl font-black tabular-nums tracking-tight text-[var(--eos-text)]">
                    {sectionCounts[section]}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--eos-muted)]">
                    {labels.cardCaption}
                  </p>
                </button>
              );
            })}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-32 text-[var(--eos-muted)]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-9 w-9 animate-spin text-emerald-500/85" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.35em]">{labels.loading}</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-lg rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-10 text-center backdrop-blur-md"
              role="alert"
            >
              <p className="mb-8 text-sm leading-relaxed text-[var(--eos-muted)]">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-8 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 transition hover:bg-emerald-500/20"
              >
                {labels.retry}
              </button>
            </motion.div>
          ) : offersInSection.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center text-sm uppercase tracking-[0.25em] text-[var(--eos-muted)]"
            >
              {labels.empty}
            </motion.p>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16"
            >
              {offersInSection.map((offer, i) => (
                <Link href={`/oferta/${offer.id}`} key={offer.id} className="block">
                  <motion.article
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: Math.min(i * 0.06, 0.42), duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="group cursor-pointer"
                  >
                    <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)]">
                      <OfferFavoriteButton
                        offerId={offer.id}
                        variant="icon"
                        size={20}
                        className="absolute right-4 top-4 z-20"
                        onRequireAuth={() => {
                          window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
                        }}
                      />
                      {offer.imageUrl ? (
                        <Image
                          src={offer.imageUrl}
                          alt={offer.title || `Oferta ${offer.id}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover opacity-80 transition-all duration-[1.4s] ease-out group-hover:scale-[1.04] group-hover:opacity-100"
                          unoptimized
                          priority={i < 2}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-black" aria-hidden />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
                    </div>

                    <div className="flex items-start justify-between px-2">
                      <div>
                        <h2 className="mb-2 text-3xl font-bold tracking-tight text-[var(--eos-text)] transition-colors group-hover:text-emerald-500">
                          {offer.title?.trim() || `Oferta #${offer.id}`}
                        </h2>
                        <p className="text-xs font-medium uppercase tracking-widest text-[var(--eos-muted)]">
                          {formatAreaLabel(offer)} · {formatLocationLabel(offer)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <p className="text-xl font-bold tabular-nums text-[var(--eos-text)]">{formatPriceLabel(offer, formatOffer)}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--eos-muted)] transition-colors group-hover:text-emerald-500">
                          {labels.discover} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </motion.article>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
