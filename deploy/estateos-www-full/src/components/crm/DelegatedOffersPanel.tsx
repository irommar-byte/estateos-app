"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Shield,
  TrendingDown,
} from "lucide-react";
import { parseLeadConditions } from "@/lib/leadTransferShared";

type DelegatedOffer = {
  id: number;
  title: string;
  price: number;
  city: string;
  district: string | null;
  status: string;
  imageUrl: string;
  updatedAt: string;
  agency: { id: number; name: string | null; image: string | null };
  commissionRate: number | null;
  commissionTerms: string | null;
  acceptedAt: string | null;
  recentPriceChanges: Array<{ price: number; recordedAt: string; changeType: string }>;
};

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

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
    <div className="mb-8 overflow-hidden rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.06] to-[var(--eos-card)]">
      <div className="border-b border-blue-500/15 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Eye className="size-5 text-blue-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-500">
                Pod opieką agencji
              </p>
            </div>
            <h3 className="text-xl font-black tracking-tight text-[var(--eos-text)] sm:text-2xl">
              Twoje nieruchomości prowadzone przez biuro
            </h3>
            <p className="eos-muted-copy mt-2 max-w-2xl text-sm leading-relaxed">
              Oferty pozostają widoczne tutaj — masz podgląd postępów i zapisane warunki współpracy.
              Zarządzaniem zajmuje się agencja.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/60 px-4 py-3 text-xs text-[var(--eos-muted)]">
            <p className="flex items-center gap-2 font-bold text-[var(--eos-text)]">
              <Shield className="size-4 text-emerald-500" />
              Tryb właściciela
            </p>
            <p className="mt-1.5 leading-relaxed">Podgląd i statystyki — bez edycji ogłoszenia.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6 sm:p-8">
        {offers.map((o) => {
          const parsed = parseLeadConditions(o.commissionTerms);
          const location = [o.city, o.district].filter(Boolean).join(" · ");
          return (
            <article
              key={o.id}
              className="overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-soft)]"
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:p-6">
                <div
                  className="h-36 w-full shrink-0 rounded-2xl bg-cover bg-center sm:size-32"
                  style={{ backgroundImage: `url(${o.imageUrl || "/placeholder.jpg"})` }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-blue-600">
                      <CheckCircle2 className="size-3" /> Przekazano agencji
                    </span>
                    <span className="rounded-full bg-[var(--eos-input)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-lg font-black text-[var(--eos-text)]">{o.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--eos-muted)]">
                    <MapPin className="size-3.5 shrink-0 text-emerald-500" />
                    {location || "—"}
                  </p>
                  <p className="mt-2 text-xl font-black text-emerald-500">{fmtPrice(o.price)}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--eos-muted)]">
                    <Building2 className="size-3.5 shrink-0" />
                    {o.agency.name || "Agencja"}
                    {o.commissionRate != null ? ` · prowizja ${o.commissionRate}%` : ""}
                  </p>
                </div>
              </div>

              {parsed.conditions.length > 0 || parsed.rawText ? (
                <div className="border-t border-[var(--eos-border)] bg-[var(--eos-surface)]/40 px-5 py-4 sm:px-6">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--eos-subtle)]">
                    <FileText className="size-3.5" /> Zapisane warunki współpracy
                  </p>
                  {parsed.conditions.length > 0 ? (
                    <ol className="mt-3 space-y-1.5">
                      {parsed.conditions.map((c, i) => (
                        <li key={c.id} className="flex gap-2 text-sm text-[var(--eos-muted)]">
                          <span className="font-black text-emerald-500">{i + 1}.</span>
                          <span>{c.label}</span>
                        </li>
                      ))}
                    </ol>
                  ) : parsed.rawText ? (
                    <p className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{parsed.rawText}</p>
                  ) : null}
                  {o.acceptedAt ? (
                    <p className="mt-3 text-[10px] text-[var(--eos-subtle)]">
                      Zaakceptowano: {new Date(o.acceptedAt).toLocaleDateString("pl-PL")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--eos-border)] px-5 py-4 sm:px-6">
                {o.recentPriceChanges.length > 0 ? (
                  <p className="flex items-center gap-2 text-[10px] text-[var(--eos-subtle)]">
                    <TrendingDown className="size-3" />
                    Ostatnia zmiana ceny:{" "}
                    {new Date(o.recentPriceChanges[0].recordedAt).toLocaleDateString("pl-PL")}
                  </p>
                ) : (
                  <span />
                )}
                <Link
                  href={`/oferta/${o.id}?owner_preview=1`}
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400"
                >
                  Podgląd oferty →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
