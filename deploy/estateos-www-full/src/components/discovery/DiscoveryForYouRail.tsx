"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import OfferDiscoveryActions from "@/components/discovery/OfferDiscoveryActions";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

export type ForYouRailItem = {
  id: number;
  offerId: number;
  title: string;
  city: string;
  district: string;
  price: number;
  pricePln: number | null;
  priceCurrency: string;
  imageUrl: string | null;
  reason: string;
  area: number;
  transactionType: string;
};

type Props = {
  transactionMode?: "all" | "sale" | "rent";
  formatPrice: (item: ForYouRailItem) => string;
};

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };

/**
 * Apple Intelligence–quiet catalog rail: soft suggestions, one calm reason line.
 */
export default function DiscoveryForYouRail({ transactionMode = "all", formatPrice }: Props) {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<ForYouRailItem[]>([]);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<"unknown" | "guest" | "user">("unknown");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const tx =
          transactionMode === "sale" ? "SALE" : transactionMode === "rent" ? "RENT" : "";
        const qs = new URLSearchParams({ limit: "12" });
        if (tx) qs.set("transaction", tx);
        const res = await fetch(`/api/discovery/for-you?${qs}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 401) {
          setAuth("guest");
          setItems([]);
          setReady(false);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setAuth("user");
        setReady(Boolean(data?.profile?.ready));
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [transactionMode]);

  if (auth === "guest" || auth === "unknown") return null;
  if (loading) return null;
  if (!ready) {
    return (
      <section className="mt-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[rgba(8,10,14,0.55)] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl sm:px-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-xl">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
                <Sparkles size={12} aria-hidden />
                EstateOS™ Inteligence
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-tight text-white sm:text-xl">
                Bliżej Twojego kierunku
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                Oceń kilka ofert spokojnie — tu pojawią się sugestie dopasowane do Ciebie.
              </p>
            </div>
            <Link
              href="/moj-kierunek"
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-4 py-2 text-[11px] font-semibold tracking-wide text-white/80 transition hover:bg-white/[0.1]"
            >
              Mój kierunek
              <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500/90 dark:text-emerald-300/80">
            <Sparkles size={12} aria-hidden />
            EstateOS™ Inteligence
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)]">
            Bliżej Twojego kierunku
          </h2>
        </div>
        <Link
          href="/moj-kierunek"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--eos-muted)] transition hover:text-emerald-500"
        >
          Mój kierunek
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <motion.div
            key={item.offerId}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(index, 6) * 0.04 }}
            className="w-[272px] shrink-0"
          >
            <Link
              href={`/oferta/${item.offerId}`}
              className="group block overflow-hidden rounded-[1.35rem] border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-emerald-500/25"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-black/20">
                <Image
                  src={item.imageUrl || "/fallback-luxury.svg"}
                  alt=""
                  fill
                  sizes="272px"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  unoptimized
                />
                <OfferDiscoveryActions
                  offerId={item.offerId}
                  variant="compact"
                  source="web_catalog_for_you"
                  className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2"
                  onRequireAuth={() => {
                    window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${item.offerId}`)}`;
                  }}
                />
              </div>
              <div className="space-y-2 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--eos-muted)]">
                  {[item.city, item.district].filter(Boolean).join(" · ") || "Polska"}
                  {item.area > 0 ? ` · ${Math.round(item.area)} m²` : ""}
                </p>
                <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-[var(--eos-text)]">
                  {item.title}
                </h3>
                <p className="text-base font-semibold tabular-nums text-[var(--eos-text)]">
                  {formatPrice(item)}
                </p>
                {item.reason ? (
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--eos-muted)]">
                    <span className="text-emerald-500/90 dark:text-emerald-300/85">Sugestia · </span>
                    {item.reason}
                  </p>
                ) : null}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
