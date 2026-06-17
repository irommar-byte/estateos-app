"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Building2, TrendingDown, Loader2 } from "lucide-react";

type DelegatedOffer = {
  id: number;
  title: string;
  price: number;
  city: string;
  district: string;
  status: string;
  imageUrl: string;
  updatedAt: string;
  agency: { id: number; name: string | null; image: string | null };
  commissionRate: number | null;
  recentPriceChanges: Array<{ price: number; recordedAt: string; changeType: string }>;
};

export default function DelegatedOffersPanel() {
  const [offers, setOffers] = useState<DelegatedOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offers/delegated", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOffers(Array.isArray(d.offers) ? d.offers : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-8 flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (offers.length === 0) return null;

  return (
    <div className="mb-8 rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-transparent p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <Eye className="size-5 text-blue-400" />
        <div>
          <h3 className="text-lg font-black tracking-tight text-white">Twoje nieruchomości pod opieką agencji</h3>
          <p className="text-xs text-[var(--eos-muted)]">
            Podgląd na żywo — bez kontaktu z kupującymi i umawiania spotkań.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((o) => (
          <div key={o.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex gap-4">
              <div
                className="size-20 shrink-0 rounded-xl bg-cover bg-center"
                style={{ backgroundImage: `url(${o.imageUrl})` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{o.title}</p>
                <p className="text-xs text-[var(--eos-muted)]">
                  {o.city} · {Math.round(o.price).toLocaleString("pl-PL")} zł
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                  <Building2 className="size-3" />
                  {o.agency.name || "Agencja"}
                  {o.commissionRate != null ? ` · ${o.commissionRate}%` : ""}
                </p>
              </div>
            </div>
            {o.recentPriceChanges.length > 0 ? (
              <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--eos-subtle)]">
                <TrendingDown className="size-3" />
                Ostatnia zmiana ceny: {new Date(o.recentPriceChanges[0].recordedAt).toLocaleDateString("pl-PL")}
              </div>
            ) : null}
            <Link
              href={`/oferta/${o.id}?owner_preview=1`}
              className="mt-4 inline-block text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300"
            >
              Podgląd oferty →
            </Link>
          </div>
        ))}
      </div>
      <Link
        href="/agencje"
        className="mt-6 inline-flex text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white"
      >
        Przeglądaj katalog agencji
      </Link>
    </div>
  );
}
