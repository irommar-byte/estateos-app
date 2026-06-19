"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Briefcase,
  ChevronRight,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";
import { resolveOfferPrimaryImage } from "@/lib/offers/primaryImage";
import ProfileMediaAvatar from "@/components/profile/ProfileMediaAvatar";
import { formatAgentTitle, pickTeamMemberAvatar } from "@/lib/agentProfile";

type CompanyPublic = {
  company: {
    id: number;
    name: string;
    slug: string | null;
    address: string | null;
    website: string | null;
    logoUrl: string | null;
    officePhone: string | null;
    officeEmail: string | null;
    memberSince: string;
  };
  stats: {
    activeAgents: number;
    activeListings: number;
    reviewsCount: number;
    averageRating: number | null;
  };
  agents: Array<{
    id: number;
    name: string | null;
    image: string | null;
    phone: string | null;
    role: string;
    agentTitle?: string;
    profilePhotoUrl?: string | null;
    activeOffers: number;
    memberSince: string;
  }>;
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
    images: unknown;
    transactionType: string;
    agent: { id: number; name: string | null };
  }>;
  reviews: Array<{
    id: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    agent: { id: number; name: string | null };
  }>;
};

function formatPrice(offer: CompanyPublic["offers"][number]) {
  const amount = offer.pricePln ?? offer.price;
  const currency = offer.priceCurrency || "PLN";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function FirmaPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<CompanyPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agency-company/public/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message || "Nie znaleziono biura.");
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => setError("Błąd połączenia."))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--eos-bg)] pt-24">
        <Loader2 className="animate-spin text-emerald-500" size={36} />
      </div>
    );
  }

  if (!data || error) {
    return (
      <main className="min-h-screen bg-[var(--eos-bg)] px-6 pt-32 pb-24 text-center text-[var(--eos-text)]">
        <Building2 className="mx-auto mb-4 text-[var(--eos-muted)]" size={40} />
        <h1 className="text-2xl font-black">{error || "Biuro niedostępne"}</h1>
        <Link href="/agencje" className="mt-6 inline-block text-sm font-bold text-emerald-500 hover:underline">
          Wróć do katalogu agencji
        </Link>
      </main>
    );
  }

  const { company, stats, agents, offers, reviews } = data;
  const logo = company.logoUrl;
  const rating = stats.averageRating ?? 0;

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pb-32 pt-28 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-emerald-500/12 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          href="/agencje"
          className="mb-8 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)] hover:text-emerald-500"
        >
          ← Katalog agencji
        </Link>

        <header className="overflow-hidden rounded-[2rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-8 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
                <ProfileMediaAvatar src={logo} alt="" iconSize={36} className="size-full object-cover" />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">
                  Biuro nieruchomości
                </p>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{company.name}</h1>
                {company.address ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-[var(--eos-muted)]">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {company.address}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--eos-muted)]">
                  {company.officePhone ? (
                    <a href={`tel:${company.officePhone}`} className="inline-flex items-center gap-2 hover:text-emerald-500">
                      <Phone size={14} /> {company.officePhone}
                    </a>
                  ) : null}
                  {company.officeEmail ? (
                    <a href={`mailto:${company.officeEmail}`} className="inline-flex items-center gap-2 hover:text-emerald-500">
                      <Mail size={14} /> {company.officeEmail}
                    </a>
                  ) : null}
                  {company.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 hover:text-emerald-500"
                    >
                      <Globe size={14} /> Strona www
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Agenci", value: stats.activeAgents },
                { label: "Oferty", value: stats.activeListings },
                { label: "Opinie", value: stats.reviewsCount },
                {
                  label: "Ocena",
                  value: stats.averageRating != null ? stats.averageRating.toFixed(1) : "—",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 px-4 py-3 text-center"
                >
                  <p className="text-2xl font-black">{kpi.value}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>

          {stats.averageRating != null ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2">
              {[0, 1, 2, 3, 4].map((idx) => (
                <Star
                  key={idx}
                  className={`size-3.5 ${rating >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-white/15"}`}
                />
              ))}
              <span className="text-xs font-bold text-amber-400">
                {stats.averageRating} / 5 · {stats.reviewsCount} opinii od klientów
              </span>
            </div>
          ) : null}
        </header>

        <section className="mt-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-black">Zespół ({agents.length})</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
              <ShieldCheck size={12} /> Zweryfikowani partnerzy
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => (
                <motion.article
                  key={agent.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-12 overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-input)]">
                      <ProfileMediaAvatar
                        src={pickTeamMemberAvatar({ userImage: agent.image, profilePhotoUrl: agent.profilePhotoUrl })}
                        alt={agent.name || "Agent"}
                        iconSize={20}
                        className="size-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{agent.name || "Agent"}</p>
                      <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600">
                        {formatAgentTitle(agent.agentTitle)}
                      </span>
                      <p className="mt-1 text-xs text-[var(--eos-muted)]">{agent.activeOffers} aktywnych ofert</p>
                    </div>
                  </div>
                  <Link
                    href={`/profil/${agent.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-500 hover:underline"
                  >
                    Profil agenta <ChevronRight size={12} />
                  </Link>
                </motion.article>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="mb-5 text-xl font-black">Oferty biura ({offers.length})</h2>
          {offers.length === 0 ? (
            <p className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 text-center text-sm text-[var(--eos-muted)]">
              To biuro nie ma jeszcze aktywnych ogłoszeń.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer, i) => {
                const thumb = resolveOfferPrimaryImage(offer);
                return (
                  <motion.article
                    key={offer.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link
                      href={`/oferta/${offer.id}`}
                      className="group block overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] transition hover:border-emerald-500/30"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-[var(--eos-input)]">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt=""
                            className="size-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <Briefcase className="size-8 text-[var(--eos-muted)]" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-lg font-black text-emerald-500">{formatPrice(offer)}</p>
                        <h3 className="mt-1 line-clamp-2 font-bold leading-snug">{offer.title}</h3>
                        <p className="mt-2 text-xs text-[var(--eos-muted)]">
                          {offer.city}
                          {offer.district ? ` · ${offer.district}` : ""}
                          {offer.area ? ` · ${offer.area} m²` : ""}
                        </p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                          Agent: {offer.agent.name || "—"}
                        </p>
                      </div>
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>

        {reviews.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-black">Opinie klientów</h2>
            <div className="space-y-3">
              {reviews.slice(0, 8).map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)] p-5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    {[0, 1, 2, 3, 4].map((idx) => (
                      <Star
                        key={idx}
                        className={`size-3 ${review.rating >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-white/15"}`}
                      />
                    ))}
                    <span className="text-xs text-[var(--eos-muted)]">
                      {review.agent.name} · {new Date(review.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                  {review.comment ? <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{review.comment}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
