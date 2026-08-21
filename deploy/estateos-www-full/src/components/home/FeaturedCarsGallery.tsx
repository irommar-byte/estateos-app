"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Gauge, MapPin } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { carImageSrc, formatCarPrice, formatMileage } from "@/lib/carsPresentation";

type CarListing = {
  id: number;
  title?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  city?: string | null;
  pricePln?: number | null;
  mileageKm?: number | null;
  imageUrl?: string | null;
  featured?: boolean | null;
};

const MAX_FEATURED = 6;

export default function FeaturedCarsGallery() {
  const { dict, locale } = useLocale();
  const [cars, setCars] = useState<CarListing[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/cars", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !Array.isArray(json)) return;
        const featured = json.filter((car: CarListing) => car?.featured === true);
        const pool = featured.length ? featured : json;
        setCars(pool.slice(0, MAX_FEATURED));
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => cars.slice(0, MAX_FEATURED), [cars]);

  if (!featured.length) return null;

  return (
    <section className="premium-home-surface relative overflow-hidden border-t border-[var(--eos-border)] bg-[var(--eos-bg)] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.1),transparent_58%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sky-600 dark:text-sky-700/90 dark:text-sky-400/90">
              {dict.homePremium.carsGalleryEyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-light tracking-tight text-[var(--eos-text)] sm:text-6xl">
              {dict.homePremium.carsGalleryTitle}{" "}
              <span className="font-semibold">{dict.homePremium.carsGalleryTitleHighlight}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)] sm:text-base">
              {dict.homePremium.carsGallerySubtitle}
            </p>
          </div>
          <Link
            href="/cars"
            className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-sky-600 transition-colors hover:text-sky-600 dark:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
          >
            {dict.homePremium.carsGalleryViewAll}
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((car, index) => {
            const title =
              car.title?.trim() ||
              [car.make, car.model, car.year].filter(Boolean).join(" ") ||
              dict.homePremium.listingFallback;
            const location = car.city?.trim() || dict.homePremium.countryDefault;
            return (
              <motion.article
                key={car.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/cars/${car.id}`}
                  className="eos-media-chrome eos-lux-media-card group relative block aspect-[4/5] overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)]"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                    style={{ backgroundImage: `url(${carImageSrc(car.imageUrl)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/15" />
                  <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 to-transparent" />

                  <div className="absolute left-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur-xl shadow-[0_4px_20px_rgba(14,165,233,0.35)] eos-luxury-media-text">
                    {dict.homePremium.carsFeaturedBadge}
                  </div>

                  <div className="eos-on-media absolute bottom-0 left-0 right-0 p-6 sm:p-7">
                    <div className="eos-offer-caption-glass rounded-2xl p-4 sm:p-5">
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-300 eos-luxury-media-text">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{location}</span>
                      </div>
                      <h3 className="eos-luxury-media-text line-clamp-2 text-xl font-semibold leading-snug text-white sm:text-2xl">
                        {title}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/90">
                        <span className="eos-luxury-media-text text-sm font-bold text-white">
                          {Number(car.pricePln) > 0
                            ? formatCarPrice(Number(car.pricePln), locale)
                            : dict.homePremium.priceOnRequest}
                        </span>
                        {car.year ? (
                          <span className="eos-luxury-media-text text-white/80">{car.year}</span>
                        ) : null}
                        {Number(car.mileageKm) > 0 ? (
                          <span className="eos-luxury-media-text inline-flex items-center gap-1 text-white/80">
                            <Gauge className="size-3.5" aria-hidden />
                            {formatMileage(Number(car.mileageKm), locale)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
