"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Star,
  MapPin,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Briefcase,
  X,
  Globe,
  Phone,
  Mail,
} from "lucide-react";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";

type AgencyCard = {
  id: number;
  companyId?: number;
  slug?: string | null;
  displayName: string;
  companyName: string | null;
  name: string | null;
  image: string | null;
  activeListings: number;
  reviewsCount: number;
  averageRating: number | null;
  companyAddress: string | null;
  companyWebsite: string | null;
  companyLogoUrl: string | null;
  officePhone: string | null;
  officeEmail: string | null;
};

type AgencyPublicDetail = {
  user: {
    id: number;
    name: string;
    companyName: string | null;
    companyAddress: string | null;
    companyWebsite: string | null;
    companyLogoUrl: string | null;
    officePhone: string | null;
    officeEmail: string | null;
  };
  offers: Array<{ id: number; title: string; price: number; city: string; district: string; status: string }>;
  reviews: Array<{ id: number; rating: number; comment: string | null; createdAt: string }>;
};

export default function AgencjePage() {
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AgencyPublicDetail | null>(null);

  const openAgencyDetail = async (agencyId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/users/${agencyId}/public`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setDetail(json);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/agencje", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAgencies(Array.isArray(d.agencies) ? d.agencies : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--eos-bg)] pt-28 pb-32 text-[var(--eos-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-emerald-500/10 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-500">
          EstateOS™ · biura partnerskie
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tighter sm:text-5xl">
          Katalog <span className="text-emerald-500">agencji</span>
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)]">
          Zweryfikowane biura nieruchomości z opiniami, aktywnymi ofertami i pełnym wsparciem w CRM.
          Wybierz agencję, która przejmie sprzedaż Twojej nieruchomości — z pełnym podglądem postępów.
        </p>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="size-8 animate-spin text-emerald-500" />
          </div>
        ) : agencies.length === 0 ? (
          <p className="mt-16 text-center text-[var(--eos-muted)]">Brak zarejestrowanych agencji.</p>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {agencies.map((agency, i) => {
              const avatar = getBestUserAvatarUrl({ image: agency.companyLogoUrl || agency.image });
              const ratingValue = agency.averageRating ?? 0;
              const firmHref = agency.slug ? `/firma/${agency.slug}` : `/profil/${agency.id}`;
              return (
                <motion.article
                  key={agency.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/90 p-6 shadow-[var(--eos-shadow-soft)] backdrop-blur-xl transition hover:border-emerald-500/30"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]">
                      {avatar ? (
                        <img src={avatar} alt="" className="size-full object-cover" />
                      ) : (
                        <Building2 className="size-6 text-emerald-500/70" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold">{agency.displayName}</h2>
                      <button
                        type="button"
                        onClick={() => void openAgencyDetail(agency.id)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
                      >
                        {[0, 1, 2, 3, 4].map((idx) => (
                          <Star
                            key={idx}
                            className={`size-3 ${ratingValue >= idx + 1 ? "fill-amber-400 text-amber-400" : "text-white/20"}`}
                          />
                        ))}
                        {agency.averageRating != null ? `${agency.averageRating} · ${agency.reviewsCount} opinii` : "Brak opinii"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                    <button
                      type="button"
                      onClick={() => void openAgencyDetail(agency.id)}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--eos-input)] px-3 py-1.5 hover:bg-emerald-500/10"
                    >
                      <Briefcase className="size-3" />
                      {agency.activeListings} ofert
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-500">
                      <ShieldCheck className="size-3" />
                      Partner
                    </span>
                  </div>

                  <Link
                    href={firmHref}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--eos-text)] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-bg)] transition group-hover:bg-emerald-500 group-hover:text-black"
                  >
                    {agency.slug ? "Strona biura" : "Zobacz profil"}
                    <ChevronRight className="size-3.5" />
                  </Link>
                </motion.article>
              );
            })}
          </div>
        )}

        <div className="mt-16 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
          <MapPin className="mx-auto mb-3 size-8 text-emerald-500" />
          <p className="text-lg font-bold">Masz ogłoszenie i chcesz oddać sprzedaż w ręce ekspertów?</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--eos-muted)]">
            W panelu „Moje ogłoszenia” wybierz ofertę i kliknij „Oddaj do agencji” — przejrzysz warunki i zachowasz
            podgląd bez obowiązku odbierania telefonów.
          </p>
          <Link
            href="/moje-konto/crm?tab=my_offers"
            className="mt-6 inline-flex rounded-full bg-emerald-500 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-black"
          >
            Przejdź do moich ogłoszeń
          </Link>
        </div>
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[1.5rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">Profil agencji · szczegóły</h3>
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded-full p-2 hover:bg-[var(--eos-input)]">
                <X className="size-4" />
              </button>
            </div>
            {detailLoading || !detail ? (
              <div className="py-10 text-center text-sm text-[var(--eos-muted)]">Ładowanie danych agencji…</div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                    <p className="text-sm font-bold">{detail.user.companyName || detail.user.name}</p>
                    {detail.user.companyAddress ? <p className="mt-1 text-xs text-[var(--eos-muted)]">{detail.user.companyAddress}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {detail.user.companyWebsite ? <a href={detail.user.companyWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40"><Globe className="size-3" />WWW</a> : null}
                      {detail.user.officePhone ? <a href={`tel:${detail.user.officePhone}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40"><Phone className="size-3" />Biuro</a> : null}
                      {detail.user.officeEmail ? <a href={`mailto:${detail.user.officeEmail}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] px-2.5 py-1 hover:border-emerald-500/40"><Mail className="size-3" />E-mail</a> : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Ocena i opinie</p>
                    <div className="mt-2 flex items-center gap-1 text-amber-400">
                      {[0, 1, 2, 3, 4].map((idx) => {
                        const avg = detail.reviews.length
                          ? detail.reviews.reduce((sum, r) => sum + r.rating, 0) / detail.reviews.length
                          : 0;
                        return <Star key={idx} className={`size-4 ${avg >= idx + 1 ? "fill-amber-400" : "text-white/20"}`} />;
                      })}
                      <span className="ml-2 text-xs text-[var(--eos-muted)]">{detail.reviews.length} opinii</span>
                    </div>
                    <Link href={`/profil/${detail.user.id}`} className="mt-3 inline-flex text-xs font-semibold text-emerald-500 hover:underline">
                      Otwórz pełny profil agencji
                    </Link>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-muted)]">Oferty agencji ({detail.offers.length})</p>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {detail.offers.length === 0 ? (
                      <p className="text-sm text-[var(--eos-muted)]">Ta agencja nie ma aktywnych ofert.</p>
                    ) : (
                      detail.offers.map((offer) => (
                        <Link key={offer.id} href={`/oferta/${offer.id}`} className="block rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/40 px-4 py-3 hover:border-emerald-500/40">
                          <p className="text-sm font-semibold">{offer.title}</p>
                          <p className="mt-1 text-xs text-[var(--eos-muted)]">{offer.city} · {offer.district} · {Math.round(offer.price).toLocaleString("pl-PL")} zł</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
