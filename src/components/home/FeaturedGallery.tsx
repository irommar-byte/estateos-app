"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, MapPin } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import OfferFavoriteButton from "@/components/offer/OfferFavoriteButton";

type Offer = {
  id: number;
  title?: string | null;
  city?: string | null;
  district?: string | null;
  price?: string | number | null;
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

function formatPrice(price: Offer["price"], transactionType: Offer["transactionType"], priceOnRequest: string, pricePerMonth: string) {
  const n = parsePrice(price);
  if (!Number.isFinite(n) || n <= 0) return priceOnRequest;
  const suffix = String(transactionType || "").toLowerCase().includes("rent") ? " / mo" : "";
  return `${new Intl.NumberFormat("en-US").format(n)} PLN${suffix}`.replace(" / mo", ` ${pricePerMonth}`);
}

export default function FeaturedGallery() {
  const { dict } = useLocale();
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
    <section className="relative overflow-hidden border-t border-white/10 bg-black py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_50%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400">
              {dict.homePremium.galleryEyebrow}
            </p>
            <h2 className="mt-4 text-4xl font-light tracking-tight text-white sm:text-6xl">
              {dict.homePremium.galleryTitle}{" "}
              <span className="font-semibold text-white">{dict.homePremium.galleryTitleHighlight}</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">
              {dict.homePremium.gallerySubtitle}
            </p>
          </div>
          <Link
            href="/oferty"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white backdrop-blur-md transition-all hover:bg-white/10"
          >
            {dict.homePremium.galleryViewAll}
            <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((offer, index) => {
            const location = [offer.city, offer.district].filter(Boolean).join(", ") || "Private market";
            const isDealRoom = offer.badges?.isPartner === true;
            const isRent = String(offer.transactionType || "sale").toLowerCase().includes("rent");
            
            const transactionBadgeClass = isRent 
              ? "border-blue-500/30 bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
              : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]";

            return (
              <motion.article
                key={offer.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <div className="absolute right-4 top-14 z-20">
                  <OfferFavoriteButton
                    offerId={offer.id}
                    onRequireAuth={() => {
                      window.location.href = `/login?redirect=${encodeURIComponent(`/oferta/${offer.id}`)}`;
                    }}
                  />
                </div>
                <Link
                  href={`/oferta/${offer.id}`}
                  className="group relative block aspect-[4/5] overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-900 shadow-2xl transition-all hover:shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ backgroundImage: `url(${firstImage(offer, index)})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-95" />
                  <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />

                  <div className={`absolute left-6 top-6 rounded-full border px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-xl ${transactionBadgeClass}`}>
                    {isRent ? "Lease" : "Acquire"}
                  </div>
                  
                  {isDealRoom && (
                    <div className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full border border-orange-400/50 bg-orange-500/90 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_20px_rgba(249,115,22,0.35)] backdrop-blur-xl">
                      <Briefcase className="size-3" />
                      {dict.homePremium.dealRoom}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-8">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
                      <MapPin className="size-3.5" />
                      {location}
                    </div>
                    <h3 className="text-2xl font-medium leading-tight text-white drop-shadow-md">
                      {offer.title || "Private EstateOS Residence"}
                    </h3>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
                      <span className="text-lg font-bold text-white">
                        {formatPrice(offer.price, offer.transactionType, dict.homePremium.priceOnRequest, dict.homePremium.pricePerMonth)}
                      </span>
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
