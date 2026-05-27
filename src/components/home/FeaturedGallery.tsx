"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, MapPin } from "lucide-react";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";
import { useLocale } from "@/contexts/LocaleContext";
import { useFormatOfferPrice } from "@/hooks/useFormatOfferPrice";

type Offer = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  price?: string | number | null;
  priceCurrency?: string | null;
  pricePln?: number | null;
  area?: string | number | null;
  rooms?: string | number | null;
  imageUrl?: string | null;
  images?: unknown;
  transactionType?: string | null;
  badges?: {
    isPartner?: boolean;
    isInvestorPro?: boolean;
  } | null;
};

const FALLBACK_IMAGE = "/fallback-luxury.svg";

function firstImage(offer: Offer, index: number) {
  if (offer.imageUrl) return offer.imageUrl;
  if (Array.isArray(offer.images) && typeof offer.images[0] === "string") return offer.images[0];
  if (typeof offer.images === "string") {
    try {
      const parsed = JSON.parse(offer.images);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    } catch {
      return FALLBACK_IMAGE;
    }
  }
  return FALLBACK_IMAGE;
}

function parsePrice(price: Offer["price"]) {
  const n = Number(String(price ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function FeaturedGallery() {
  const { dict, locale } = useLocale();
  const { formatOffer } = useFormatOfferPrice();
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/offers", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json)) {
          const sorted = [...json].sort((a, b) => {
            const aPartner = a?.badges?.isPartner === true ? 1 : 0;
            const bPartner = b?.badges?.isPartner === true ? 1 : 0;
            return bPartner - aPartner;
          });
          setOffers(sorted.slice(0, 6));
        }
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const featured = useMemo(() => offers.slice(0, 6), [offers]);

  if (!featured.length) {
    return null;
  }

  return (
    <section className="premium-home-surface relative overflow-hidden bg-[#050505] py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.055),transparent_58%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400/90">
              {dict.homePremium.galleryEyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-light tracking-tight text-[var(--eos-text)] sm:text-6xl">
              {dict.homePremium.galleryTitle}{" "}
              <span className="font-semibold">{dict.homePremium.galleryTitleHighlight}</span>
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)] sm:text-base">
              {dict.homePremium.gallerySubtitle}
            </p>
          </div>
          <Link
            href="/oferty"
            className="group inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {dict.homePremium.galleryViewAll}
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((offer, index) => {
            const location =
              [offer.city, offer.district].filter(Boolean).join(", ") ||
              (locale === "en" ? "Poland" : "Polska");
            const isDealRoom = offer.badges?.isPartner === true;
            const priceInfo = formatOffer(offer);
            const isRent = String(offer.transactionType || "").toLowerCase().includes("rent");
            return (
              <motion.article
                key={offer.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/oferta/${offer.id}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110"
                    style={{ backgroundImage: `url(${firstImage(offer, index)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/18 to-transparent opacity-90" />
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />

                  <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/90 backdrop-blur-xl">
                    {String(offer.transactionType || "sale").toLowerCase().includes("rent")
                      ? (locale === "en" ? "Rent" : "Wynajem")
                      : (locale === "en" ? "Sale" : "Sprzedaż")}
                  </div>
                  <OfferFavoriteButton
                    offerId={offer.id}
                    variant="icon"
                    size={20}
                    className={`absolute z-20 ${isDealRoom ? "right-5 top-16" : "right-5 top-5"}`}
                    onRequireAuth={() => {
                      window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
                    }}
                  />
                  {isDealRoom && (
                    <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-orange-400/50 bg-orange-500/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_20px_rgba(249,115,22,0.35)] backdrop-blur-xl">
                      <Briefcase className="size-3" />
                      {dict.homePremium.dealRoom}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-7">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                      <MapPin className="size-3.5" />
                      {location}
                    </div>
                    <h3 className="text-2xl font-light leading-tight text-white">
                      {offer.title || (locale === "en" ? "Listing" : "Oferta")}
                    </h3>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/60">
                      <span className="text-base font-semibold text-white">
                        {parsePrice(offer.price) > 0
                          ? `${priceInfo.primary}${isRent ? ` ${dict.homePremium.pricePerMonth}` : ""}`
                          : dict.homePremium.priceOnRequest}
                      </span>
                      {priceInfo.secondary ? (
                        <span className="text-white/45">{priceInfo.secondary}</span>
                      ) : null}
                      {offer.area && <span>{offer.area} m²</span>}
                      {offer.rooms && <span>{offer.rooms} {dict.homePremium.galleryRoomsLabel}</span>}
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
