"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";
import { normalizeTransactionType } from "@/lib/transactionType";

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
};

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
  const { formatOffer } = useFormatOfferPrice();
  const [offers, setOffers] = useState<CatalogOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="theme-aware-dashboard min-h-screen bg-[var(--eos-bg)] pb-24 pt-40 font-sans text-[var(--eos-text)]">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24 border-b border-[var(--eos-border)] pb-12"
        >
          <h1 className="mb-8 text-6xl font-bold leading-none tracking-tighter text-[var(--eos-text)] md:text-8xl">
            Katalog <br />
            <span className="italic text-[var(--eos-muted)]">rezydencji.</span>
          </h1>
          <p className="max-w-3xl text-xl font-light tracking-wide text-[var(--eos-muted)] md:text-2xl">
            Live listings from EstateOS server — the same data as on the map and in the mobile app.
          </p>
        </motion.div>

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
              <p className="text-xs font-semibold uppercase tracking-[0.35em]">Loading catalog</p>
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
                Try again
              </button>
            </motion.div>
          ) : offers.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center text-sm uppercase tracking-[0.25em] text-[var(--eos-muted)]"
            >
              Brak aktywnych ofert w katalogu.
            </motion.p>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16"
            >
              {offers.map((offer, i) => (
                <Link href={`/oferta/${offer.id}`} key={offer.id} className="block">
                  <motion.article
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ delay: Math.min(i * 0.06, 0.42), duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    className="group cursor-pointer"
                  >
                    <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)]">
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
                          Odkryj <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
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
