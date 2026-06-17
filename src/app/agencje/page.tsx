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
} from "lucide-react";
import { getBestUserAvatarUrl } from "@/lib/userAvatar";

type AgencyCard = {
  id: number;
  displayName: string;
  companyName: string | null;
  name: string | null;
  image: string | null;
  activeListings: number;
  reviewsCount: number;
  averageRating: number | null;
};

export default function AgencjePage() {
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [loading, setLoading] = useState(true);

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
              const avatar = getBestUserAvatarUrl({ image: agency.image });
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
                      {agency.averageRating != null ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                          <Star className="size-3 fill-amber-400" />
                          {agency.averageRating} · {agency.reviewsCount} opinii
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--eos-subtle)]">Brak opinii</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--eos-input)] px-3 py-1.5">
                      <Briefcase className="size-3" />
                      {agency.activeListings} ofert
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-500">
                      <ShieldCheck className="size-3" />
                      Partner
                    </span>
                  </div>

                  <Link
                    href={`/profil/${agency.id}`}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--eos-text)] py-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--eos-bg)] transition group-hover:bg-emerald-500 group-hover:text-black"
                  >
                    Zobacz profil
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
    </main>
  );
}
