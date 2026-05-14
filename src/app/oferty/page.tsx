"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";

type CatalogOffer = {
  id: number;
  title?: string | null;
  area?: unknown;
  price?: unknown;
  imageUrl?: string | null;
  district?: string | null;
  city?: string | null;
  transactionType?: string | null;
};

function normalizeTransactionType(value: unknown): "sale" | "rent" | "other" {
  const token = String(value || "")
    .trim()
    .toLowerCase();
  if (["sale", "sprzedaz", "sprzedaż", "sell", "sell"].includes(token)) return "sale";
  if (["rent", "wynajem", "lease"].includes(token)) return "rent";
  return "other";
}

function parsePriceNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "toNumber" in (value as object)) {
    try {
      const n = Number((value as { toNumber: () => number }).toNumber());
      return Number.isFinite(n) ? n : 0;
    } catch {
      /* noop */
    }
  }
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function formatPriceLabel(offer: CatalogOffer): string {
  const n = parsePriceNumber(offer.price);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const fmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n);
  const tx = normalizeTransactionType(offer.transactionType);
  return tx === "rent" ? `${fmt} zł/m` : `${fmt} zł`;
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
            : "Nie udało się pobrać katalogu.";
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
      setError("Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-black pb-24 pt-40 font-sans text-white">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24 border-b border-white/10 pb-12"
        >
          <h1 className="mb-8 text-6xl font-bold leading-none tracking-tighter md:text-8xl">
            Katalog <br />
            <span className="italic text-white/30">rezydencji.</span>
          </h1>
          <p className="max-w-3xl text-xl font-light tracking-wide text-white/50 md:text-2xl">
            Oferty na żywo z serwera EstateOS — te same dane co w mapie i w aplikacji mobilnej.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-4 py-32 text-white/45"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-9 w-9 animate-spin text-emerald-500/85" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.35em]">Ładowanie katalogu</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur-md"
              role="alert"
            >
              <p className="mb-8 text-sm leading-relaxed text-white/70">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-8 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 transition hover:bg-emerald-500/20"
              >
                Spróbuj ponownie
              </button>
            </motion.div>
          ) : offers.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 text-center text-sm uppercase tracking-[0.25em] text-white/35"
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
                    <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a0a]">
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
                        <h2 className="mb-2 text-3xl font-bold tracking-tight transition-colors group-hover:text-white">
                          {offer.title?.trim() || `Oferta #${offer.id}`}
                        </h2>
                        <p className="text-xs font-medium uppercase tracking-widest text-white/40">
                          {formatAreaLabel(offer)} · {formatLocationLabel(offer)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <p className="text-xl font-bold tabular-nums">{formatPriceLabel(offer)}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/30 transition-colors group-hover:text-white">
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
