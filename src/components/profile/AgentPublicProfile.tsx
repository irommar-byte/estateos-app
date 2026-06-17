"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import ProfileMediaAvatar from "@/components/profile/ProfileMediaAvatar";

type AgentProfilePayload = {
  isAgent: boolean;
  agent: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
    memberSince: string;
    role: string | null;
    agentTitle: string;
    titleLabel: string;
    profilePhotoUrl: string | null;
    avatarUrl: string | null;
  };
  company: {
    id: number | null;
    name: string;
    slug: string | null;
    address: string | null;
    website: string | null;
    logoUrl: string | null;
    officePhone: string | null;
    officeEmail: string | null;
    firmHref: string | null;
  } | null;
  stats: {
    reviewsCount: number;
    averageRating: number | null;
    activeOffers: number;
  };
  offers: Array<{
    id: number;
    title: string;
    price: number;
    pricePln: number | null;
    priceCurrency: string;
    city: string;
    district: string | null;
    area: number;
    rooms: number | null;
    imageUrl: string;
    transactionType: string;
  }>;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    createdAt: string | Date;
    reviewerName?: string | null;
  }>;
};

function formatPrice(offer: AgentProfilePayload["offers"][number]) {
  const amount = offer.pricePln ?? offer.price;
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: offer.priceCurrency || "PLN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AgentPublicProfile({ data }: { data: AgentProfilePayload }) {
  const { agent, company, stats, offers, reviews } = data;
  const rating = stats.averageRating ?? 0;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pb-32 pt-28 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-emerald-500/10 to-transparent" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
        >
          <ChevronLeft size={14} /> Wróć
        </button>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 shadow-[var(--eos-shadow-soft)] sm:p-10"
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <div className="relative mx-auto shrink-0 lg:mx-0">
              <div className="size-32 overflow-hidden rounded-full border-2 border-emerald-500/30 bg-[var(--eos-input)] shadow-lg sm:size-36">
                <ProfileMediaAvatar src={agent.avatarUrl} alt={agent.name || "Agent"} iconSize={40} />
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-black shadow-lg">
                {agent.titleLabel}
              </span>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">
                Profil agenta nieruchomości
              </p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{agent.name || "Agent"}</h1>
              {company ? (
                <p className="mt-2 text-lg font-semibold text-[var(--eos-muted)]">{company.name}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <button
                  type="button"
                  onClick={() => document.getElementById("agent-reviews")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 transition hover:bg-amber-500/15"
                >
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <Star
                      key={idx}
                      className={`size-4 ${rating >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-[var(--eos-border)]"}`}
                    />
                  ))}
                  <span className="text-sm font-bold text-amber-500">
                    {stats.averageRating != null ? stats.averageRating.toFixed(1) : "—"} · {stats.reviewsCount} opinii
                  </span>
                </button>
                <span className="rounded-full bg-[var(--eos-input)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">
                  {stats.activeOffers} aktywnych ofert
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--eos-muted)]">
                W EstateOS od {new Date(agent.memberSince).toLocaleDateString("pl-PL")}
              </p>
            </div>

            {company?.logoUrl ? (
              <div className="hidden shrink-0 lg:block">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Biuro</p>
                <div className="size-20 overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
                  <ProfileMediaAvatar src={company.logoUrl} alt={company.name} iconSize={28} />
                </div>
              </div>
            ) : null}
          </div>

          {company ? (
            <div className="mt-8 grid gap-4 border-t border-[var(--eos-border)] pt-6 sm:grid-cols-2">
              <div className="space-y-2 text-sm text-[var(--eos-muted)]">
                {company.address ? (
                  <p className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 shrink-0" /> {company.address}
                  </p>
                ) : null}
                {company.officePhone || agent.phone ? (
                  <a href={`tel:${company.officePhone || agent.phone}`} className="flex items-center gap-2 hover:text-emerald-500">
                    <Phone size={14} /> {company.officePhone || agent.phone}
                  </a>
                ) : null}
                {company.officeEmail ? (
                  <a href={`mailto:${company.officeEmail}`} className="flex items-center gap-2 hover:text-emerald-500">
                    <Mail size={14} /> {company.officeEmail}
                  </a>
                ) : null}
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-emerald-500">
                    <Globe size={14} /> Strona biura
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap items-start gap-3">
                {company.firmHref ? (
                  <Link
                    href={company.firmHref}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black hover:bg-emerald-400"
                  >
                    <Building2 size={14} /> Strona biura
                  </Link>
                ) : null}
                {agent.phone ? (
                  <a
                    href={`tel:${agent.phone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--eos-border)] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest hover:border-emerald-500/40"
                  >
                    <Phone size={14} /> Zadzwoń
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </motion.header>

        {offers.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-black">
              <Briefcase className="text-emerald-500" size={20} /> Oferty agenta ({offers.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <Link
                  key={offer.id}
                  href={`/oferta/${offer.id}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-emerald-500/30"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--eos-input)]">
                    {offer.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={offer.imageUrl} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Briefcase className="text-[var(--eos-muted)]" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-black text-emerald-500">{formatPrice(offer)}</p>
                    <p className="mt-1 line-clamp-2 font-bold leading-snug">{offer.title}</p>
                    <p className="mt-1 text-xs text-[var(--eos-muted)]">
                      {offer.city}
                      {offer.district ? ` · ${offer.district}` : ""}
                      {offer.area ? ` · ${offer.area} m²` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section id="agent-reviews" className="mt-12">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-black">
            <Star className="fill-amber-400 text-amber-400" size={20} /> Opinie klientów ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--eos-border)] p-10 text-center text-sm text-[var(--eos-muted)]">
              Ten agent nie ma jeszcze opinii od klientów.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Star
                        key={idx}
                        className={`size-3.5 ${review.rating >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-[var(--eos-border)]"}`}
                      />
                    ))}
                    <span className="text-xs text-[var(--eos-muted)]">
                      {review.reviewerName || "Klient"} · {new Date(review.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--eos-muted)]">
                    {review.comment ? `"${review.comment}"` : "Ocena bez komentarza tekstowego."}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
