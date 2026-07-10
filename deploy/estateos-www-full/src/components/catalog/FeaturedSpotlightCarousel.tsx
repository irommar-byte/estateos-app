"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";

export type SpotlightItem = {
  id: number | string;
  href: string;
  title: string;
  subtitle?: string;
  priceLabel: string;
  imageUrl: string;
  badge?: string;
};

type FeaturedSpotlightCarouselProps = {
  items: SpotlightItem[];
  title?: string;
  lead?: string;
  accent?: "home" | "car";
  rotateMs?: number;
  pageSize?: number;
};

const FALLBACK = "/fallback-luxury.svg";

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out.length ? out : [[]];
}

export default function FeaturedSpotlightCarousel({
  items,
  title = "Oferty wyróżnione",
  lead = "Premiumowa ekspozycja — rotacja co 30 sekund.",
  accent = "home",
  rotateMs = 30_000,
  pageSize = 6,
}: FeaturedSpotlightCarouselProps) {
  const pages = useMemo(() => chunk(items, pageSize), [items, pageSize]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages.length <= 1) return;
    const timer = window.setInterval(() => {
      setPage((prev) => (prev + 1) % pages.length);
    }, rotateMs);
    return () => window.clearInterval(timer);
  }, [pages.length, rotateMs]);

  if (!items.length) return null;

  const isCar = accent === "car";
  const glow = isCar ? "from-sky-500/25 via-cyan-400/10" : "from-amber-400/25 via-emerald-500/10";
  const ring = isCar ? "ring-sky-400/35" : "ring-amber-400/40";
  const badgeBg = isCar ? "bg-sky-500 text-white" : "bg-gradient-to-r from-amber-400 to-amber-500 text-black";

  const current = pages[page] ?? [];

  return (
    <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-4 sm:p-6">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glow} to-transparent`} />
      <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[var(--eos-muted)]">
            <Crown className={`size-4 ${isCar ? "text-sky-300" : "text-amber-400"}`} />
            {title}
          </p>
          <p className="mt-1 max-w-2xl text-sm text-[var(--eos-muted)]">{lead}</p>
        </div>
        {pages.length > 1 ? (
          <div className="flex items-center gap-2">
            {pages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Slajd ${idx + 1}`}
                onClick={() => setPage(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === page ? `w-8 ${isCar ? "bg-sky-400" : "bg-amber-400"}` : "w-2 bg-[var(--eos-border)]"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.45 }}
          className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {current.map((item, index) => (
            <Link
              key={String(item.id)}
              href={item.href}
              className={`group relative overflow-hidden rounded-[1.35rem] border bg-[var(--eos-surface)] shadow-[0_24px_60px_rgba(0,0,0,0.18)] ring-1 ${ring} transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(0,0,0,0.24)]`}
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={item.imageUrl || FALLBACK}
                  alt={item.title}
                  fill
                  className="object-cover transition duration-700 group-hover:scale-[1.06]"
                  sizes="(max-width: 1280px) 50vw, 33vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] shadow-lg ${badgeBg}`}>
                  <Sparkles className="size-3" />
                  {item.badge || "Wyróżnione"}
                </span>
              </div>
              <div className="space-y-1 p-4">
                <p className="line-clamp-2 text-base font-semibold tracking-tight text-[var(--eos-text)]">{item.title}</p>
                {item.subtitle ? <p className="text-xs text-[var(--eos-muted)]">{item.subtitle}</p> : null}
                <p className={`text-lg font-black tabular-nums ${isCar ? "text-sky-300" : "text-amber-500"}`}>{item.priceLabel}</p>
              </div>
              {index === 0 ? (
                <span className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/10 blur-2xl" />
              ) : null}
            </Link>
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
